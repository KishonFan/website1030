(function (root, factory) {
  const createConfig = factory();
  if (typeof module === 'object' && module.exports) module.exports = createConfig;
  else root.createAcademicCmsConfig = createConfig;
})(typeof window === 'undefined' ? globalThis : window, function () {
  function createAcademicCmsConfig(connection) {
    const visible = { label: '在网站显示', name: 'visible', widget: 'boolean', default: true, hint: '关闭后从网页隐藏；资料仍保留在 GitHub 中。' };
    return {
      load_config_file: false,
      locale: 'zh_Hans',
      display_url: connection.siteUrl,
      site_url: connection.siteUrl,
      logo_url: connection.siteUrl + '/assets/portrait.jpg',
      backend: { name: 'github', repo: connection.repository, branch: connection.branch, base_url: connection.siteUrl, auth_endpoint: 'api/cms/auth', commit_messages: { update: 'Update {{collection}} content', media_create: 'Upload work cover {{path}}', media_delete: 'Remove work cover {{path}}' } },
      media_folder: 'assets/uploads',
      public_folder: '/assets/uploads',
      editor: { preview: false },
      collections: [
        {
          name: 'publications', label: '论文与稿件', format: 'json',
          files: [{
            name: 'publications', label: '编辑论文和稿件列表', file: 'content/publications.json',
            fields: [
              { label: '稿件区说明（可留空）', name: 'manuscriptNote', widget: 'string', required: false, hint: '更新稿件后，可同步修改或清空原有日期说明。' },
              { label: '论文或稿件', name: 'items', widget: 'list', collapsed: true, summary: '{{fields.title}}', fields: [
                { label: '条目类型', name: 'kind', widget: 'select', default: 'manuscript', options: [{ label: '已发表论文', value: 'published' }, { label: '未发表稿件 Manuscript', value: 'manuscript' }] },
                { label: '论文标题', name: 'title', widget: 'string' },
                { label: '作者', name: 'authors', widget: 'string', hint: '按论文顺序填写，Jianxiong Fan 会自动加粗。' },
                // The number widget treats legacy null values as zero when min/max are set.
                // Validate the range in preSave so manuscripts can keep a blank year.
                { label: '发表年份', name: 'year', widget: 'number', value_type: 'int', step: 1, default: '', required: false, hint: '已发表论文必须填写；未发表稿件可以留空。填写时请输入 1900–2200 之间的整数年份。' },
                { label: '期刊或会议', name: 'venue', widget: 'string', required: false },
                { label: 'DOI', name: 'doi', widget: 'string', required: false, hint: '例如 10.1016/j.tsc.2026.102295，也可粘贴完整 DOI 链接。' },
                { label: '其他阅读链接', name: 'url', widget: 'string', required: false, hint: '以 https:// 开头；已发表论文优先使用 DOI。' },
                { label: '稿件状态', name: 'status', widget: 'string', required: false, hint: '例如 In preparation、Submitted、Under review、Accepted。已发表论文不显示此字段。' },
                visible,
              ] },
            ],
          }],
        },
        {
          name: 'works', label: '作品集', format: 'json',
          files: [{ name: 'works', label: '编辑作品列表', file: 'content/works.json', fields: [
            { label: '作品', name: 'items', widget: 'list', collapsed: true, summary: '{{fields.title}}', hint: '通过列表中的排序控件调整作品展示顺序。', fields: [
              { label: '作品名称', name: 'title', widget: 'string' },
              { label: 'Notion 或作品详情链接', name: 'url', widget: 'string', pattern: ['^https?://[^\\s]+$', '请填写完整的 https:// 或 http:// 链接。'] },
              { label: '封面图片', name: 'image', widget: 'image', choose_url: false, hint: '上传后自动保存到网站仓库。' },
              { label: '分类标签', name: 'tag', widget: 'string', hint: '例如 HCI、AR、UX、VR。' },
              visible,
            ] },
          ] }],
        },
      ],
    };
  }
  createAcademicCmsConfig.validateEntry = ({ entry }) => {
    const data = entry.get('data');
    const items = data.get('items');
    if (items) for (const record of items.toJS()) {
      const hasYear = record.year !== null && record.year !== undefined && String(record.year).trim() !== '';
      const label = record.title ? '“' + record.title + '”：' : '';
      if (record.kind === 'published' && !hasYear) {
        throw new Error(label + '已发表论文需要填写有效的发表年份。');
      }
      if (hasYear && (!Number.isInteger(Number(record.year)) || Number(record.year) < 1900 || Number(record.year) > 2200)) {
        throw new Error(label + '发表年份需要填写 1900–2200 之间的整数。');
      }
      if (record.url) {
        let url;
        try { url = new URL(record.url); } catch { throw new Error('请填写完整的 https:// 或 http:// 阅读链接。'); }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('阅读链接必须是普通网页地址。');
      }
      if (record.doi && !/^10\.\d{4,9}\/\S+$/i.test(record.doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, ''))) {
        throw new Error('请核对 DOI 格式，或留空后使用其他阅读链接。');
      }
    }
    return data;
  };
  return createAcademicCmsConfig;
});
