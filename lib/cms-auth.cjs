const { randomBytes, createHmac, createHash, timingSafeEqual } = require('node:crypto');
const defaults = require('../cms.config.json');
const COOKIE = '__Host-academic-cms-auth';
const TTL = 10 * 60 * 1000;

function settings(env = process.env) {
  const config = {
    repository: defaults.repository,
    branch: defaults.branch,
    siteUrl: (env.CMS_SITE_URL || defaults.siteUrl).replace(/\/$/, ''),
    allowedLogin: env.CMS_ALLOWED_LOGIN || defaults.allowedLogin,
    scope: env.GITHUB_OAUTH_SCOPE || defaults.scope,
    clientId: env.GITHUB_OAUTH_CLIENT_ID || '',
    clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET || '',
  };
  const url = new URL(config.siteUrl);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('CMS_SITE_URL must be the complete https:// website origin, without a path.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(config.repository) || !config.branch || !config.allowedLogin) throw new Error('CMS repository, branch and owner must be configured.');
  if (!['public_repo', 'repo'].includes(config.scope)) throw new Error('Invalid GitHub OAuth scope.');
  return config;
}

function publicSettings(config) {
  const missing = ['GITHUB_OAUTH_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_SECRET'].filter((name, index) => ![config.clientId, config.clientSecret][index]);
  return { repository: config.repository, branch: config.branch, siteUrl: config.siteUrl, configured: missing.length === 0, missing };
}

function signState(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return data + '.' + createHmac('sha256', secret).update(data).digest('base64url');
}

function readState(value, secret, expectedState, now = Date.now()) {
  if (!value || value.length > 4096 || !expectedState) throw new Error('登录校验信息缺失，请关闭此窗口并重新登录。');
  const [data, signature, extra] = value.split('.');
  if (!data || !signature || extra) throw new Error('登录校验失败，请重新登录。');
  const calculated = createHmac('sha256', secret).update(data).digest('base64url');
  const given = Buffer.from(signature);
  const wanted = Buffer.from(calculated);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) throw new Error('登录校验失败，请重新登录。');
  let payload;
  try { payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); } catch { throw new Error('登录校验失败，请重新登录。'); }
  if (!Number.isFinite(payload.createdAt) || payload.createdAt > now + 30000 || now - payload.createdAt > TTL) throw new Error('登录窗口已过期，请重新登录。');
  if (typeof payload.state !== 'string' || typeof expectedState !== 'string') throw new Error('登录校验失败，请重新登录。');
  const actual = Buffer.from(expectedState);
  const stored = Buffer.from(payload.state);
  if (actual.length !== stored.length || !timingSafeEqual(actual, stored) || !/^[A-Za-z0-9_-]{43,128}$/.test(payload.verifier || '')) throw new Error('登录校验失败，请重新登录。');
  return payload;
}

