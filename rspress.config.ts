import * as path from 'node:path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  lang: 'zh-CN',
  title: '阅读·书斋',
  description: '个人阅读空间 —— 书籍笔记、论文精读与总结',
  icon: '/rspress-icon.png',
  logo: {
    light: '/rspress-light-logo.png',
    dark: '/rspress-dark-logo.png',
  },
  themeConfig: {
    socialLinks: [],
  },
});
