import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicationContent, worksContent, fillPage, imagePath, journalIndex } from '../lib/render.mjs';
import { aboutContent, cvContent, sharedPage, pageFields } from '../lib/pages.mjs';
import { locales, pagePath, translated } from '../lib/locale.mjs';

const pageFiles = {
  about: 'index.html',
  publications: 'publications/index.html',
  works: 'works/index.html',
  cv: 'cv/index.html',
};

export async function build(root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), destination = resolve(root, 'public')) {
  const readContent = async name => JSON.parse(await readFile(resolve(root, 'content', name + '.json'), 'utf8'));
  const [publications, works, journals, profile, aboutEn, cvEn, aboutZh, cvZh] = await Promise.all(
    ['publications', 'works', 'journals', 'profile', 'about', 'cv', 'about.zh', 'cv.zh'].map(readContent),
  );
  pageFields.validateProfile(profile);
  const assets = [
    [profile.portrait, '头像', 'image'],
    [profile.wechatQr, '微信二维码', 'image'],
    [cvEn.pdf, 'CV PDF', 'pdf'],
    [cvZh.pdf, '中文 CV PDF', 'pdf'],
  ];
  for (const [value, label, type] of assets) {
    if (!value) continue;
    const path = pageFields.assetPath(value, label, type);
    try { await access(resolve(root, path)); }
    catch { throw new Error(`${label} file does not exist: ${value}`); }
  }
  const index = journalIndex(journals.items);
  const usedJournalIds = new Set(publications.items.filter(item => item.kind === 'published' && item.visible !== false).map(item => item.journalId).filter(Boolean));
  for (const id of usedJournalIds) {
    const journal = index.get(id);
    if (!journal?.cover) continue;
    try { await access(resolve(root, imagePath(journal.cover))); }
    catch { throw new Error(`Journal cover does not exist: ${journal.cover}`); }
  }
  for (const work of works.items.filter(item => item.visible !== false)) {
    try { await access(resolve(root, imagePath(work.image))); }
    catch { throw new Error(`Work cover does not exist: ${work.image}`); }
  }
  const templates = Object.fromEntries(await Promise.all(Object.entries(pageFiles).map(async ([page, file]) =>
    [page, await readFile(resolve(root, file), 'utf8')])));
  const output = new Map();
  let counts;
  for (const [locale, about, cv] of [[locales.en, aboutEn, cvEn], [locales.zh, aboutZh, cvZh]]) {
    const name = translated(profile, 'name', locale);
    const papers = publicationContent(publications.items, translated(publications, 'manuscriptNote', locale), journals.items, locale);
    const projects = worksContent(works.items, locale);
    const pages = {
      about: [about.title, about.description, aboutContent(about, profile, locale)],
      publications: [locale.pages.publications, locale.publications.description(name), papers.html],
      works: [locale.pages.works, locale.works.description(name), projects.html],
      cv: [cv.title, cv.description, cvContent(cv, locale)],
    };
    for (const [page, [title, description, html]] of Object.entries(pages)) {
      const shell = sharedPage(templates[page], profile, page, title, description || '', locale);
      const filled = fillPage(shell, page.toUpperCase(), html);
      output.set(pagePath(locale, page).slice(1) + 'index.html', filled);
      // Keep English pages at the previous URLs for existing links and bookmarks.
      if (locale.code === 'en') output.set(pageFiles[page], filled);
    }
    if (locale.code === 'en') counts = { papers: papers.papers, manuscripts: papers.manuscripts, works: projects.count };
  }

  await mkdir(destination, { recursive: true });
  for (const path of ['assets', 'style.css', 'main.js', 'admin', 'vendor/decap-cms']) {
    await cp(resolve(root, path), resolve(destination, path), { recursive: true, force: true });
  }
  for (const [file, html] of output) {
    const path = resolve(destination, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, html, 'utf8');
  }
  return { ...counts, destination };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then(result => console.log(`Built English and Chinese sites with ${result.papers} published articles, ${result.manuscripts} manuscripts, and ${result.works} works.`)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
