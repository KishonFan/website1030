import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicationContent, worksContent, fillPage, imagePath, journalIndex } from '../lib/render.mjs';

export async function build(root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), destination = resolve(root, 'public')) {
  const publications = JSON.parse(await readFile(resolve(root, 'content/publications.json'), 'utf8'));
  const works = JSON.parse(await readFile(resolve(root, 'content/works.json'), 'utf8'));
  const journals = JSON.parse(await readFile(resolve(root, 'content/journals.json'), 'utf8'));
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
  for (const path of ['index.html', 'cv', 'assets', 'style.css', 'main.js', 'admin', 'vendor']) {
    await cp(resolve(root, path), resolve(destination, path), { recursive: true, force: true });
  }
  for (const [page, result] of [['publications', papers], ['works', projects]]) {
    await mkdir(resolve(destination, page), { recursive: true });
    const template = await readFile(resolve(root, page, 'index.html'), 'utf8');
    await writeFile(resolve(destination, page, 'index.html'), fillPage(template, page.toUpperCase(), result.html), 'utf8');
  }
  return { papers: papers.papers, manuscripts: papers.manuscripts, works: projects.count, destination };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then(result => console.log(`Built ${result.papers} published articles, ${result.manuscripts} manuscripts, ${result.works} works.`)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
