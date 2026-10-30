import { createRequire } from 'node:module';
import { Marked } from '../vendor/marked/marked.esm.mjs';
import { escapeHtml as esc, fillPage } from './render.mjs';

export const pageFields = createRequire(import.meta.url)('../admin/page-fields.js');
const present = value => value !== null && value !== undefined && String(value).trim() !== '';
const textLines = value => esc(value).replace(/\r?\n/g, '<br>');

// This parser is used only during generation. User HTML is always escaped;
// images in text are rendered as alt text and links use a protocol allowlist.
export function safeTextLink(value) {
  const href = String(value ?? '').trim();
  if (!href || /[\u0000-\u0020\u007f\\]/.test(href) || href.startsWith('//')) return '';
  if (/^#[a-zA-Z][\w-]*$/.test(href)) return href;
  if (href.startsWith('/') && !href.startsWith('//')) {
    try {
      const decoded = decodeURIComponent(href);
      if (/[\u0000-\u0020\u007f\\]/.test(decoded) || decoded.startsWith('//')) return '';
      const url = new URL(href, 'https://local.invalid');
      return url.origin === 'https://local.invalid' ? url.pathname + url.search + url.hash : '';
    } catch { return ''; }
  }
  if (/^mailto:[^\s<>"@?]+@[^\s<>"@?]+\.[^\s<>"@?]+$/i.test(href)) return href;
  try {
    const url = new URL(href);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return href;
  } catch { return ''; }
}

const markdown = new Marked({
  gfm: false, breaks: false, async: false,
  renderer: {
    html({ text }) { return esc(text); },
    image({ text }) { return esc(text); },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const target = safeTextLink(href);
      if (!target) return label;
      const external = /^https?:/i.test(target) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${esc(target)}"${title ? ` title="${esc(title)}"` : ''}${external}>${label}</a>`;
    },
    heading({ depth, tokens }) {
      const level = Math.min(6, Math.max(3, depth));
      return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
    },
  },
});

export const richText = value => present(value) ? markdown.parse(String(value)) : '';
export const richInline = value => present(value) ? markdown.parseInline(String(value)) : '';
const visible = items => (items || []).filter(item => item.visible !== false);
const assetUrl = (value, prefix, label, type = 'image') => prefix + pageFields.assetPath(value, label, type);
const icon = path => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${path}</svg>`;
const icons = {
  location: icon('<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'),
  institution: icon('<path d="m3 8 9-5 9 5M3 9h18M5 10v9m5-9v9m4-9v9m5-9v9M3 21h18"/>'),
  wechat: icon('<path d="M14 13c0 4-6 5-9 4l-3 2 1-4C-1 8 6 3 11 6m11 9c0-3-3-5-6-5s-6 2-6 5 3 5 6 5h2l3 2-1-4c1-1 2-2 2-3Z"/>'),
  email: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>'),
  download: icon('<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>'),
  arrow: icon('<path d="M5 19 19 5M5 5h14v14"/>'),
};
const webLink = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;

export function navigationHtml(profile, prefix, current) {
  const entries = [['about', 'index.html', 'About Me'], ['publications', 'publications/index.html', 'Publications'], ['works', 'works/index.html', 'Works'], ['cv', 'cv/index.html', 'CV']];
  return `<header class="masthead"><nav class="navigation" aria-label="Main navigation"><a class="site-title" href="${prefix}index.html" aria-label="${esc(profile.name)} — About Me"><img class="site-logo" src="${prefix}assets/logo0722.svg" alt="${esc(profile.name)}" width="127" height="30"></a><button class="menu-toggle" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="site-navigation"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path class="menu-lines" d="M4 6h16M4 12h16M4 18h16"/><path class="menu-close" d="m6 6 12 12M6 18 18 6"/></svg></button><div class="nav-links" id="site-navigation">${entries.map(([id, path, label]) => `<a href="${prefix}${path}"${id === current ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</div></nav></header>`;
}

export function profileHtml(profile, prefix) {
  const contacts = [];
  if (profile.location) contacts.push(`<li>${icons.location}<span>${esc(profile.location)}</span></li>`);
  if (profile.institution) {
    const label = textLines(profile.institution);
    contacts.push(`<li>${icons.institution}${profile.institutionUrl ? webLink(profile.institutionUrl, label) : `<span>${label}</span>`}</li>`);
  }
  if (profile.wechatId || profile.wechatQr) contacts.push(`<li>${icons.wechat}<button class="text-button" id="wechat-open">WeChat</button></li>`);
  if (profile.email) contacts.push(`<li>${icons.email}<a href="mailto:${esc(profile.email)}">Email</a></li>`);
  if (profile.orcid) contacts.push(`<li><span class="brand-icon orcid" aria-hidden="true">iD</span>${webLink(profile.orcid, 'ORCID')}</li>`);
  if (profile.linkedin) contacts.push(`<li><span class="brand-icon linkedin" aria-hidden="true">in</span>${webLink(profile.linkedin, 'LinkedIn')}</li>`);
  return `<aside class="profile" aria-label="Profile and contact details">
<a href="${prefix}index.html" class="portrait-link" aria-label="${esc(profile.name)}, About Me"><img class="portrait" src="${esc(assetUrl(profile.portrait, prefix, '头像'))}" alt="${esc(profile.name)}" width="176" height="176"></a>
<div class="profile-copy"><a class="profile-name" href="${prefix}index.html">${esc(profile.name)}</a><p class="profile-role">${textLines(profile.role)}</p>
${contacts.length ? '<button class="contact-toggle" aria-expanded="false" aria-controls="contact-list">Contact</button>' : ''}<ul class="contact-list" id="contact-list">${contacts.join('\n')}</ul></div></aside>`;
}

export function footerHtml(profile) {
  return `<footer class="site-footer"><div>© ${new Date().getUTCFullYear()} ${esc(profile.name)}${profile.location ? ` <span class="footer-separator">·</span> ${esc(profile.location)}` : ''}</div>${profile.email ? `<a href="mailto:${esc(profile.email)}">Get in touch ${icons.arrow}</a>` : ''}</footer>`;
}

export function wechatHtml(profile, prefix) {
  if (!profile.wechatId && !profile.wechatQr) return '';
  return `<dialog id="wechat-dialog" aria-labelledby="wechat-title"><button class="dialog-close" aria-label="Close WeChat dialog">×</button><h2 id="wechat-title">Connect on WeChat</h2>${profile.wechatQr ? `<img src="${esc(assetUrl(profile.wechatQr, prefix, '微信二维码'))}" alt="Scan to add ${esc(profile.name)} on WeChat" width="260" height="300">` : ''}${profile.wechatId ? `<p>WeChat ID: <strong>${esc(profile.wechatId)}</strong></p><button id="wechat-copy" class="button">Copy WeChat ID</button>` : ''}<p id="copy-status" class="copy-status" role="status" aria-live="polite"></p></dialog>`;
}

export function aboutContent(data, profile) {
  pageFields.validateAbout(data);
  let html = `<h1>${esc(data.title)}</h1>\n${richText(data.body)}`;
  const skills = visible(data.skills);
  if (skills.length) html += `<section id="skills"><h2>${esc(data.skillsTitle)}</h2><dl class="skills-list">${skills.map(item => `<dt>${esc(item.title)}</dt><dd>${richInline(item.description)}</dd>`).join('\n')}</dl></section>\n`;
  const interests = visible(data.interests);
  if (interests.length) html += `<h2 id="research-interests">${esc(data.interestsTitle)}</h2><ul class="research-interests">${interests.map(item => `<li><strong>${esc(item.title)}</strong>${item.description ? `<br>${richInline(item.description)}` : ''}</li>`).join('\n')}</ul>\n`;
  if (data.exploreBody) html += `${data.exploreTitle ? `<h2>${esc(data.exploreTitle)}</h2>` : ''}${richText(data.exploreBody)}`;
  if (data.contactMessage && profile.email) html += `<p class="contact-note">${esc(data.contactMessage)} <a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>.</p>\n`;
  return html;
}

export function cvContent(data) {
  pageFields.validateCv(data);
  let html = `<h1>${esc(data.title)}</h1><div class="cv-intro">${data.intro ? `<p class="page-intro">${esc(data.intro)}</p>` : ''}`;
  if (data.pdf) html += `<a class="button download" href="${esc(assetUrl(data.pdf, '../', 'CV PDF', 'pdf'))}" target="_blank" rel="noopener noreferrer">${icons.download} ${esc(data.downloadLabel || 'Download CV')} <span>PDF</span></a>`;
  html += '</div>';
  const sections = ['education', 'research', 'projects', 'activities', 'achievements'].filter(key => {
    const section = data[key];
    return section.visible !== false && (key === 'achievements' ? (section.groups || []).some(group => visible(group.items).length) : visible(section.items).length);
  });
  if (sections.length) html += `<nav class="cv-toc" aria-label="CV sections">${sections.map(key => `<a href="#${key}">${esc(data[key].navigationLabel)}</a>`).join('')}</nav>`;
  for (const key of sections) {
    const section = data[key];
    html += `<section id="${key}"><h2>${esc(section.title)}</h2>`;
    if (key === 'achievements') {
      for (const group of section.groups || []) {
        const items = visible(group.items);
        if (!items.length) continue;
        html += `<h3 class="subsection-title">${esc(group.title)}</h3><ul class="award-list">${items.map(item => `<li><span class="award-year">${esc(item.date)}</span><div>${richText(item.body)}</div></li>`).join('')}</ul>`;
      }
    } else {
      for (const item of visible(section.items)) {
        html += `<article class="cv-entry"><div class="entry-heading"><h3>${esc(item.title)}</h3>${item.date ? `<span class="date">${esc(item.date)}</span>` : ''}</div>${item.subtitle ? `<p class="entry-subtitle">${richInline(item.subtitle)}</p>` : ''}${item.body ? `<div class="cv-entry-body">${richText(item.body)}</div>` : ''}</article>`;
      }
    }
    html += '</section>';
  }
  if (data.publicationsLink) html += `<div class="cv-publications-link">${richText(data.publicationsLink)}</div>`;
  return html;
}

export function sharedPage(template, profile, page, title, description) {
  pageFields.validateProfile(profile);
  const prefix = page === 'about' ? './' : '../';
  for (const [kind, content] of [
    ['NAVIGATION', navigationHtml(profile, prefix, page)],
    ['PROFILE', profileHtml(profile, prefix)],
    ['FOOTER', footerHtml(profile)],
    ['WECHAT', wechatHtml(profile, prefix)],
  ]) template = fillPage(template, kind, content);
  template = template.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)} - ${esc(profile.name)}</title>`);
  if (description !== undefined) template = template.replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${esc(description)}">`);
  return template;
}
