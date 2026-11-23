(function (root, factory) {
  const fields = factory();
  if (typeof module === 'object' && module.exports) module.exports = fields;
  else root.AcademicPageFields = fields;
})(typeof window === 'undefined' ? globalThis : window, function () {
  const text = (label, name, options = {}) => ({ label, name, widget: 'string', ...options });
  const rich = (label, name, options = {}) => ({
    label, name, widget: 'richtext', required: false,
    buttons: ['bold', 'italic', 'link', 'bulleted-list', 'numbered-list'],
    editor_components: [], modes: ['rich_text', 'raw'], sanitize_preview: true,
    hint: '可以直接输入文字，并用工具栏加粗、添加链接或项目符号。', ...options,
  });
  const visible = { label: '在网站显示', name: 'visible', widget: 'boolean', default: true, hint: '关闭后隐藏，内容仍保留。' };
  const entryFields = [
    text('名称或标题', 'title'),
    text('时间', 'date', { required: false, hint: '例如 Sep 2023 – Jun 2026；也可以留空。' }),
    rich('单位、角色或项目编号', 'subtitle', { minimal: true, buttons: ['bold', 'italic', 'link'] }),
    rich('详细内容', 'body', { hint: '可按项目符号逐条填写贡献、工作内容或成果；项目不需要说明时可以留空。' }),
    visible,
  ];
  const sectionFields = [text('栏目标题', 'title'), text('页内导航名称', 'navigationLabel'), visible];
  const cvSection = (label, name) => ({ label, name, widget: 'object', collapsed: true, fields: [
    ...sectionFields,
    { label: '条目', name: 'items', widget: 'list', required: false, default: [], collapsed: true,
      summary: '{{fields.title}}', hint: '可以新增、删除或拖动排序。', fields: entryFields },
  ] });

  function collections() {
    return [
      { name: 'profile', label: '个人资料（全站）', format: 'json', files: [{
        name: 'profile', label: '中英文个人资料及共用联系方式', file: 'content/profile.json', fields: [
          text('英文姓名', 'name'),
          text('中文姓名', 'nameZh', { required: false, hint: '留空时显示英文姓名。' }),
          { label: '头像', name: 'portrait', widget: 'image', choose_url: false },
          { label: '研究方向或身份（英文）', name: 'role', widget: 'text', hint: '每行会单独显示。' },
          { label: '研究方向或身份（中文）', name: 'roleZh', widget: 'text', required: false },
          text('所在地（英文）', 'location', { required: false }),
          text('所在地（中文）', 'locationZh', { required: false }),
          { label: '学校或单位（英文）', name: 'institution', widget: 'text', required: false },
          { label: '学校或单位（中文）', name: 'institutionZh', widget: 'text', required: false },
          text('学校或单位链接', 'institutionUrl', { required: false }),
          text('Email', 'email', { required: false }),
          text('WeChat ID', 'wechatId', { required: false }),
          { label: '微信二维码', name: 'wechatQr', widget: 'image', choose_url: false, required: false,
            hint: '微信号与二维码都清空时，网页不显示 WeChat 入口。' },
          { label: '学术主页与社交链接', name: 'links', widget: 'list', required: false, default: [], collapsed: true,
            label_singular: '链接', summary: '{{fields.label}}',
            hint: '两版共用链接和顺序。可分别填写中英文显示名称。',
            fields: [
              text('显示名称（英文）', 'label', { hint: '例如 Google Scholar、ORCID、GitHub。' }),
              text('显示名称（中文）', 'labelZh', { required: false, hint: '留空时两版显示同一名称。' }),
              text('主页网址', 'url', { pattern: ['^https?://[^\\s]+$', '请填写完整的 https:// 或 http:// 地址。'] }),
              { label: '图标', name: 'icon', widget: 'select', default: 'auto', options: [
                { label: '自动识别', value: 'auto' },
                { label: 'Google Scholar / 学术', value: 'scholar' },
                { label: 'ORCID', value: 'orcid' },
                { label: 'LinkedIn', value: 'linkedin' },
                { label: 'GitHub', value: 'github' },
                { label: 'ResearchGate', value: 'researchgate' },
                { label: '个人网站', value: 'website' },
                { label: '通用链接', value: 'link' },
              ], hint: '自动识别常见平台；其他网址使用通用链接图标。也可以手动选择。' },
              visible,
            ],
          },
        ],
      }] },
      { name: 'about', label: '个人简介 · 中英文', format: 'json', files: ['en', 'zh'].map(language => ({
        name: language === 'zh' ? 'about-zh' : 'about',
        label: language === 'zh' ? '中文版 · 关于我' : 'English · About Me',
        file: language === 'zh' ? 'content/about.zh.json' : 'content/about.json',
        preview_path: language + '/',
        fields: [
          text('页面标题', 'title'),
          text('搜索结果简介', 'description', { required: false, hint: '显示在搜索引擎摘要中的简短介绍。' }),
          rich('自我介绍', 'body', { required: true }),
          text('技能栏目标题', 'skillsTitle'),
          { label: '研究与技术技能', name: 'skills', widget: 'list', required: false, default: [], collapsed: true,
            summary: '{{fields.title}}', fields: [text('技能类别', 'title'),
              rich('技能说明', 'description', { minimal: true, buttons: ['bold', 'italic', 'link'] }), visible] },
          text('研究兴趣栏目标题', 'interestsTitle'),
          { label: '研究兴趣', name: 'interests', widget: 'list', required: false, default: [], collapsed: true,
            summary: '{{fields.title}}', fields: [text('方向名称', 'title'),
              rich('方向说明', 'description', { minimal: true, buttons: ['bold', 'italic', 'link'] }), visible] },
          text('作品与论文入口标题', 'exploreTitle', { required: false }),
          rich('作品与论文入口说明', 'exploreBody'),
          text('联系提示', 'contactMessage', { required: false, hint: '后面会自动附上“个人资料”中的邮箱；留空可隐藏。' }),
        ],
      })) },
      { name: 'cv', label: '简历 · 中英文', format: 'json', files: ['en', 'zh'].map(language => ({
        name: language === 'zh' ? 'cv-zh' : 'cv',
        label: language === 'zh' ? '中文版 · 简历' : 'English · CV',
        file: language === 'zh' ? 'content/cv.zh.json' : 'content/cv.json',
        preview_path: language + '/cv/',
        fields: [
          text('页面标题', 'title'),
          text('搜索结果简介', 'description', { required: false }),
          text('页面开头说明', 'intro', { required: false }),
          { label: '下载用的 CV PDF', name: 'pdf', widget: 'file', required: false, choose_url: false,
            media_folder: '/assets/uploads', public_folder: '/assets/uploads',
            pattern: ['\\.[pP][dD][fF]$', '请上传或选择 PDF 文件。'],
            hint: '上传完整的新版 PDF。下面编辑的是网页文字，不会自动改写 PDF；清空此项可隐藏下载按钮。' },
          text('下载按钮文字', 'downloadLabel', { required: false, default: language === 'zh' ? '下载中文简历' : 'Download CV' }),
          cvSection('Education 教育背景', 'education'),
          cvSection('Research Experience 研究经历', 'research'),
          cvSection('Research Projects 参与或主持项目', 'projects'),
          cvSection('Activities 课外活动与学术交流', 'activities'),
          { label: 'Achievements 成果与荣誉', name: 'achievements', widget: 'object', collapsed: true, fields: [
            ...sectionFields,
            { label: '成果分组', name: 'groups', widget: 'list', required: false, default: [], collapsed: true,
              summary: '{{fields.title}}', hint: '例如奖学金与荣誉、竞赛奖项、软著与展览；可新增分组并排序。', fields: [
                text('分组标题', 'title'),
                { label: '成果条目', name: 'items', widget: 'list', required: false, default: [], collapsed: true,
                  summary: '{{fields.date}} · {{fields.body}}', fields: [
                    text('年份或时间', 'date', { required: false }),
                    rich('成果、奖项和金额', 'body', { required: true, minimal: true, buttons: ['bold', 'italic', 'link'] }),
                    visible,
                  ] },
              ] },
          ] },
          rich('底部论文列表链接', 'publicationsLink', { minimal: true, buttons: ['bold', 'italic', 'link'] }),
        ],
      })) },
    ];
  }

  const filled = value => value !== null && value !== undefined && String(value).trim() !== '';
  const string = (value, label, required = false) => {
    if (value !== null && value !== undefined && typeof value !== 'string') throw new Error(label + '需要填写文字。');
    if (required && !filled(value)) throw new Error('请填写' + label + '。');
  };
  const list = (value, label) => {
    if (value === null || value === undefined) return [];
    if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error(label + '需要是条目列表。');
    return value;
  };
  const url = (value, label) => {
    if (!filled(value)) return;
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error(label + '需要填写完整的 https:// 或 http:// 地址。'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || /[\u0000-\u0020\u007f]/.test(value)) throw new Error(label + '需要是普通网页地址。');
  };
  function assetPath(value, label, type = 'image') {
    if (!filled(value)) return '';
    const path = String(value).trim().replace(/^\//, '');
    if (!/^assets\/[a-zA-Z0-9\u0080-\uFFFF._/ -]+$/.test(path) || path.split('/').some(part => part === '.' || part === '..' || !part)) throw new Error(label + '需要从网站素材中上传或选择。');
    if (type === 'pdf' ? !/\.pdf$/i.test(path) : !/\.(?:jpe?g|png|webp|gif|avif|svg)$/i.test(path)) throw new Error(label + (type === 'pdf' ? '需要是 PDF 文件。' : '需要是图片文件。'));
    return path;
  }
  function validateProfile(data) {
    string(data.name, '姓名', true); string(data.role, '研究方向或身份', true);
    if (!filled(data.portrait)) throw new Error('请上传头像。');
    assetPath(data.portrait, '头像'); assetPath(data.wechatQr, '微信二维码');
    for (const key of ['nameZh', 'roleZh', 'location', 'locationZh', 'institution', 'institutionZh', 'wechatId']) string(data[key], key);
    for (const key of ['institutionUrl', 'orcid', 'linkedin']) url(data[key], key);
    if (filled(data.email) && !/^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/.test(data.email)) throw new Error('请填写有效的 Email 地址。');
    for (const link of profileLinks(data)) {
      string(link.label, '链接显示名称', true);
      string(link.labelZh, '链接的中文显示名称');
      string(link.url, link.label + '的网址', true);
      url(link.url, link.label + '的网址');
      if (link.icon && !['auto', 'scholar', 'orcid', 'linkedin', 'github', 'researchgate', 'website', 'link'].includes(link.icon)) throw new Error(link.label + '：请选择列表中的图标。');
    }
  }
  function profileLinks(data) {
    // An explicitly empty list must stay empty. Old profiles without the field
    // still render their original ORCID and LinkedIn during an incremental update.
    if (Object.hasOwn(data, 'links')) return list(data.links, '学术主页与社交链接');
    return [
      data.orcid ? { label: 'ORCID', url: data.orcid, icon: 'orcid' } : null,
      data.linkedin ? { label: 'LinkedIn', url: data.linkedin, icon: 'linkedin' } : null,
    ].filter(Boolean);
  }
  function validateAbout(data) {
    for (const key of ['title', 'body', 'skillsTitle', 'interestsTitle']) string(data[key], key, true);
    for (const key of ['description', 'exploreTitle', 'exploreBody', 'contactMessage']) string(data[key], key);
    for (const key of ['skills', 'interests']) for (const item of list(data[key], key)) {
      string(item.title, '条目标题', true); string(item.description, '条目说明');
    }
  }
  function validateCv(data) {
    string(data.title, 'CV 页面标题', true);
    for (const key of ['description', 'intro', 'downloadLabel', 'publicationsLink']) string(data[key], key);
    assetPath(data.pdf, 'CV PDF', 'pdf');
    for (const key of ['education', 'research', 'projects', 'activities', 'achievements']) {
      const section = data[key];
      if (!section || typeof section !== 'object' || Array.isArray(section)) throw new Error('缺少 CV 栏目：' + key);
      string(section.title, '栏目标题', true); string(section.navigationLabel, '页内导航名称', true);
      if (key === 'achievements') {
        for (const group of list(section.groups, '成果分组')) {
          string(group.title, '成果分组标题', true);
          for (const item of list(group.items, '成果条目')) { string(item.date, '时间'); string(item.body, '成果内容', true); }
        }
      } else {
        for (const item of list(section.items, 'CV 条目')) {
          string(item.title, '条目标题', true);
          for (const field of ['date', 'subtitle', 'body']) string(item[field], field);
        }
      }
    }
  }
  return { collections, validateProfile, validateAbout, validateCv, assetPath, profileLinks };
});
