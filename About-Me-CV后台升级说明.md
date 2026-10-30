# 为 About Me 和 CV 添加后台管理

适用仓库：https://github.com/KishonFan/website1030

这次更新保留现有网页布局和内容，新增三个后台入口：

| 后台入口 | 可以修改的内容 |
| --- | --- |
| 个人资料（全站） | 姓名、头像、研究方向、所在地、单位、微信、Email、ORCID、LinkedIn。修改后同步到四页的个人资料栏。 |
| About Me 首页 | 自我介绍、技能、研究兴趣、论文与作品入口说明。支持加粗、斜体、链接，以及条目增删、隐藏和排序。 |
| CV 简历 | 教育、研究经历、项目、活动与学术交流、奖学金、竞赛、软著与展览；也可以上传新版 CV PDF。 |

## 一次性上传更新

1. 解压 `Jianxiong-About-CV-CMS-Update.zip`。
2. 打开 GitHub 的 `KishonFan/website1030` 仓库，确认在 `main` 分支，回到最外层目录。
3. 点击 **Add file → Upload files**。
4. 进入解压后的文件夹，把里面的文件和文件夹一起拖入上传区。不要只上传 ZIP，也不要把整个更新文件夹再套在仓库里面。
5. 确认上传列表中有 `admin/page-fields.js`、`lib/pages.mjs`、`content/about.json`、`content/cv.json`、`content/profile.json` 和 `vendor/marked/marked.esm.mjs` 等文件。已有同名文件会更新；请保留原仓库中其他文件。
6. 点击 **Commit changes**，等待 Vercel 的最新部署显示 **Ready**。
7. 打开原来的后台 https://website1030.vercel.app/admin/ ，按 **Ctrl + Shift + R** 刷新，继续使用 GitHub 登录。

上传包包含新增和需要更新的文件，未包含现有图片、CV PDF、论文、作品集和期刊的 JSON 数据。它们继续使用你仓库里的版本。域名、Vercel 环境变量和 GitHub OAuth App 均沿用现有配置，无需重新填写。

## 日常如何修改

- **修改自我介绍**：About Me 首页 → 编辑自我介绍、技能和研究兴趣 → 自我介绍。
- **新增研究兴趣**：展开“研究兴趣”，新增条目，填写方向名称和说明；列表中可以调整顺序。
- **新增项目或经历**：CV 简历 → 展开相应栏目 → 新增条目，填写标题、时间、单位/角色/编号和详细内容。
- **修改奖学金金额或加粗**：CV 简历 → Achievements → 成果分组 → 对应条目，用文字工具栏修改金额和加粗内容。
- **更新头像或联系方式**：个人资料（全站） → 修改对应信息。手写在自我介绍段落中的姓名或单位需要在 About Me 中另行调整。
- **更新下载的 CV**：CV 简历 → 下载用的 CV PDF → 选择其他文件，上传完整的新版 PDF。网页文字与 PDF 分别维护，修改文字不会自动生成 PDF。

完成修改后，点击上方 **发布 → 立即发布**。看到“内容已保存”后，等待 Vercel 部署为 Ready，再刷新公开网页；四个页面仍然是加载迅速的静态网页。

可选内容留空时会隐藏相应入口。例如清空 PDF 会隐藏下载按钮；微信号和二维码都清空会隐藏 WeChat。关闭条目的“在网站显示”会隐藏条目，资料仍在仓库中。

## 本次验证

- 已核对最新 GitHub 公开文件与本次修改的来源一致。
- 原 About Me 与 CV 的可见文字逐字保留，保留项目编号、金额和原有加粗。
- 本机测试覆盖四页资料同步、首页/CV 修改与排序、隐藏、PDF 替换，以及原论文和作品集生成。
- 本机 Decap 测试后台中，About Me 和 CV 的编辑与发布均显示“内容已保存”。这些测试没有写入你的 GitHub。
- 正式域名上的发布需要在上传更新、Vercel 部署完成后进行一次确认。

## 以后在 GitHub 直接改文件

使用上述后台即可维护内容。若直接在 GitHub 编辑，首页在 `content/about.json`，简历在 `content/cv.json`，全站个人资料在 `content/profile.json`。

`index.html` 等 HTML 文件是页面模板；Vercel 构建时会用 JSON 资料生成最终页面。因此请在后台或对应 JSON 中改内容。
