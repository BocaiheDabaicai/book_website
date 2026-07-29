import * as path from 'node:path';
import { defineConfig } from '@rspress/core';
import type { RspressPlugin, UserConfig } from '@rspress/core';

function hideAdminInProduction(): RspressPlugin {
  return {
    name: 'hide-admin-in-production',
    config(config: UserConfig, _utils: any, isProd: boolean) {
      if (!isProd) return config;
      return {
        ...config,
        route: {
          ...config.route,
          exclude: [...(config.route?.exclude ?? []), 'admin/**'],
        },
      };
    },
  };
}

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  lang: 'zh-CN',
  title: '阅读·书斋',
  description: '个人阅读空间 —— 书籍笔记、论文精读与总结',
  icon: '/leaf-logo.svg',
  logo: {
    light: '/leaf-logo.svg',
    dark: '/leaf-logo-dark.svg',
  },
  globalStyles: path.join(__dirname, 'src', 'styles', 'theme.css'),
  head: [
    [
      'link',
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    ],
    [
      'link',
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: '',
      },
    ],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;1,14..32,400&family=Noto+Serif+SC:wght@400;500;600;700&display=swap',
      },
    ],
  ],
  themeConfig: {
    socialLinks: [],
  },
  plugins: [hideAdminInProduction()],
});
