import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicationContent, worksContent, fillPage, imagePath, journalIndex } from '../lib/render.mjs';
import { aboutContent, cvContent, sharedPage, pageFields } from '../lib/pages.mjs';

export async function build(root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), destination = resolve(root, 'public')) {
  const publications = JSON.parse(await readFile(resolve(root, 'content/publications.json'), 'utf8'));
  const works = JSON.parse(await readFile(resolve(root, 'content/works.json'), 'utf8'));
  const journals = JSON.parse(await readFile(resolve(root, 'content/journals.json'), 'utf8'));
  const profile = JSON.parse(await readFile(resolve(root, 'content/profile.json'), 'utf8'));
  const about = JSON.parse(await readFile(resolve(root, 'content/about.json'), 'utf8'));
  const cv = JSON.parse(await readFile(resolve(root, 'content/cv.json'), 'utf8'));
  pageFields.validateProfile(profile);
  const aboutHtml = aboutContent(about, profile);
  const cvHtml = cvContent(cv);
  for (const [value, label, type] of [[profile.portrait, '头像', 'image'], [profile.wechatQr, '微信二维码', 'image'], [cv.pdf, 'CV PDF', 'pdf']]) {
    if (!value) continue;
    const path = pageFields.assetPath(value, label, type);
    try { await access(resolve(root, path)); }
    catch { throw new Error(`${label} file does not exist: ${value}`); }
  }
  const papers = publicationContent(publications.items, publications.manuscriptNote || '', journals.items);
  const projects = worksContent(works.items);
  const index = journalIndex(journals.items);
  const usedJournalIds = new Set(publications.items.filter(item => item.kind === 'published' && item.visible !== false).map(item => item.journalId).filter(Boolean));
  for (const id of usedJournalIds) {
    const journal = index.get(id);
    if (!journal.cover) continue;
    try { await access(resolve(root, imagePath(journal.cover))); }
    catch { throw new Error(`Journal cover does not exist: ${journal.cover}`); }
  }
  for (const work of works.items.filter(item => item.visible !== false)) {
    try { await access(resolve(root, imagePath(work.image))); }
    catch { throw new Error(`Work cover does not exist: ${work.image}`); }
  }
  await mkdir(destination, { recursive: true });
  for (const path of ['assets', 'style.css', 'main.js', 'admin', 'vendor/decap-cms']) {
    await cp(resolve(root, path), resolve(destination, path), { recursive: true, force: true });
  }
  for (const [page, file, title, description, html] of [
    ['about', 'index.html', about.title, about.description || '', aboutHtml],
    ['cv', 'cv/index.html', cv.title, cv.description || '', cvHtml],
    ['publications', 'publications/index.html', 'Publications', undefined, papers.html],
    ['works', 'works/index.html', 'Works', undefined, projects.html],
  ]) {
    await mkdir(dirname(resolve(destination, file)), { recursive: true });
    let template = await readFile(resolve(root, file), 'utf8');
    template = fillPage(template, page.toUpperCase(), html);
    template = sharedPage(template, profile, page, title, description);
    await writeFile(resolve(destination, file), template, 'utf8');
  }
  return { papers: papers.papers, manuscripts: papers.manuscripts, works: projects.count, destination };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then(result => console.log(`Built ${result.papers} published articles, ${result.manuscripts} manuscripts, ${result.works} works.`)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
