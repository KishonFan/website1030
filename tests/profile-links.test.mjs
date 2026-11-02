import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { profileHtml, profileLinkIcon, sharedPage, pageFields } from '../lib/pages.mjs';

const createConfig = createRequire(import.meta.url)('../admin/schema.js');
const profile = JSON.parse(await readFile(new URL('../content/profile.json', import.meta.url), 'utf8'));
const scholar = 'https://scholar.google.com/citations?hl=zh-CN&user=GCnpjpoAAAAJ';

test('Google Scholar and the original ORCID and LinkedIn destinations are present once on every public page', async () => {
  assert.deepEqual(profile.links.map(link => link.label), ['Google Scholar', 'ORCID', 'LinkedIn']);
  assert.equal(profile.links[0].url, scholar);
  for (const [page, path] of [['about', '../index.html'], ['publications', '../publications/index.html'], ['works', '../works/index.html'], ['cv', '../cv/index.html']]) {
    const template = await readFile(new URL(path, import.meta.url), 'utf8');
    const rendered = sharedPage(template, profile, page, page);
    for (const link of profile.links) {
      const escapedUrl = link.url.replaceAll('&', '&amp;');
      assert.equal(rendered.split(`href="${escapedUrl}"`).length - 1, 1, `${page}: ${link.label}`);
    }
    assert.ok(rendered.indexOf('>Email</a>') < rendered.indexOf('>Google Scholar</a>'));
    assert.ok(rendered.indexOf('>Google Scholar</a>') < rendered.indexOf('>ORCID</a>'));
  }
});

test('new profile links can be added, reordered, hidden and deleted without changing the renderer', () => {
  const next = structuredClone(profile);
  next.links = [
    { label: 'Another profile', url: 'https://example.org/profile?year=2027', icon: 'auto' },
    next.links[2],
    { ...next.links[0], visible: false },
  ];
  let html = profileHtml(next, '../');
  assert.ok(html.indexOf('>Another profile</a>') < html.indexOf('>LinkedIn</a>'));
  assert.ok(!html.includes(scholar.replaceAll('&', '&amp;')));
  assert.ok(!html.includes('>ORCID</a>'));
  next.links[2].visible = true;
  html = profileHtml(next, '../');
  assert.ok(html.includes('>Google Scholar</a>'));
  next.links = [];
  html = profileHtml(next, '../');
  assert.ok(!html.includes('>Google Scholar</a>'));
  assert.ok(!html.includes('>LinkedIn</a>'));
  assert.ok(html.includes('id="wechat-open"'));
  assert.ok(html.includes('>Email</a>'));
});

test('old profile files remain compatible and an empty new list does not resurrect deleted legacy links', () => {
  const legacy = { ...profile, orcid: 'https://orcid.org/0009-0006-9184-7654', linkedin: 'https://www.linkedin.com/in/jianxiongfan/' };
  delete legacy.links;
  assert.ok(profileHtml(legacy, './').includes('>ORCID</a>'));
  assert.ok(profileHtml(legacy, './').includes('>LinkedIn</a>'));
  for (const links of [[], null]) {
    assert.ok(!profileHtml({ ...legacy, links }, './').includes('>ORCID</a>'));
    assert.ok(!profileHtml({ ...legacy, links }, './').includes('>LinkedIn</a>'));
  }
});

test('CMS validates link labels and ordinary web URLs before publishing; generated labels cannot inject HTML', () => {
  const makeEntry = data => ({ get: key => key === 'data' ? { toJS: () => data } : key === 'collection' ? 'profile' : undefined });
  assert.doesNotThrow(() => createConfig.validateEntry({ entry: makeEntry(profile) }));
  for (const link of [
    { label: '', url: scholar },
    { label: 'Incomplete', url: '' },
    { label: 'Script', url: 'javascript:alert(1)' },
    { label: 'Data', url: 'data:text/html,test' },
    { label: 'Credentials', url: 'https://user:pass@example.org' },
    { label: 'Unrecognised icon', url: scholar, icon: '<img src=x>' },
  ]) assert.throws(() => createConfig.validateEntry({ entry: makeEntry({ ...profile, links: [link] }) }));
  const html = profileHtml({ ...profile, links: [{ label: '<img src=x onerror=alert(1)>', url: scholar }] }, './');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img src=x'));
});

test('the new CMS list supports creation, removal, reordering, visibility and automatically recognised platform icons', () => {
  const config = createConfig({ siteUrl: 'https://website1030.vercel.app', repository: 'KishonFan/website1030', branch: 'main' });
  const fields = config.collections.find(collection => collection.name === 'profile').files[0].fields;
  const links = fields.find(field => field.name === 'links');
  assert.equal(links.widget, 'list');
  assert.deepEqual(links.fields.map(field => field.name), ['label', 'url', 'icon', 'visible']);
  assert.ok(!fields.some(field => ['orcid', 'linkedin'].includes(field.name)));
  assert.match(profileLinkIcon({ url: scholar }), /<svg/);
  assert.match(profileLinkIcon({ url: 'https://orcid.org/a' }), /brand-icon orcid/);
  assert.match(profileLinkIcon({ url: 'https://www.linkedin.com/in/test' }), /brand-icon linkedin/);
  assert.match(profileLinkIcon({ url: 'https://github.com/test' }), /<svg/);
  assert.ok(!profileLinkIcon({ url: 'https://linkedin.com.fake.test/in/test' }).includes('brand-icon linkedin'));
  assert.ok(!profileLinkIcon({ url: 'https://example.org', icon: 'website' }).includes('brand-icon'));
  assert.doesNotThrow(() => pageFields.validateProfile({ ...profile, links: null }));
});
