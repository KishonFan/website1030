import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, cp, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { richText, richInline, safeTextLink, aboutContent, cvContent, profileHtml, wechatHtml, pageFields } from '../lib/pages.mjs';
import { build } from '../scripts/build.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = async file => JSON.parse(await readFile(resolve(root, 'content', file + '.json'), 'utf8'));
const profile = await json('profile');
const about = await json('about');
const cv = await json('cv');
const createConfig = createRequire(import.meta.url)('../admin/schema.js');

test('existing rich content retains nested emphasis, links, paragraphs, lists and Chinese text', () => {
  const html = richText('**A [bold link](https://example.org/?a=1&b=2)** and *italic*.\n\n- First\n- 中文条目\n\n1. Ordered\n2. Next');
  assert.match(html, /<strong>A <a href="https:\/\/example.org\/\?a=1&amp;b=2"[^>]*>bold link<\/a><\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<ul>\n<li>First<\/li>/);
  assert.match(html, /中文条目/);
  assert.match(html, /<ol>/);
  assert.match(richInline('[Works](/works/index.html)'), /href="\/works\/index.html"/);
});

test('raw HTML, inline events, unsafe protocols and image syntax cannot execute in rendered text', () => {
  const html = richText('<script>alert(1)</script>\n\n<a href="javascript:alert(1)">raw</a>\n\n<img src=x onerror="alert(1)">\n\n[bad](javascript:alert%281%29) [data](data:text/html,test) [encoded](jav&#x61;script:alert%281%29) ![alt](https://evil.example/x.png)');
  assert.ok(!/<(?:script|img|a href="javascript:)/.test(html));
  assert.ok(!/href="(?:javascript|data|jav&)/i.test(html));
  assert.match(html, /&lt;script&gt;/);
  for (const href of ['//evil.test', '/%2f%2fevil.test', 'javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com', '/\\evil', 'https://example.com\n.test']) assert.equal(safeTextLink(href), '');
  assert.equal(safeTextLink('mailto:hello@example.com'), 'mailto:hello@example.com');
  assert.equal(safeTextLink('#education'), '#education');
});

test('CV migration keeps every existing entry, award group, grant, amount and requested emphasis', () => {
  assert.deepEqual(['education', 'research', 'projects', 'activities'].map(key => cv[key].items.length), [2, 3, 6, 3]);
  assert.deepEqual(cv.achievements.groups.map(group => group.items.length), [12, 9, 5]);
  const html = cvContent(cv);
  for (const text of ['xj2022118450867', 'Xj202111845739', 'pdjh2021a0152', '22SY0105', '2025GZGJ44', '2026A1515012303', 'CNY 20,000', 'CNY 10,000 per year', 'CNY 6,000']) assert.ok(html.includes(text), text);
  for (const text of ['National Scholarship', 'National Encouragement Scholarship', 'GDUT Elite Innovation Talent']) assert.ok(html.includes('<strong>' + text + '</strong>'));
  assert.match(html, /<strong>Outstanding Master/);
  assert.match(html, /<strong>Outstanding Bachelor/);
});

test('new and reordered About Me and CV entries appear immediately, while hidden sections lose their navigation link', () => {
  const nextAbout = structuredClone(about);
  nextAbout.interests.reverse();
  nextAbout.skills[0].visible = false;
  nextAbout.body = 'Updated **biography**.';
  const home = aboutContent(nextAbout, profile);
  assert.match(home, /Updated <strong>biography<\/strong>/);
  assert.ok(home.indexOf('AI-supported learning &amp; decision-making') < home.indexOf('Human–computer interaction &amp; human–AI collaboration'));
  assert.ok(!home.includes('<dt>Research methods</dt>'));
  const nextCv = structuredClone(cv);
  nextCv.projects.items.reverse();
  nextCv.research.visible = false;
  nextCv.education.items.unshift({ title: 'New qualification', body: '- New achievement', date: '2027', visible: true });
  const html = cvContent(nextCv);
  assert.ok(html.indexOf('New qualification') < html.indexOf('M.A. in Design Studies'));
  assert.ok(html.indexOf('2026A1515012303') < html.indexOf('xj2022118450867'));
  assert.ok(!html.includes('href="#research"'));
  assert.ok(!html.includes('id="research"'));
  nextCv.education.items = [];
  assert.ok(!cvContent(nextCv).includes('href="#education"'));
});

test('optional contact fields and PDF can be cleared without empty links or unusable controls', () => {
  const empty = { ...profile, email: '', location: '', institution: '', wechatId: '', wechatQr: '', orcid: '', linkedin: '' };
  const html = profileHtml(empty, '../');
  assert.ok(!html.includes('contact-toggle'));
  assert.ok(!html.includes('mailto:'));
  assert.equal(wechatHtml(empty, '../'), '');
  assert.ok(!aboutContent(about, empty).includes('contact-note'));
  assert.ok(!cvContent({ ...cv, pdf: '' }).includes('class="button download"'));
  assert.match(wechatHtml({ ...empty, wechatId: '<b>wechat</b>' }, '../'), /&lt;b&gt;wechat&lt;\/b&gt;/);
});

test('CMS page forms use the shipped richtext editor and validate new data before saving', async () => {
  const config = createConfig({ siteUrl: 'https://example.org', repository: 'owner/site', branch: 'main' });
  const newPages = config.collections.slice(0, 3);
  assert.deepEqual(newPages.map(page => page.name), ['profile', 'about', 'cv']);
  const types = new Set();
  const walk = fields => fields.forEach(field => { types.add(field.widget); if (field.widget === 'richtext') {
    assert.equal(field.sanitize_preview, true);
    assert.deepEqual(field.editor_components, []);
  } if (field.fields) walk(field.fields); });
  newPages.forEach(page => walk(page.files[0].fields));
  assert.ok(types.has('richtext'));
  const bundle = await readFile(resolve(root, 'vendor/decap-cms/decap-cms.js'), 'utf8');
  assert.ok(bundle.includes('name:"richtext"'));
  const makeEntry = (name, data) => ({ get: key => key === 'data' ? { toJS: () => data } : key === 'collection' ? name : undefined });
  for (const [name, data] of [['profile', profile], ['about', about], ['cv', cv]]) assert.doesNotThrow(() => createConfig.validateEntry({ entry: makeEntry(name, data) }));
  assert.throws(() => createConfig.validateEntry({ entry: makeEntry('profile', { ...profile, email: 'not email' }) }), /Email/);
  assert.throws(() => pageFields.validateProfile({ ...profile, linkedin: 'javascript:alert(1)' }));
  for (const path of ['/assets/../../secret.pdf', 'https://example.org/cv.pdf', '/assets/uploads/wrong.png']) assert.throws(() => pageFields.assetPath(path, 'CV', 'pdf'));
});

test('an actual rebuild updates all four profile sidebars, About Me, CV and a replacement PDF while preserving publications and works', async () => {
  const fixture = await mkdtemp(resolve(root, '.test-pages-'));
  const files = ['assets', 'admin', 'vendor/decap-cms', 'content', 'index.html', 'cv', 'publications', 'works', 'style.css', 'main.js'];
  try {
    for (const file of files) { await mkdir(dirname(resolve(fixture, file)), { recursive: true }); await cp(resolve(root, file), resolve(fixture, file), { recursive: true }); }
    const initial = await build(fixture);
    assert.deepEqual([initial.papers, initial.manuscripts, initial.works], [4, 3, 8]);
    const pubBefore = await readFile(resolve(fixture, 'public/publications/index.html'), 'utf8');
    const worksBefore = await readFile(resolve(fixture, 'public/works/index.html'), 'utf8');
    const next = { ...profile, name: 'New Researcher', role: 'Human–AI Research\nDesign', email: 'new@example.org', wechatId: 'New_ID', portrait: '/assets/uploads/new-photo.jpg' };
    await writeFile(resolve(fixture, 'content/profile.json'), JSON.stringify(next));
    await cp(resolve(fixture, 'assets/portrait.jpg'), resolve(fixture, 'assets/uploads/new-photo.jpg'));
    await writeFile(resolve(fixture, 'content/about.json'), JSON.stringify({ ...about, body: 'A newly published **introduction**.' }));
    const nextCv = structuredClone(cv);
    nextCv.pdf = '/assets/uploads/new-cv.pdf';
    nextCv.projects.items.unshift({ title: 'New funded project', subtitle: '**Principal Investigator** · 2027-A', body: '- New study', visible: true });
    await cp(resolve(fixture, 'assets/Jianxiong-Fan-CV.pdf'), resolve(fixture, 'assets/uploads/new-cv.pdf'));
    await writeFile(resolve(fixture, 'content/cv.json'), JSON.stringify(nextCv));
    await build(fixture);
    const contents = new Map();
    for (const file of ['index.html', 'cv/index.html', 'publications/index.html', 'works/index.html']) {
      const html = await readFile(resolve(fixture, 'public', file), 'utf8'); contents.set(file, html);
      assert.ok(html.includes('class="profile-name" href='));
      assert.ok(html.includes('>New Researcher</a>'));
      assert.ok(html.includes('new@example.org'));
      assert.ok(html.includes('assets/uploads/new-photo.jpg'));
      assert.ok(html.includes('New_ID'));
      assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    }
    assert.ok(contents.get('index.html').includes('newly published <strong>introduction</strong>'));
    assert.ok(contents.get('cv/index.html').includes('New funded project'));
    assert.ok(contents.get('cv/index.html').includes('../assets/uploads/new-cv.pdf'));
    const region = (html, key) => html.split(`<!-- CMS:${key}:START -->`)[1].split(`<!-- CMS:${key}:END -->`)[0];
    assert.equal(region(contents.get('publications/index.html'), 'PUBLICATIONS'), region(pubBefore, 'PUBLICATIONS'));
    assert.equal(region(contents.get('works/index.html'), 'WORKS'), region(worksBefore, 'WORKS'));
    await writeFile(resolve(fixture, 'content/cv.json'), JSON.stringify({ ...nextCv, pdf: '/assets/uploads/missing.pdf' }));
    await assert.rejects(build(fixture), /CV PDF file does not exist/);
  } finally {
    // Only remove the isolated directory created above, never a supplied path.
    assert.equal(dirname(fixture), root);
    assert.ok(basename(fixture).startsWith('.test-pages-'));
    await rm(fixture, { recursive: true, force: true });
  }
});