function cookieValue(request) {
  const cookies = String(request.headers.cookie || '').split(';');
  return cookies.map(value => value.trim()).find(value => value.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';
}

function headers(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function failure(response, status, message) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  response.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>后台登录</title><body style="font:16px/1.8 system-ui;padding:32px;max-width:600px;margin:auto"><h1>暂时无法完成登录</h1><p>${escapeHtml(message)}</p><p>关闭此窗口，回到网站后台后重试。</p></body></html>`);
}

function sendToken(response, token, origin) {
  const nonce = randomBytes(18).toString('base64');
  const encodedMessage = JSON.stringify('authorization:github:success:' + JSON.stringify({ token, provider: 'github' })).replaceAll('<', '\\u003c');
  const encodedOrigin = JSON.stringify(origin).replaceAll('<', '\\u003c');
  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'`);
  response.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录成功</title><body style="font:16px/1.8 system-ui;padding:32px"><h1>GitHub 登录已完成</h1><p id="status">正在返回内容管理后台……</p><script nonce="${nonce}">
    (() => {
      const origin = ${encodedOrigin};
      const opener = window.opener;
      if (!opener) { document.getElementById('status').textContent = '请关闭此页，从网站的 /admin/ 页面重新发起登录。'; return; }
      const receive = event => {
        if (event.source !== opener || event.origin !== origin || event.data !== 'authorizing:github') return;
        opener.postMessage(${encodedMessage}, origin);
        window.removeEventListener('message', receive);
        window.close();
      };
      window.addEventListener('message', receive);
      opener.postMessage('authorizing:github', origin);
    })();
  </script></body></html>`);
}

async function githubJson(url, options, fetcher) {
  const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('GitHub 暂时没有完成授权，或该账户没有仓库写入权限。');
  return response.json();
}

async function handleCms(request, response, { env = process.env, fetcher = fetch, now = () => Date.now() } = {}) {
  headers(response);
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { error: 'Method not allowed' });
  }
  const url = new URL(request.url, 'https://cms.invalid');
  const query = request.query || Object.fromEntries(url.searchParams);
  const action = query.action || url.pathname.split('/').filter(Boolean).at(-1);
  let config;
  try { config = settings(env); }
  catch { return json(response, 503, { error: '后台网址或仓库配置无效，请核对 CMS_SITE_URL 和 cms.config.json。' }); }
  if (action === 'config') return json(response, 200, publicSettings(config));
  if (!['auth', 'callback'].includes(action)) return json(response, 404, { error: 'Not found' });
  if (!publicSettings(config).configured) return failure(response, 503, 'GitHub 登录尚未配置。请先在 Vercel 中设置 Client ID 和 Client Secret，再重新部署。');

  const callback = config.siteUrl + '/api/cms/callback';
  if (action === 'auth') {
    if (query.provider && query.provider !== 'github') return failure(response, 400, '不支持此登录方式。');
    const payload = { state: randomBytes(32).toString('base64url'), verifier: randomBytes(48).toString('base64url'), createdAt: now() };
    response.setHeader('Set-Cookie', `${COOKIE}=${signState(payload, config.clientSecret)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    const target = new URL('https://github.com/login/oauth/authorize');
    target.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: callback, scope: config.scope, state: payload.state, code_challenge: createHash('sha256').update(payload.verifier).digest('base64url'), code_challenge_method: 'S256', login: config.allowedLogin, allow_signup: 'false' });
    response.statusCode = 302;
    response.setHeader('Location', target.href);
    return response.end();
  }

  response.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  let state;
  try {
    state = readState(cookieValue(request), config.clientSecret, query.state, now());
    if (query.error || typeof query.code !== 'string' || !query.code) throw new Error('GitHub 登录未完成，请重新登录并确认授权。');
  } catch (error) { return failure(response, 400, error.message); }

  try {
    const tokenData = await githubJson('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code: query.code, redirect_uri: callback, code_verifier: state.verifier }),
    }, fetcher);
    if (typeof tokenData.access_token !== 'string' || !tokenData.access_token || tokenData.error) return failure(response, 401, 'GitHub 未返回有效授权，请重新登录。');
    const apiHeaders = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Jianxiong-Academic-CMS' };
    const [user, repository] = await Promise.all([
      githubJson('https://api.github.com/user', { headers: apiHeaders }, fetcher),
      githubJson(`https://api.github.com/repos/${config.repository}`, { headers: apiHeaders }, fetcher),
    ]);
    if (String(user.login).toLowerCase() !== config.allowedLogin.toLowerCase() || repository.permissions?.push !== true) return failure(response, 403, '请使用网站所有者的 GitHub 账户登录，并确认拥有此仓库的写入权限。');
    return sendToken(response, tokenData.access_token, config.siteUrl);
  } catch { return failure(response, 502, 'GitHub 授权请求暂时失败，请检查账户权限或稍后重试。'); }
}

module.exports = { handleCms, settings, publicSettings, signState, readState, COOKIE };
