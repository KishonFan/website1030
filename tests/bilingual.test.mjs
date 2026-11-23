import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { locales } from '../lib/locale.mjs';
import { publicationContent, worksContent } from '../lib/render.mjs';

const load = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const createConfig = createRequire(import.meta.url)('../admin/schema.js');

test('the same publication record displays the original citation and DOI in both languages', () => {
  const record = {
    kind: 'published', year: 2026, title: 'Original article title', titleZh: '论文译题',
    authors: 'Jianxiong Fan', doi: '10.1234/example', keywords: ['Training'], keywordsZh: ['培训'],
  };
  const draft = { kind: 'manuscript', title: 'Sample manuscript', authors: 'Jianxiong Fan', status: 'Under review' };
  const english = publicationContent([record, draft]).html;
  const chinese = publicationContent([record, draft], '', null, locales.zh).html;
  for (const html of [english, chinese]) assert.match(html, /href="https:\/\/doi\.org\/10\.1234\/example"/);
  assert.match(chinese, /<h3>.*>论文译题<\/a><\/h3><p class="original-title" lang="en">Original article title<\/p>/);
  assert.match(chinese, /<li>培训<\/li>/);
  assert.match(chinese, /<span>审稿中<\/span>/);
  assert.match(chinese, /<h3>Sample manuscript<\/h3>/);
  assert.doesNotMatch(english, /论文译题|审稿中/);
});

test('works can link to a localized project and retain old projects without translations', () => {
  const legacy = { title: 'Project A', tag: 'AR', url: 'https://example.org/a', image: '/assets/a.jpg' };
  const translated = { ...legacy, titleZh: '作品甲', urlZh: 'https://example.org/zh/a' };
  assert.match(worksContent([legacy], locales.zh).html, /href="https:\/\/example\.org\/a".*<h2>Project A/);
  assert.match(worksContent([translated], locales.zh).html, /href="https:\/\/example\.org\/zh\/a".*<h2>作品甲/);
  assert.match(worksContent([translated]).html, /href="https:\/\/example\.org\/a".*<h2>Project A/);
  assert.throws(() => worksContent([{ ...translated, urlZh: 'javascript:alert(1)' }], locales.zh), /URL/);
});

test('CMS writes the two localized pages to separate files and uses common metadata for works and papers', async () => {
  const config = createConfig({ siteUrl: 'https://example.org', repository: 'owner/site', branch: 'main' });
  for (const base of ['about', 'cv']) {
    const files = config.collections.find(collection => collection.name === base).files;
    assert.deepEqual(files.map(file => file.name), [base, base + '-zh']);
    const chinese = files[1];
    assert.equal(chinese.preview_path, base === 'about' ? 'zh/' : 'zh/cv/');
    const data = JSON.parse(await load(chinese.file));
    const entry = { get: key => key === 'slug' ? chinese.name : key === 'data' ? { toJS: () => data } : undefined };
    assert.doesNotThrow(() => createConfig.validateEntry({ entry }));
  }
  for (const collection of ['publications', 'works']) {
    const files = config.collections.find(item => item.name === collection).files;
    assert.equal(files.length, 1);
    const items = files[0].fields.find(field => field.name === 'items');
    assert.ok(items.fields.some(field => field.name === 'titleZh'));
  }
});

test('a language switch saves a preference that takes precedence over geolocation at the homepage', async () => {
  const script = await load('main.js');
  const config = JSON.parse(await load('vercel.json'));
  const controllers = {};
  const noOp = () => {};
  const languageSwitch = {
    dataset: { language: 'zh' },
    addEventListener: (event, handler) => { controllers[event] = handler; },
  };
  const document = {
    querySelector: selector => {
      if (selector === '.language-switch') return languageSwitch;
      if (['.menu-toggle', '#site-navigation'].includes(selector)) return { addEventListener: noOp };
      return null;
    },
    addEventListener: noOp,
  };
  runInNewContext(script, {
    document, location: { protocol: 'https:' },
    window: { matchMedia: () => ({ addEventListener: noOp }), addEventListener: noOp },
  });
  const choose = language => {
    languageSwitch.dataset.language = language;
    controllers.click();
    assert.match(document.cookie, /Path=\/; SameSite=Lax; Secure$/);
    const [key, value] = document.cookie.split(';')[0].split('=');
    return { [key]: value };
  };
  const match = (path, country, cookies = {}) => config.redirects.find(rule => rule.source === path
    && (!rule.has || rule.has.every(({ type, key, value }) =>
      (type === 'cookie' ? cookies[key] : { 'x-vercel-ip-country': country }[key]) === value)));
  assert.equal(match('/', 'CN').destination, '/zh/');
  assert.equal(match('/', 'US').destination, '/en/');
  assert.equal(match('/', '').destination, '/en/');
  assert.equal(match('/', 'CN', choose('en')).destination, '/en/');
  assert.equal(match('/', 'US', choose('zh')).destination, '/zh/');
  assert.equal(match('/index.html', 'US').destination, '/');
  for (const path of ['/zh/', '/en/', '/zh/cv/', '/admin/', '/api/cms/callback']) {
    assert.equal(match(path, 'CN'), undefined, path);
  }
  assert.ok(config.redirects.every(rule => rule.permanent === false));
});
