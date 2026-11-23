import { locales, translated } from './locale.mjs';

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

const hasValue = value => value !== null && value !== undefined && String(value).trim() !== '';

export function keywordList(value) {
  if (value === null || value === undefined || value === '') return [];
  const items = typeof value === 'string' ? value.split(/[,;，；\n]/) : value;
  if (!Array.isArray(items) || items.some(item => typeof item !== 'string')) throw new Error('Keywords must be a list of text labels.');
  return [...new Set(items.map(item => item.trim()).filter(Boolean))];
}

export function journalIndex(records = []) {
  if (!Array.isArray(records)) throw new Error('Journal records must be a list.');
  const index = new Map();
  for (const journal of records) {
    const name = requiredText(journal, 'name', 'Journal');
    const id = requiredText(journal, 'id', name);
    if (!/^[a-z0-9-]+$/.test(id) || index.has(id)) throw new Error(`${name}: journal IDs must be unique lowercase identifiers.`);
    if (journal.cover) imagePath(journal.cover);
    for (const field of ['url', 'metricsUrl']) if (journal[field]) webUrl(journal[field], `${name}: ${field}`);
    for (const field of ['impactFactorYear', 'jcrYear']) {
      if (hasValue(journal[field]) && (!Number.isInteger(Number(journal[field])) || Number(journal[field]) < 1900 || Number(journal[field]) > 2200)) throw new Error(`${name}: ${field} must be a valid reporting year.`);
    }
    if (hasValue(journal.impactFactor)) {
      if (!Number.isFinite(Number(journal.impactFactor)) || Number(journal.impactFactor) < 0) throw new Error(`${name}: impact factor must be a non-negative number.`);
      if (!hasValue(journal.impactFactorYear)) throw new Error(`${name}: specify the impact factor reporting year.`);
    }
    if (journal.jcrQuartile && !/^Q[1-4]$/.test(journal.jcrQuartile)) throw new Error(`${name}: choose JCR Q1, Q2, Q3 or Q4.`);
    if (journal.jcrBasis && !['best', 'category', 'reported'].includes(journal.jcrBasis)) throw new Error(`${name}: choose a valid JCR reporting basis.`);
    if (journal.jcrQuartile && journal.jcrBasis === 'category' && !String(journal.jcrCategory || '').trim()) throw new Error(`${name}: a category-specific JCR quartile needs its category.`);
    index.set(id, journal);
  }
  return index;
}

function journalMetrics(journal, labels) {
  if (!journal) return '';
  const metrics = [];
  if (journal.jcrQuartile) {
    const best = journal.jcrBasis === 'best';
    const category = journal.jcrBasis === 'category';
    const label = `${journal.indexing ? journal.indexing + ' · ' : ''}${labels.jcr(journal.jcrQuartile, best)}`;
    const detail = [journal.jcrYear, category && journal.jcrCategory].filter(Boolean).join(' · ');
    const title = best ? labels.bestQuartile : (category ? journal.jcrCategory : labels.quartile);
    metrics.push(`<span class="journal-metric" title="${escapeHtml(title)}">${escapeHtml(label)}${detail ? ` <span class="metric-year">(${escapeHtml(detail)})</span>` : ''}</span>`);
  }
  if (hasValue(journal.impactFactor)) {
    const value = Number(journal.impactFactor).toFixed(1);
    metrics.push(`<span class="journal-metric">${labels.impact} ${value} <span class="metric-year">(${Number(journal.impactFactorYear)})</span></span>`);
  }
  if (!metrics.length) return '';
  return `<div class="journal-metrics" aria-label="${labels.journalMetrics}">${metrics.join('')}</div>`;
}

function journalCover(journal, labels) {
  if (!journal?.cover) return '';
  const image = `<img src="/${escapeHtml(imagePath(journal.cover))}" alt="${escapeHtml(labels.journalCover(journal.name))}" width="116" height="160" loading="lazy" decoding="async">`;
  const cover = journal.url ? `<a href="${escapeHtml(webUrl(journal.url, 'Journal homepage'))}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(labels.visitJournal(journal.name))}">${image}</a>` : image;
  return `<figure class="journal-cover">${cover}</figure>`;
}

const statusesZh = new Map([
  ['in preparation', '撰写中'], ['submitted', '已投稿'], ['under review', '审稿中'],
  ['revision requested', '待修回'], ['major revision', '大修'], ['minor revision', '小修'],
  ['revised', '已修回'], ['accepted', '已接收'], ['in press', '待刊'],
]);

function manuscriptStatus(record, locale) {
  if (locale.code !== 'zh') return record.status;
  const override = translated(record, 'status', locale);
  if (override !== record.status) return override;
  return statusesZh.get(String(record.status ?? '').trim().toLowerCase()) || record.status;
}

