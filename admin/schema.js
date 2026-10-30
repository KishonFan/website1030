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
                { label: '关联期刊（仅已发表论文）', name: 'journalId', widget: 'relation', collection: 'journals', file: 'journals', search_fields: ['items.*.name'], display_fields: ['items.*.name'], value_field: 'items.*.id', required: false, hint: '选择后自动使用该期刊的封面、JCR 分区和影响因子。未发表稿件不用填写。' },
                { label: '论文关键词（仅已发表论文）', name: 'keywords', widget: 'list', required: false, default: [], collapsed: true, label_singular: '关键词', summary: '{{fields.keyword}}', field: { label: '关键词', name: 'keyword', widget: 'string' }, hint: '每项填写一个关键词；未发表稿件不用填写，也不会在前台显示。' },
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
        {
          name: 'journals', label: '期刊资料', format: 'json',
          files: [{ name: 'journals', label: '编辑期刊封面与指标', file: 'content/journals.json', fields: [
            { label: '期刊', name: 'items', widget: 'list', collapsed: true, summary: '{{fields.name}}', label_singular: '期刊', hint: '同一期刊的封面和指标只需维护一次，所有关联论文会一起更新。', fields: [
              { label: '期刊标识', name: 'id', widget: 'string', pattern: ['^[a-z0-9-]+$', '请使用小写英文字母、数字或短横线。'], hint: '例如 thinking-skills-and-creativity。创建并关联论文后请保留这个标识。' },
              { label: '期刊名称', name: 'name', widget: 'string' },
              { label: '期刊封面', name: 'cover', widget: 'image', required: false, choose_url: false, hint: '选择或上传真实期刊封面，右侧图片会自动适应版面。' },
              { label: '期刊官网', name: 'url', widget: 'string', required: false },
              { label: '收录索引（可选）', name: 'indexing', widget: 'string', required: false, hint: '例如 SSCI；只填写已确认的索引。' },
              { label: 'JCR 分区', name: 'jcrQuartile', widget: 'select', required: false, options: [{ label: '暂不显示', value: '' }, 'Q1', 'Q2', 'Q3', 'Q4'], default: '' },
              { label: 'JCR 口径', name: 'jcrBasis', widget: 'select', default: 'reported', options: [{ label: 'JCR 分区（未指定具体学科）', value: 'reported' }, { label: '出版社公布的最佳分区（Best Quartile）', value: 'best' }, { label: '具体学科分区', value: 'category' }] },
              { label: 'JCR 对应年份', name: 'jcrYear', widget: 'number', value_type: 'int', step: 1, default: '', required: false, hint: '只填写已核实的 JCR 年份，不要用论文发表年份代替。' },
              { label: 'JCR 学科类别', name: 'jcrCategory', widget: 'string', required: false, hint: '选择具体学科分区时请填写，例如 Education & Educational Research。' },
              { label: '影响因子（Journal Impact Factor）', name: 'impactFactor', widget: 'number', value_type: 'float', step: 0.1, default: '', required: false, hint: '填写 JIF 数值，例如 6.1；不是 CiteScore 或 SJR。没有核实的数据可以留空。' },
              { label: '影响因子对应年份', name: 'impactFactorYear', widget: 'number', value_type: 'int', step: 1, default: '', required: false, hint: '例如出版社写 2025 Impact Factor，则填 2025。填写影响因子时必须同时填写此项。' },
              { label: '指标来源链接', name: 'metricsUrl', widget: 'string', required: false, hint: '填写出版社或 JCR 的对应页面，前台会提供来源链接。' },
              { label: '核对日期', name: 'checkedAt', widget: 'string', required: false, hint: '例如 2026-10-30，用于记录这次核对的日期。' },
              { label: '来源备注（仅供管理）', name: 'sourceNote', widget: 'text', required: false, hint: '可记录出版社页面、JCR 报告或自己核实的数据来源；这段备注不显示在网页。' },
            ] },
          ] }],
        },
      ],
    };
  }
  createAcademicCmsConfig.validateEntry = ({ entry }) => {
    const data = entry.get('data');
    const items = data.get('items');
    const records = items ? items.toJS() : [];
    const journals = entry.get('collection') === 'journals' || entry.get('slug') === 'journals' || records.some(record => Object.hasOwn(record, 'name') && !record.kind);
    if (journals) createAcademicCmsConfig.validateJournals(records);
    for (const record of records) {
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
      if (record.kind === 'published' && record.keywords && (!Array.isArray(record.keywords) || record.keywords.some(value => typeof value !== 'string'))) {
        throw new Error(label + '每个关键词都需要填写文字。');
      }
    }
    return data;
  };
  createAcademicCmsConfig.validateJournals = records => {
    const ids = new Set();
    const filled = value => value !== null && value !== undefined && String(value).trim() !== '';
    for (const record of records) {
      const label = record.name || '期刊';
      if (!/^[a-z0-9-]+$/.test(record.id || '') || ids.has(record.id)) throw new Error(label + '：期刊标识需要使用不重复的小写英文、数字或短横线。');
      ids.add(record.id);
      if (!String(record.name || '').trim()) throw new Error('请填写期刊名称。');
      if (record.cover) {
        const path = String(record.cover).trim().replace(/^\.\.\//, '').replace(/^\//, '');
        if (!/^assets\/[a-zA-Z0-9\u0080-\uFFFF._/ -]+$/.test(path) || path.split('/').some(part => part === '..' || part === '.')) throw new Error(label + '：期刊封面需要从网站素材中选择或上传。');
      }
      for (const key of ['jcrYear', 'impactFactorYear']) {
        if (filled(record[key]) && (!Number.isInteger(Number(record[key])) || Number(record[key]) < 1900 || Number(record[key]) > 2200)) throw new Error(label + '：指标年份需要填写 1900–2200 之间的整数。');
      }
      if (filled(record.impactFactor)) {
        if (!Number.isFinite(Number(record.impactFactor)) || Number(record.impactFactor) < 0) throw new Error(label + '：影响因子需要填写大于或等于 0 的数值。');
        if (!filled(record.impactFactorYear)) throw new Error(label + '：请同时填写影响因子对应年份。');
      }
      if (record.jcrQuartile && !/^Q[1-4]$/.test(record.jcrQuartile)) throw new Error(label + '：请选择有效的 JCR 分区。');
      if (record.jcrBasis && !['best', 'category', 'reported'].includes(record.jcrBasis)) throw new Error(label + '：请选择有效的 JCR 口径。');
      if (record.jcrQuartile && record.jcrBasis === 'category' && !String(record.jcrCategory || '').trim()) throw new Error(label + '：请选择具体的 JCR 学科类别。');
      if (record.metricsUrl) {
        let url;
        try { url = new URL(record.metricsUrl); } catch { throw new Error(label + '：请填写完整的指标来源链接。'); }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(label + '：指标来源必须是普通网页地址。');
      }
    }
  };
  return createAcademicCmsConfig;
});
