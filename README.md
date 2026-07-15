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

## 目录结构

```
book_website/
├── docs/                       # Rspress 内容根目录
│   ├── index.md                # 首页
│   ├── _nav.json               # 顶部导航配置
│   ├── books/                  # 书籍笔记
│   │   ├── _meta.json
│   │   └── index.md
│   ├── papers/                 # 论文页面
│   │   ├── _meta.json
│   │   ├── index.md
│   │   ├── summary.md          # 论文精读总结索引
│   │   └── summaries/          # 单篇精读详情
│   ├── notes/                  # 学习笔记
│   │   ├── _meta.json
│   │   └── index.md
│   ├── admin/                  # 管理后台页面
│   └── public/
│       └── papers/             # PDF 文件存放目录
├── src/components/             # React 组件
│   ├── FileSystemContext.tsx    # 文件系统操作上下文
│   ├── BookManager.tsx          # 书籍管理表单
│   ├── PaperManager.tsx         # 论文管理表单
│   ├── PaperSummaryManager.tsx  # 论文精读管理表单
│   ├── NotesManager.tsx         # 笔记管理表单
│   └── PDFLink.tsx              # PDF 链接按钮组件
├── rspress.config.ts           # Rspress 配置文件
├── i18n.json                   # 中文国际化翻译
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
- **样式**: Rspress 内置主题 + 内联样式

## 浏览器兼容

管理后台依赖 File System Access API，需要 Chromium 内核浏览器（Chrome / Edge 86+）。
