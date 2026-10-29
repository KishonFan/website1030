import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { handleCms, signState, readState, COOKIE } = createRequire(import.meta.url)('../lib/cms-auth.cjs');
const env = { GITHUB_OAUTH_CLIENT_ID: 'test-client-id', GITHUB_OAUTH_CLIENT_SECRET: 'test-only-client-secret' };

function response() {
  return { headers: {}, statusCode: 200, body: '', setHeader(name, value) { this.headers[name] = value; }, end(value = '') { this.body = value; } };
}

async function call(path, options = {}) {
  const res = response();
  await handleCms({ url: path, method: options.method || 'GET', headers: options.headers || {} }, res, { env: options.env || env, fetcher: options.fetcher || (() => { throw new Error('Unexpected network request'); }), now: () => 1000000 });
  return res;
}

async function login() {
  const start = await call('/api/cms/auth?provider=github');
  const target = new URL(start.headers.Location);
  return { start, state: target.searchParams.get('state'), cookie: start.headers['Set-Cookie'].split(';')[0] };
}

test('public connection status never exposes credentials, and missing credentials disable login', async () => {
  const ready = await call('/api/cms/config');
  assert.equal(JSON.parse(ready.body).configured, true);
  assert.ok(!ready.body.includes(env.GITHUB_OAUTH_CLIENT_SECRET));
  assert.ok(!ready.body.includes(env.GITHUB_OAUTH_CLIENT_ID));
  const empty = await call('/api/cms/config', { env: {} });
  assert.equal(JSON.parse(empty.body).configured, false);
  assert.equal((await call('/api/cms/auth', { env: {} })).statusCode, 503);
});

test('login uses the configured callback, scoped GitHub authorization, PKCE and a secure expiring cookie', async () => {
  const { start } = await login();
  const url = new URL(start.headers.Location);
  assert.equal(start.statusCode, 302);
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://website1025.vercel.app/api/cms/callback');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('scope'), 'public_repo');
  assert.ok(url.searchParams.get('code_challenge'));
  assert.match(start.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Lax; Max-Age=600/);
  assert.ok(!start.headers.Location.includes(env.GITHUB_OAUTH_CLIENT_SECRET));
});

test('missing, tampered, expired and mismatched state cannot reach the token endpoint', async () => {
  let called = false;
  const fetcher = () => { called = true; throw new Error('Should not call'); };
  const { cookie, state } = await login();
  const wrong = await call('/api/cms/callback?code=example&state=wrong', { headers: { cookie }, fetcher });
  const missing = await call('/api/cms/callback?code=example&state=' + state, { fetcher });
  assert.equal(wrong.statusCode, 400);
  assert.equal(missing.statusCode, 400);
  assert.equal(called, false);
  const payload = { state: 'nonce', verifier: 'a'.repeat(64), createdAt: 0 };
  const signed = signState(payload, env.GITHUB_OAUTH_CLIENT_SECRET);
  assert.throws(() => readState(signed, env.GITHUB_OAUTH_CLIENT_SECRET, 'nonce', 1000000), /过期/);
  assert.throws(() => readState(signed + 'x', env.GITHUB_OAUTH_CLIENT_SECRET, 'nonce', 100), /失败/);
});

function githubStub(loginName = 'KishonFan', canPush = true, seen = []) {
  return async (url, options) => {
    seen.push({ url, options });
    if (url.endsWith('/access_token')) return { ok: true, json: async () => ({ access_token: 'test-only-github-token' }) };
    if (url.endsWith('/user')) return { ok: true, json: async () => ({ login: loginName }) };
    return { ok: true, json: async () => ({ permissions: { push: canPush } }) };
  };
}

test('only the intended owner with repository write permission receives a token', async () => {
  for (const [owner, canPush] of [['someone-else', true], ['KishonFan', false]]) {
    const { cookie, state } = await login();
    const result = await call('/api/cms/callback?code=example&state=' + state, { headers: { cookie }, fetcher: githubStub(owner, canPush) });
    assert.equal(result.statusCode, 403);
    assert.ok(!result.body.includes('test-only-github-token'));
  }
});

test('successful callbacks send credentials only to the configured opener origin and clear their state cookie', async () => {
  const seen = [];
  const { cookie, state } = await login();
  const result = await call('/api/cms/callback?code=example&state=' + state, { headers: { cookie }, fetcher: githubStub('KishonFan', true, seen) });
  assert.equal(result.statusCode, 200);
  assert.ok(result.body.includes('authorization:github:success:'));
  assert.ok(result.body.includes('event.origin !== origin'));
  assert.ok(result.body.includes('event.source !== opener'));
  assert.ok(result.body.includes('https://website1025.vercel.app'));
  assert.ok(!result.body.includes(env.GITHUB_OAUTH_CLIENT_SECRET));
  assert.match(result.headers['Set-Cookie'], /Max-Age=0/);
  assert.equal(result.headers['Cache-Control'], 'no-store, max-age=0');
  assert.ok(JSON.parse(seen[0].options.body).code_verifier);
});

test('unsafe callback configuration and unexpected HTTP methods fail closed', async () => {
  assert.equal((await call('/api/cms/config', { env: { ...env, CMS_SITE_URL: 'https://example.com/path' } })).statusCode, 503);
  assert.equal((await call('/api/cms/config', { env: { ...env, CMS_SITE_URL: 'http://example.com' } })).statusCode, 503);
  assert.equal((await call('/api/cms/auth', { method: 'POST' })).statusCode, 405);
});
