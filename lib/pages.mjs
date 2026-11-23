import { createRequire } from 'node:module';
import { Marked } from '../vendor/marked/marked.esm.mjs';
import { escapeHtml as esc, fillPage } from './render.mjs';
import { locales, pagePath, translated } from './locale.mjs';

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

function localizeLink(target, locale) {
  if (!locale || !target.startsWith('/')) return target;
  const url = new URL(target, 'https://local.invalid');
  const path = url.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '');
  const page = path ? path.slice(1) : 'about';
  return Object.hasOwn(locale.pages, page) ? pagePath(locale, page) + url.search + url.hash : target;
}

function makeMarkdown(locale) {
  return new Marked({
    gfm: false, breaks: false, async: false,
    renderer: {
      html({ text }) { return esc(text); },
      image({ text }) { return esc(text); },
      link({ href, title, tokens }) {
        const label = this.parser.parseInline(tokens);
        const target = localizeLink(safeTextLink(href), locale);
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
}

const markdown = { default: makeMarkdown(), en: makeMarkdown(locales.en), zh: makeMarkdown(locales.zh) };
export const richText = (value, locale) => present(value) ? markdown[locale?.code || 'default'].parse(String(value)) : '';
export const richInline = (value, locale) => present(value) ? markdown[locale?.code || 'default'].parseInline(String(value)) : '';
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
  scholar: icon('<path d="m2 9 10-6 10 6-10 6-10-6Z"/><path d="M6 12v5c4 3 8 3 12 0v-5M22 9v8"/>'),
  link: icon('<path d="m10 13 4-4M8 16l-1 1a4.2 4.2 0 0 1-6-6l4-4a4.2 4.2 0 0 1 6 0m2 1 1-1a4.2 4.2 0 0 1 6 6l-4 4a4.2 4.2 0 0 1-6 0"/>'),
  website: icon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>'),
  github: icon('<path d="M9 19c-4 1-4-2-6-2m12 4v-3.9c0-1.1-.4-1.8-1-2.1 3.3-.4 6-1.7 6-6a4.7 4.7 0 0 0-1.3-3.3A4.5 4.5 0 0 0 18.6 2S17.4 1.6 15 3.3a11.2 11.2 0 0 0-6 0C6.6 1.6 5.4 2 5.4 2a4.5 4.5 0 0 0-.1 3.7A4.7 4.7 0 0 0 4 9c0 4.3 2.7 5.6 6 6-.6.3-1 1-1 2.1V21"/>'),
};
const webLink = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;

export function profileLinkIcon(link) {
  let kind = link.icon || 'auto';
  if (kind === 'auto') {
    const host = new URL(link.url).hostname.toLowerCase();
    if (/^scholar\.google\.(?:com(?:\.[a-z]{2})?|[a-z]{2}|co\.[a-z]{2})$/.test(host)) kind = 'scholar';
    else if (host === 'orcid.org' || host === 'www.orcid.org') kind = 'orcid';
    else if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) kind = 'linkedin';
    else if (host === 'github.com' || host === 'www.github.com') kind = 'github';
    else if (host === 'researchgate.net' || host.endsWith('.researchgate.net')) kind = 'researchgate';
    else kind = 'link';
  }
  if (kind === 'orcid') return '<span class="brand-icon orcid" aria-hidden="true">iD</span>';
  if (kind === 'linkedin') return '<span class="brand-icon linkedin" aria-hidden="true">in</span>';
  if (kind === 'researchgate') return '<span class="brand-icon" aria-hidden="true">RG</span>';
  return icons[kind] || icons.link;
}

export function navigationHtml(profile, prefix, current, locale = locales.en) {
  const name = esc(translated(profile, 'name', locale));
  const other = locale.code === 'zh' ? locales.en : locales.zh;
  const links = Object.entries(locale.pages).map(([id, label]) =>
    `<a href="${pagePath(locale, id)}"${id === current ? ' aria-current="page"' : ''}>${label}</a>`);
  return `<header class="masthead"><nav class="navigation" aria-label="${locale.mainNavigation}">
<a class="site-title" href="${pagePath(locale, 'about')}" aria-label="${name} — ${locale.pages.about}"><img class="site-logo" src="${prefix}assets/logo0722.svg" alt="${name}" width="127" height="30"></a>
<a class="language-switch" href="${pagePath(other, current)}" lang="${other.tag}" hreflang="${other.tag}" data-language="${other.code}">${other.name}</a>
<button class="menu-toggle" type="button" aria-label="${locale.openMenu}" aria-expanded="false" aria-controls="site-navigation" data-open-label="${locale.openMenu}" data-close-label="${locale.closeMenu}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path class="menu-lines" d="M4 6h16M4 12h16M4 18h16"/><path class="menu-close" d="m6 6 12 12M6 18 18 6"/></svg></button>
<div class="nav-links" id="site-navigation">${links.join('')}</div></nav></header>`;
}

export function profileHtml(profile, prefix, locale = locales.en) {
  pageFields.validateProfile(profile);
  const name = esc(translated(profile, 'name', locale));
  const home = pagePath(locale, 'about');
  const location = translated(profile, 'location', locale);
  const institution = translated(profile, 'institution', locale);
  const contacts = [];
  if (location) contacts.push(`<li>${icons.location}<span>${esc(location)}</span></li>`);
  if (institution) {
    const label = textLines(institution);
    contacts.push(`<li>${icons.institution}${profile.institutionUrl ? webLink(profile.institutionUrl, label) : `<span>${label}</span>`}</li>`);
  }
  if (profile.wechatId || profile.wechatQr) contacts.push(`<li>${icons.wechat}<button class="text-button" id="wechat-open">${locale.wechat}</button></li>`);
  if (profile.email) contacts.push(`<li>${icons.email}<a href="mailto:${esc(profile.email)}">${locale.email}</a></li>`);
  for (const link of visible(pageFields.profileLinks(profile))) {
    contacts.push(`<li>${profileLinkIcon(link)}${webLink(link.url, esc(translated(link, 'label', locale)))}</li>`);
  }
  const toggle = contacts.length ? `<button class="contact-toggle" aria-expanded="false" aria-controls="contact-list">${locale.contact}</button>` : '';
  return `<aside class="profile" aria-label="${locale.profile}">
<a href="${home}" class="portrait-link" aria-label="${name}, ${locale.pages.about}"><img class="portrait" src="${esc(assetUrl(profile.portrait, prefix, '头像'))}" alt="${name}" width="176" height="176"></a>
<div class="profile-copy"><a class="profile-name" href="${home}">${name}</a><p class="profile-role">${textLines(translated(profile, 'role', locale))}</p>
${toggle}<ul class="contact-list" id="contact-list">${contacts.join('\n')}</ul></div></aside>`;
}

export function footerHtml(profile, locale = locales.en) {
  const location = translated(profile, 'location', locale);
  const email = profile.email ? `<a href="mailto:${esc(profile.email)}">${locale.getInTouch} ${icons.arrow}</a>` : '';
  return `<footer class="site-footer"><div>© ${new Date().getUTCFullYear()} ${esc(translated(profile, 'name', locale))}${location ? ` <span class="footer-separator">·</span> ${esc(location)}` : ''}</div>${email}</footer>`;
}

export function wechatHtml(profile, prefix, locale = locales.en) {
  if (!profile.wechatId && !profile.wechatQr) return '';
  const qr = profile.wechatQr ? `<img src="${esc(assetUrl(profile.wechatQr, prefix, '微信二维码'))}" alt="${esc(locale.wechatScan(translated(profile, 'name', locale)))}" width="260" height="300">` : '';
  const id = profile.wechatId ? `<p>${locale.wechatId} <strong>${esc(profile.wechatId)}</strong></p><button id="wechat-copy" class="button">${locale.wechatCopy}</button>` : '';
  return `<dialog id="wechat-dialog" aria-labelledby="wechat-title" data-copy-success="${locale.wechatCopied}" data-copy-manually="${locale.wechatCopyManually}">
<button class="dialog-close" aria-label="${locale.wechatClose}">×</button><h2 id="wechat-title">${locale.wechatHeading}</h2>${qr}${id}<p id="copy-status" class="copy-status" role="status" aria-live="polite"></p></dialog>`;
}

export function aboutContent(data, profile, locale = locales.en) {
  pageFields.validateAbout(data);
  let html = `<h1>${esc(data.title)}</h1>\n${richText(data.body, locale)}`;
  const skills = visible(data.skills);
  if (skills.length) html += `<section id="skills"><h2>${esc(data.skillsTitle)}</h2><dl class="skills-list">${skills.map(item => `<dt>${esc(item.title)}</dt><dd>${richInline(item.description, locale)}</dd>`).join('\n')}</dl></section>\n`;
  const interests = visible(data.interests);
  if (interests.length) html += `<h2 id="research-interests">${esc(data.interestsTitle)}</h2><ul class="research-interests">${interests.map(item => `<li><strong>${esc(item.title)}</strong>${item.description ? `<br>${richInline(item.description, locale)}` : ''}</li>`).join('\n')}</ul>\n`;
  if (data.exploreBody) html += `${data.exploreTitle ? `<h2>${esc(data.exploreTitle)}</h2>` : ''}${richText(data.exploreBody, locale)}`;
  if (data.contactMessage && profile.email) html += `<p class="contact-note">${esc(data.contactMessage)} <a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>${locale.fullStop}</p>\n`;
  return html;
}

export function cvContent(data, locale = locales.en) {
  pageFields.validateCv(data);
  let html = `<h1>${esc(data.title)}</h1><div class="cv-intro">${data.intro ? `<p class="page-intro">${esc(data.intro)}</p>` : ''}`;
  if (data.pdf) html += `<a class="button download" href="${esc(assetUrl(data.pdf, '/', 'CV PDF', 'pdf'))}" target="_blank" rel="noopener noreferrer">${icons.download} ${esc(data.downloadLabel || locale.downloadCv)} <span>PDF</span></a>`;
  html += '</div>';
  const sections = ['education', 'research', 'projects', 'activities', 'achievements'].filter(key => {
    const section = data[key];
    return section.visible !== false && (key === 'achievements' ? (section.groups || []).some(group => visible(group.items).length) : visible(section.items).length);
  });
  if (sections.length) html += `<nav class="cv-toc" aria-label="${locale.cvSections}">${sections.map(key => `<a href="#${key}">${esc(data[key].navigationLabel)}</a>`).join('')}</nav>`;
  for (const key of sections) {
    const section = data[key];
    html += `<section id="${key}"><h2>${esc(section.title)}</h2>`;
    if (key === 'achievements') {
      for (const group of section.groups || []) {
        const items = visible(group.items);
        if (!items.length) continue;
        html += `<h3 class="subsection-title">${esc(group.title)}</h3><ul class="award-list">${items.map(item => `<li><span class="award-year">${esc(item.date)}</span><div>${richText(item.body, locale)}</div></li>`).join('')}</ul>`;
      }
    } else {
      for (const item of visible(section.items)) {
        html += `<article class="cv-entry"><div class="entry-heading"><h3>${esc(item.title)}</h3>${item.date ? `<span class="date">${esc(item.date)}</span>` : ''}</div>${item.subtitle ? `<p class="entry-subtitle">${richInline(item.subtitle, locale)}</p>` : ''}${item.body ? `<div class="cv-entry-body">${richText(item.body, locale)}</div>` : ''}</article>`;
      }
    }
    html += '</section>';
  }
  if (data.publicationsLink) html += `<div class="cv-publications-link">${richText(data.publicationsLink, locale)}</div>`;
  return html;
}

export function sharedPage(template, profile, page, title, description, locale = locales.en) {
  const origin = 'https://www.jianxiongfan.cn';
  template = template
    .replace(/<html lang="[^"]*">/, `<html lang="${locale.tag}">`)
    .replace(/(<a class="skip-link" href="#main">)[^<]*/, (_, start) => start + locale.skip)
    .replace(/href="\.\.?\/assets\/favicon\.svg"/, 'href="/assets/favicon.svg"')
    .replace(/href="\.\.?\/style\.css[^"]*"/, 'href="/style.css?v=20261117-bilingual"')
    .replace(/src="\.\.?\/main\.js[^"]*"/, 'src="/main.js?v=20261117-bilingual"');
  if (page === 'publications' || page === 'works') template = template.replace(/<h1>[^<]*<\/h1>/, () => `<h1>${esc(title)}</h1>`);
  const canonical = `<link rel="canonical" href="${origin}${pagePath(locale, page)}">`;
  const alternates = Object.values(locales).map(language =>
    `<link rel="alternate" hreflang="${language.tag}" href="${origin}${pagePath(language, page)}">`);
  alternates.push(`<link rel="alternate" hreflang="x-default" href="${origin}${pagePath(locales.en, page)}">`);
  template = template.replace('</head>', `\n${[canonical, ...alternates].join('\n')}\n</head>`);
  for (const [kind, content] of [
    ['NAVIGATION', navigationHtml(profile, '/', page, locale)],
    ['PROFILE', profileHtml(profile, '/', locale)],
    ['FOOTER', footerHtml(profile, locale)],
    ['WECHAT', wechatHtml(profile, '/', locale)],
  ]) template = fillPage(template, kind, content);
  template = template.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)} - ${esc(translated(profile, 'name', locale))}</title>`);
  if (description !== undefined) template = template.replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${esc(description)}">`);
  return template;
}
