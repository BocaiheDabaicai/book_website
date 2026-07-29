# 阅读·书斋

基于 [Rspress](https://rspress.rs/) 的个人阅读与知识管理站点，用于记录书籍笔记、论文精读与学习总结。

## 快速开始

```bash
npm install
npm run dev      # 启动开发服务器 → http://localhost:3000
npm run build    # 构建静态站点 → doc_build/
npm run preview  # 预览构建产物
```

## 站点结构

| 路由 | 说明 |
|------|------|
| `/` | 首页 |
| `/books/` | 书籍笔记列表 |
| `/papers/` | 论文列表 |
| `/papers/summary` | 论文精读总结（表格索引） |
| `/papers/summaries/{slug}` | 单篇论文精读详情 |
| `/notes/` | 学习笔记列表 |
| `/admin/` | 内容管理后台 |

## 内容管理

访问 `/admin/` 进入管理后台，首次使用需要选择项目根目录并授权文件系统访问（使用浏览器 File System Access API，权限会持久化到 IndexedDB）。

### 书籍管理 `/admin/books`

填写书名、作者、出版社等信息，自动生成标准格式的 `.md` 书籍笔记文件到 `docs/books/`，同步更新侧边栏和书籍首页列表。

### 论文管理 `/admin/papers`

- 拖拽 PDF 文件上传到 `docs/public/papers/`
- 填写论文信息，自动生成 `.mdx` 论文页面（含 PDF 链接按钮）
- 支持已有 PDF 的下拉选择关联

### 论文精读 `/admin/papers`

填写精读记录模板（研究场景、核心问题、研究方法、关键变量、研究结论、研究局限、可借鉴内容），自动生成独立 `.md` 文件到 `docs/papers/summaries/`，并在论文总结页的表格中添加索引链接。不在侧边栏显示。

### 笔记管理 `/admin/notes`

填写标题、背景、核心概念、知识框架、参考文献，自动生成 `.md` 笔记文件到 `docs/notes/`。

### 自动同步

所有内容创建/删除操作自动同步：

- `_meta.json` 侧边栏配置文件
- `index.md` 首页列表（含统计数据）
- 论文总结表格

## 管理后台生产环境隐藏

管理后台在 `npm run build` 时自动排除，生产站点不包含 `/admin/` 路由，顶部导航栏亦不会显示管理入口。`npm run dev` 时正常可用。

实现方式：通过 Rspress 自定义插件 `hideAdminInProduction`，在 `config` 钩子中判断 `isProd`，动态设置 `route.exclude: ['admin/**']`。

## UI 主题定制

### 配色

淡绿色（Sage Green）为主色调，暖白纸色背景，营造温柔、轻盈的阅读氛围。

| 用途 | 色值 |
|------|------|
| 品牌主色 | `#7eb89a` |
| 品牌浅色 | `#a0d0b8` |
| 品牌深色 | `#5d9a7a` |
| 页面背景 | `#fdfcfa`（暖白） |
| 软背景 | `#f5f3ee`（奶油） |
| 正文色 | `#3d3a35`（暖深灰） |

主题变量定义在 `src/styles/theme.css`，覆盖了 Rspress 默认的 `--rp-c-*` CSS 变量，同时包含暗色模式适配。

### Logo

- `docs/public/leaf-logo.svg` — 浅色主题 Logo（绿叶）
- `docs/public/leaf-logo-dark.svg` — 深色主题 Logo（绿叶浅色款）

### 字体

默认通过 Google Fonts CDN 加载 **Inter**（拉丁/UI） + **Noto Serif SC / 思源宋体**（中文衬线），字体栈定义在 `src/styles/theme.css`：

```css
--rp-font-family-base: "Noto Serif SC", "Source Han Serif SC",
  "Noto Serif", Georgia, "Times New Roman", "Songti SC", "SimSun", serif;
```

如需使用本地字体：

1. 将 `.woff2` / `.ttf` / `.otf` 字体文件放入 `docs/public/fonts/`
2. 编辑 `src/styles/fonts.css`，取消 `@font-face` 注释并修改文件名
3. 在 `src/styles/theme.css` 中调整 `--rp-font-family-base` 的字体栈顺序

## 目录结构

```
book_website/
├── docs/                          # Rspress 内容根目录
│   ├── index.md                   # 首页
│   ├── _nav.json                  # 顶部导航配置
│   ├── books/                     # 书籍笔记
│   │   ├── _meta.json
│   │   └── index.md
│   ├── papers/                    # 论文页面
│   │   ├── _meta.json
│   │   ├── index.md
│   │   ├── summary.md             # 论文精读总结索引
│   │   └── summaries/             # 单篇精读详情
│   ├── notes/                     # 学习笔记
│   │   ├── _meta.json
│   │   └── index.md
│   ├── admin/                     # 管理后台页面
│   └── public/
│       ├── papers/                # PDF 文件存放目录
│       ├── fonts/                 # 本地字体文件存放目录
│       ├── leaf-logo.svg          # 浅色主题 Logo
│       └── leaf-logo-dark.svg     # 深色主题 Logo
├── src/
│   ├── components/                # React 组件
│   │   ├── FileSystemContext.tsx   # 文件系统操作上下文
│   │   ├── BookManager.tsx         # 书籍管理表单
│   │   ├── PaperManager.tsx        # 论文管理表单
│   │   ├── PaperSummaryManager.tsx # 论文精读管理表单
│   │   ├── NotesManager.tsx        # 笔记管理表单
│   │   └── PDFLink.tsx             # PDF 链接按钮组件
│   └── styles/                    # 主题样式
│       ├── theme.css              # 淡绿色主题（CSS 变量 + 组件样式）
│       └── fonts.css              # 本地字体配置模板
├── rspress.config.ts              # Rspress 配置（Logo、字体、插件）
├── i18n.json                      # 中文国际化翻译
└── package.json
```

## 论文精读模板

每篇论文精读记录包含以下字段：

| 字段 | 说明 |
|------|------|
| 文献标题 / 作者 / 年份 / 期刊 | 基本信息 |
| 研究场景 | 基建 / 制造 / EPC / 智能建造 |
| 核心问题 | 现有工程管理存在什么痛点 |
| 研究方法 | 定性 / 定量；模型 / 算法 / 案例分析 / 问卷 |
| 核心变量 / 评价指标 | 重点摘抄 |
| 研究结论与实践价值 | 企业 / 项目层面应用 |
| 研究局限 | 该论文创新突破口 |
| 可借鉴内容 | 框架、问卷设计、优化思路、仿真流程 |

## 技术栈

- **框架**: Rspress v2 (基于 Rspack + React)
- **文件操作**: File System Access API + IndexedDB 持久化
- **样式**: Rspress 内置主题 + 自定义淡绿色 CSS 变量
- **字体**: Google Fonts (Inter + Noto Serif SC) + 本地字体支持

## 浏览器兼容

管理后台依赖 File System Access API，需要 Chromium 内核浏览器（Chrome / Edge 86+）。
