const menuToggle = document.querySelector('.menu-toggle');
const siteNavigation = document.querySelector('#site-navigation');
const mobileNavigation = window.matchMedia('(max-width: 760px)');

function setMenuOpen(open, returnFocus = false) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  siteNavigation.classList.toggle('is-open', open);
  if (returnFocus) menuToggle.focus();
}

menuToggle.addEventListener('click', () => {
  setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
});
siteNavigation.addEventListener('click', event => {
  if (event.target.closest('a')) setMenuOpen(false);
});
document.addEventListener('click', event => {
  if (menuToggle.getAttribute('aria-expanded') === 'true' && !event.target.closest('.navigation')) {
    setMenuOpen(false);
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false, true);
  }
});
mobileNavigation.addEventListener('change', () => setMenuOpen(false));
window.addEventListener('pageshow', () => setMenuOpen(false));

const contactToggle = document.querySelector('.contact-toggle');
const contactList = document.querySelector('#contact-list');
contactToggle?.addEventListener('click', () => {
  const open = contactToggle.getAttribute('aria-expanded') !== 'true';
  contactToggle.setAttribute('aria-expanded', String(open));
  contactList.classList.toggle('is-open', open);
});
const dialog = document.querySelector('#wechat-dialog');
const wechatTrigger = document.querySelector('#wechat-open');
wechatTrigger?.addEventListener('click', () => dialog.showModal());
document.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
dialog?.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
dialog?.addEventListener('close', () => {
  document.querySelector('#copy-status').textContent = '';
  wechatTrigger.focus();
});
document.querySelector('#wechat-copy')?.addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  const id = dialog.querySelector('strong').textContent;
  try {
    await navigator.clipboard.writeText(id);
    status.textContent = 'WeChat ID copied.';
  } catch {
    status.textContent = 'Please copy the ID above: ' + id;
  }
});
