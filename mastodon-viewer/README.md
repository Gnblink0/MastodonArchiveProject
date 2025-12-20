# Mastodon Archive Viewer

一个纯前端的 Mastodon 存档查看器，数据存储在浏览器本地 IndexedDB，无需后端服务器。

## 功能特性

✨ **一次上传，永久保存** - 数据持久化存储在浏览器 IndexedDB
🔒 **完全隐私** - 数据不离开你的设备
⚡ **快速搜索** - 全文搜索、标签过滤、时间筛选（开发中）
📱 **响应式设计** - 支持桌面和移动设备
💰 **完全免费** - 无服务器成本

## 开发状态

🚧 **当前版本**: MVP v0.1
✅ 已完成: 基础架构、ZIP 解析、数据存储
🚧 开发中: 时间线视图、搜索功能

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录

### 预览生产构建

```bash
npm run preview
```

## 如何使用

1. **获取 Mastodon 存档**
   - 登录你的 Mastodon 账号
   - 进入 设置 → 导入和导出 → 申请存档
   - 等待邮件通知（通常几分钟到几小时）
   - 下载 .zip 文件

2. **上传存档**
   - 打开应用
   - 拖放或选择 .zip 文件
   - 等待解析完成（可能需要几分钟）

3. **浏览和搜索**
   - 数据会永久保存在浏览器
   - 刷新页面数据依然存在
   - 可随时清除数据重新上传

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **样式**: Tailwind CSS v4
- **存储**: IndexedDB (Dexie.js)
- **解析**: JSZip
- **搜索**: Fuse.js
- **图标**: Lucide React

## 项目结构

```
src/
├── components/        # React 组件
│   ├── Upload/       # 上传组件
│   ├── Timeline/     # 时间线（待开发）
│   ├── Search/       # 搜索（待开发）
│   └── Stats/        # 统计（待开发）
├── lib/
│   ├── db.ts         # IndexedDB 数据库定义
│   └── parser.ts     # ZIP 解析器
├── hooks/            # 自定义 Hooks（待开发）
├── types/            # TypeScript 类型定义
└── utils/            # 工具函数
```

## 核心文件说明

### `src/lib/db.ts`
使用 Dexie.js 定义 IndexedDB 数据库，存储用户资料、帖子、媒体、点赞、书签等数据

### `src/lib/parser.ts`
解析 Mastodon 导出的 ZIP 存档，提取 JSON 数据和媒体文件，转换为适合查询的格式并存入数据库

### `src/components/Upload/UploadZone.tsx`
文件上传组件，支持拖放和文件选择，显示解析进度

## 开发计划

### Phase 1: 基础设施 ✅
- [x] 项目搭建
- [x] IndexedDB 数据库
- [x] ZIP 解析器
- [x] 上传组件

### Phase 2: 核心功能 🚧
- [ ] 时间线视图
- [ ] 帖子卡片组件
- [ ] 搜索功能
- [ ] 过滤器（标签、日期、媒体）

### Phase 3: UI/UX 优化
- [ ] 响应式设计
- [ ] 虚拟滚动
- [ ] 暗黑模式
- [ ] 图片懒加载

### Phase 4: 增强功能
- [ ] 统计面板
- [ ] 数据导出
- [ ] PWA 支持
- [ ] 媒体全屏查看

## 注意事项

- 数据存储在浏览器本地，建议定期导出备份
- 清除浏览器数据会删除存档，请谨慎操作
- 大型存档（>500MB）可能需要较长解析时间
- 浏览器 IndexedDB 存储限制通常为几个 GB

## 许可证

MIT License

## 相关资源

- [Mastodon 官方文档](https://docs.joinmastodon.org/)
- [ActivityPub 标准](https://www.w3.org/TR/activitypub/)
- [Dexie.js 文档](https://dexie.org/)