function publicationTitle(record, target, locale) {
  const display = translated(record, 'title', locale);
  const title = escapeHtml(display);
  const heading = target ? link(target, title) : title;
  const original = display === record.title ? '' : `<p class="original-title" lang="en">${escapeHtml(record.title)}</p>`;
  return `<h3>${heading}</h3>${original}`;
}

export function publicationContent(records, note = '', journals = null, locale = locales.en) {
  if (!Array.isArray(records)) throw new Error('Publications items must be a list.');
  const index = journalIndex(journals || []);
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
    if (record.kind === 'published') {
      keywordList(record.keywords);
      keywordList(record.keywordsZh);
      if (journals && record.journalId && !index.has(record.journalId)) throw new Error(`${title}: the selected journal does not exist.`);
    }
  }
  const papers = visible.filter(record => record.kind === 'published');
  const manuscripts = visible.filter(record => record.kind === 'manuscript');
  const years = [...new Set(papers.map(record => Number(record.year)))].sort((a, b) => b - a);
  const labels = locale.publications;
  let html = `<p class="page-intro">${labels.intro}</p>\n`;
  html += `<h2>${labels.published} <span class="count">${papers.length}</span></h2>\n`;
  for (const year of years) {
    html += `<h3 class="year-heading">${year}</h3>\n<ol class="publication-list">\n`;
    for (const record of papers.filter(item => Number(item.year) === year)) {
      const doi = String(record.doi ?? '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
      const target = doi ? `https://doi.org/${doi}` : (record.url ? webUrl(record.url, 'Publication link') : '');
      const journal = index.get(record.journalId);
      const cover = journalCover(journal, labels);
      html += `<li class="publication publication--published${cover ? ' has-journal-cover' : ''}"><div class="publication-copy">${publicationTitle(record, target, locale)}<p>${authorHtml(record.authors)} (${year}).</p>`;
      if (record.venue) html += `<p><em>${escapeHtml(record.venue)}</em></p>`;
      html += journalMetrics(journal, labels);
      const keywordsZh = locale.code === 'zh' ? keywordList(record.keywordsZh) : [];
      const keywords = keywordsZh.length ? keywordsZh : keywordList(record.keywords);
      if (keywords.length) html += `<ul class="paper-keywords" aria-label="${labels.keywords}">${keywords.map(keyword => `<li>${escapeHtml(keyword)}</li>`).join('')}</ul>`;
      const links = [];
      if (target) links.push(link(target, (doi ? 'DOI ' : labels.read + ' ') + arrow));
      if (journal?.metricsUrl && (journal.jcrQuartile || hasValue(journal.impactFactor))) links.push(link(webUrl(journal.metricsUrl, 'Journal metrics source'), labels.journalMetrics + ' ' + arrow));
      if (links.length) html += `<p class="paper-links">${links.join('')}</p>`;
      html += `</div>${cover}</li>\n`;
    }
    html += '</ol>\n';
  }
  html += `<h2 id="manuscripts">${labels.manuscripts} <span class="count">${manuscripts.length}</span></h2>\n`;
  if (note) html += `<p class="section-note">${escapeHtml(note)}</p>\n`;
  html += '<ol class="publication-list manuscripts">\n';
  for (const record of manuscripts) {
    const target = record.url ? webUrl(record.url, 'Manuscript link') : '';
    const status = manuscriptStatus(record, locale);
    html += `<li class="publication">${publicationTitle(record, target, locale)}<p>${authorHtml(record.authors)}</p>`;
    if (status || record.venue) html += `<p class="manuscript-status">${status ? `<span>${escapeHtml(status)}</span>` : ''}${status && record.venue ? ' · ' : ''}${record.venue ? `<em>${escapeHtml(record.venue)}</em>` : ''}</p>`;
    html += '</li>\n';
  }
  return { html: html + '</ol>\n', papers: papers.length, manuscripts: manuscripts.length };
}

export function worksContent(records, locale = locales.en) {
  if (!Array.isArray(records)) throw new Error('Works items must be a list.');
  const visible = records.filter(record => record.visible !== false);
  let html = `<p class="page-intro">${locale.works.intro}</p>\n<div class="works-grid">\n`;
  visible.forEach((record, index) => {
    requiredText(record, 'title', 'Work');
    const title = translated(record, 'title', locale);
    const url = webUrl(translated(record, 'url', locale), `${title}: Notion or portfolio link`);
    const image = imagePath(record.image);
    html += `<article class="work-card"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><div class="work-cover"><img src="/${escapeHtml(image)}" alt="${escapeHtml(locale.works.cover(title))}" ${index > 2 ? 'loading="lazy" ' : ''}width="600" height="380"></div><div class="work-caption"><span class="work-tag">${escapeHtml(translated(record, 'tag', locale))}</span><h2>${escapeHtml(title)} <span aria-hidden="true">↗</span></h2></div></a></article>\n`;
  });
  html += `</div>\n<p class="section-note works-note">${locale.works.note}</p>\n`;
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
