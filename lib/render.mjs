export function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function webUrl(value, label, optional = false) {
  const text = String(value ?? '').trim();
  if (!text && optional) return '';
  let url;
  try { url = new URL(text); } catch { throw new Error(`${label} must be a complete https:// or http:// URL.`); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${label} must be an ordinary web URL without credentials.`);
  }
  return text;
}

export function imagePath(value) {
  const text = String(value ?? '').trim().replace(/^\.\.\//, '').replace(/^\//, '');
  if (!/^assets\/[a-zA-Z0-9\u0080-\uFFFF._/ -]+$/.test(text) || text.split('/').some(part => part === '..' || part === '.')) {
    throw new Error('Work cover must be an image inside assets/.');
  }
  return text;
}

export function authorHtml(value) {
  return escapeHtml(value).replaceAll('Jianxiong Fan', '<strong>Jianxiong Fan</strong>');
}

const arrow = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
const link = (url, label) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;

function requiredText(record, key, label) {
  if (typeof record[key] !== 'string' || !record[key].trim()) throw new Error(`${label}: ${key} is required.`);
  return record[key].trim();
}

export function publicationContent(records, note = '') {
  if (!Array.isArray(records)) throw new Error('Publications items must be a list.');
  const visible = records.filter(record => record.visible !== false);
  for (const record of visible) {
    const title = requiredText(record, 'title', 'Publication');
    requiredText(record, 'authors', title);
    if (!['published', 'manuscript'].includes(record.kind)) throw new Error(`${title}: choose published or manuscript.`);
    if (record.kind === 'published' && (!Number.isInteger(Number(record.year)) || Number(record.year) < 1900 || Number(record.year) > 2200)) {
      throw new Error(`${title}: a published article needs a valid year.`);
    }
    if (record.doi) {
      const doi = String(record.doi).trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
      if (!/^10\.\d{4,9}\/\S+$/i.test(doi)) throw new Error(`${title}: DOI is not valid.`);
    }
    if (record.url) webUrl(record.url, `${title}: link`);
  }
  const papers = visible.filter(record => record.kind === 'published');
  const manuscripts = visible.filter(record => record.kind === 'manuscript');
  const years = [...new Set(papers.map(record => Number(record.year)))].sort((a, b) => b - a);
  let html = '<p class="page-intro">Research on human–computer interaction, learning, and creative thinking.</p>\n';
  html += `<h2>Published Journal Articles <span class="count">${papers.length}</span></h2>\n`;
  for (const year of years) {
    html += `<h3 class="year-heading">${year}</h3>\n<ol class="publication-list">\n`;
    for (const record of papers.filter(item => Number(item.year) === year)) {
      const doi = String(record.doi ?? '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
      const target = doi ? `https://doi.org/${doi}` : (record.url ? webUrl(record.url, 'Publication link') : '');
      const title = target ? link(target, escapeHtml(record.title)) : escapeHtml(record.title);
      html += `<li class="publication"><h3>${title}</h3><p>${authorHtml(record.authors)} (${year}).</p>`;
      if (record.venue) html += `<p><em>${escapeHtml(record.venue)}</em></p>`;
      if (target) html += `<p class="paper-links">${link(target, (doi ? 'DOI ' : 'Read more ') + arrow)}</p>`;
      html += '</li>\n';
    }
    html += '</ol>\n';
  }
  html += `<h2 id="manuscripts">Manuscripts <span class="count">${manuscripts.length}</span></h2>\n`;
  if (note) html += `<p class="section-note">${escapeHtml(note)}</p>\n`;
  html += '<ol class="publication-list manuscripts">\n';
  for (const record of manuscripts) {
    const title = record.url ? link(webUrl(record.url, 'Manuscript link'), escapeHtml(record.title)) : escapeHtml(record.title);
    html += `<li class="publication"><h3>${title}</h3><p>${authorHtml(record.authors)}</p>`;
    if (record.status || record.venue) html += `<p class="manuscript-status">${record.status ? `<span>${escapeHtml(record.status)}</span>` : ''}${record.status && record.venue ? ' · ' : ''}${record.venue ? `<em>${escapeHtml(record.venue)}</em>` : ''}</p>`;
    html += '</li>\n';
  }
  return { html: html + '</ol>\n', papers: papers.length, manuscripts: manuscripts.length };
}

export function worksContent(records) {
  if (!Array.isArray(records)) throw new Error('Works items must be a list.');
  const visible = records.filter(record => record.visible !== false);
  let html = '<p class="page-intro">Selected projects in interaction design, immersive experiences, and digital media.</p>\n<div class="works-grid">\n';
  visible.forEach((record, index) => {
    const title = requiredText(record, 'title', 'Work');
    const url = webUrl(record.url, `${title}: Notion or portfolio link`);
    const image = imagePath(record.image);
    html += `<article class="work-card"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><div class="work-cover"><img src="../${escapeHtml(image)}" alt="${escapeHtml(title)} project cover" ${index > 2 ? 'loading="lazy" ' : ''}width="600" height="380"></div><div class="work-caption"><span class="work-tag">${escapeHtml(record.tag)}</span><h2>${escapeHtml(title)} <span aria-hidden="true">↗</span></h2></div></a></article>\n`;
  });
  html += '</div>\n<p class="section-note works-note">Each project opens its original portfolio page or video.</p>\n';
  return { html, count: visible.length };
}

export function fillPage(template, kind, html) {
  const start = `<!-- CMS:${kind}:START -->`;
  const end = `<!-- CMS:${kind}:END -->`;
  const first = template.indexOf(start);
  const last = template.indexOf(end);
  if (first < 0 || last < first || template.indexOf(start, first + start.length) !== -1) {
    throw new Error(`${kind} page is missing its unique content markers.`);
  }
  return template.slice(0, first + start.length) + '\n' + html + template.slice(last);
}
