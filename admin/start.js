(async function () {
  const status = document.getElementById('connection-status');
  try {
    const response = await fetch('/api/cms/config', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('后台连接尚未就绪，请确认升级文件已经部署到 Vercel。');
    const connection = await response.json();
    if (!connection.configured) {
      status.textContent = '后台文件已就绪，等待完成首次 GitHub 登录配置。';
      document.getElementById('setup-details').hidden = false;
      for (const name of connection.missing) {
        const item = document.createElement('li');
        const code = document.createElement('code');
        code.textContent = name;
        item.appendChild(code);
        document.getElementById('missing-settings').appendChild(item);
      }
      return;
    }
    if (location.origin !== connection.siteUrl) {
      status.textContent = '当前地址与后台登录地址不同。';
      document.getElementById('origin-details').hidden = false;
      const target = document.getElementById('canonical-admin');
      target.href = connection.siteUrl + '/admin/';
      target.textContent = connection.siteUrl + '/admin/';
      return;
    }
    status.textContent = '正在打开内容管理后台……';
    window.CMS_MANUAL_INIT = true;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '../vendor/decap-cms/decap-cms.js?v=3.17.3';
      script.onload = resolve;
      script.onerror = () => reject(new Error('后台组件加载失败，请刷新后重试。'));
      document.body.appendChild(script);
    });
    window.CMS.registerEventListener({ name: 'preSave', handler: window.createAcademicCmsConfig.validateEntry });
    window.CMS.init({ config: window.createAcademicCmsConfig(connection) });
    document.getElementById('setup').hidden = true;
  } catch (error) {
    status.textContent = error.message || '后台暂时无法打开，请稍后重试。';
  }
})();
