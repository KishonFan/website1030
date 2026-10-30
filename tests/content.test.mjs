import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { publicationContent, worksContent, fillPage, imagePath } from '../lib/render.mjs';
const createConfig = createRequire(import.meta.url)('../admin/schema.js');
const records = JSON.parse(await readFile(new URL('../content/publications.json', import.meta.url), 'utf8'));
const works = JSON.parse(await readFile(new URL('../content/works.json', import.meta.url), 'utf8'));

test('existing repository content retains its four papers, three manuscripts and eight original work destinations', () => {
  const result = publicationContent(records.items);
  assert.equal(result.papers, 4);
  assert.equal(result.manuscripts, 3);
  assert.equal(worksContent(works.items).count, 8);
  assert.ok(records.items.some(item => item.authors.includes('Shuwei Huang')));
  for (const work of works.items) assert.ok(worksContent(works.items).html.includes(work.url.replaceAll('&', '&amp;')));
});

test('a new year appears automatically and a manuscript can become a paper without duplicate sections or fixed counts', () => {
  const items = structuredClone(records.items);
  const manuscript = items.find(item => item.kind === 'manuscript');
  manuscript.kind = 'published';
  manuscript.year = 2027;
  const result = publicationContent(items);
  assert.equal(result.papers, 5);
  assert.equal(result.manuscripts, 2);
  assert.ok(result.html.indexOf('year-heading">2027') < result.html.indexOf('year-heading">2026'));
  assert.equal(result.html.split(manuscript.title).length - 1, 1);
});

test('hiding items removes them from both the page and its counts; reordering works preserves the new array order', () => {
  const items = structuredClone(records.items);
  items[0].visible = false;
  const result = publicationContent(items);
  assert.equal(result.papers, 3);
  assert.ok(!result.html.includes(items[0].title));
  const reordered = [works.items[7], works.items[0]];
  const html = worksContent(reordered).html;
  assert.ok(html.indexOf('Sea Home') < html.indexOf('Driving School'));
});

test('CMS input cannot inject markup, script URLs or file-system traversal into public pages', () => {
  const item = { ...records.items[0], title: '<script>alert(1)</script>', authors: 'Jianxiong Fan <img src=x onerror=alert(1)>' };
  const html = publicationContent([item]).html;
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.throws(() => publicationContent([{ ...item, doi: '', url: 'javascript:alert(1)' }]));
  assert.throws(() => worksContent([{ ...works.items[0], url: 'data:text/html,test' }]));
  assert.throws(() => imagePath('/assets/../../.env'));
  assert.throws(() => imagePath('https://example.com/image.jpg'));
});

test('a published paper without a year fails the build instead of silently disappearing', () => {
  assert.throws(() => publicationContent([{ ...records.items[0], year: null }]), /valid year/);
});

test('page generation preserves the surrounding shell and refuses missing markers', () => {
  const template = '<header>same</header><!-- CMS:WORKS:START -->old<!-- CMS:WORKS:END --><footer>same</footer>';
  const filled = fillPage(template, 'WORKS', 'new');
  assert.ok(filled.startsWith('<header>same</header>'));
  assert.ok(filled.endsWith('<footer>same</footer>'));
  assert.ok(!filled.includes('old'));
  assert.throws(() => fillPage('<main>no markers</main>', 'WORKS', 'new'));
});

test('CMS connects all six editable files to the supplied production repository and existing uploads', () => {
  const config = createConfig({ siteUrl: 'https://website1030.vercel.app', repository: 'KishonFan/website1030', branch: 'main' });
  assert.equal(config.backend.repo, 'KishonFan/website1030');
  assert.equal(config.backend.branch, 'main');
  assert.deepEqual(config.collections.map(collection => collection.files[0].file), ['content/profile.json', 'content/about.json', 'content/cv.json', 'content/publications.json', 'content/works.json', 'content/journals.json']);
  assert.equal(config.media_folder, 'assets/uploads');
  assert.equal(config.load_config_file, false);
});

test('the editor blocks missing years and invalid links before a record can be committed', () => {
  const entry = item => ({ get: key => key === 'data' ? { get: field => field === 'items' ? { toJS: () => [item] } : undefined } : undefined });
  assert.throws(() => createConfig.validateEntry({ entry: entry({ kind: 'published', year: null }) }), /年份/);
  assert.throws(() => createConfig.validateEntry({ entry: entry({ kind: 'manuscript', url: 'javascript:alert(1)' }) }), /网页地址/);
  assert.throws(() => createConfig.validateEntry({ entry: entry({ kind: 'manuscript', doi: 'not-a-doi' }) }), /DOI/);
  assert.doesNotThrow(() => createConfig.validateEntry({ entry: entry({ kind: 'published', year: 2027, doi: '10.1234/example' }) }));
});
