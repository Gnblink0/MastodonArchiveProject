# Mastodon Archive Viewer - 设计文档

## 一、项目概述

### 问题
现有的 Mastodon 存档查看工具的痛点：
- 每次都要重新上传本地文件
- 刷新页面后数据丢失
- 没有持久化存储

### 解决方案
**纯前端应用 + 浏览器本地存储（IndexedDB）**

核心洞察：
- Mastodon 存档本身就是 JSON 格式
- 数据是只读的（查看，不编辑）
- 更新方式是重新上传新存档
- **完全不需要传统数据库和后端！**

---

## 二、技术架构

### 技术栈

```
前端框架: React + TypeScript + Vite
样式: Tailwind CSS + shadcn/ui
图标: Lucide React
本地存储: IndexedDB (Dexie.js)
ZIP 解析: JSZip
全文搜索: Fuse.js
虚拟滚动: @tanstack/react-virtual
部署: Vercel / GitHub Pages (免费静态托管)
```

### 工作流程

```
用户上传 ZIP 文件
    ↓
浏览器内解压和解析（JSZip）
    ↓
提取数据：
  - actor.json → 用户资料
  - outbox.json → 所有帖子
  - likes.json → 点赞记录
  - bookmarks.json → 书签
  - media_attachments/ → 媒体文件
    ↓
存入 IndexedDB
  - 帖子数据（JSON）
  - 媒体文件（Blob）
    ↓
前端查询、搜索、过滤
（直接从 IndexedDB）
    ↓
数据持久保存在浏览器本地
```

### IndexedDB Schema

```typescript
// 数据库表结构
interface Actor {
  id: string
  preferredUsername: string
  displayName: string
  summary: string
  avatarBlob?: Blob      // 头像二进制数据
  avatarUrl?: string     // Object URL
  headerBlob?: Blob      // 封面
  headerUrl?: string
  fields: { name: string; value: string }[]
  createdAt: Date
}

interface Post {
  id: string
  type: 'post' | 'boost'
  content: string         // HTML 内容
  contentText: string     // 纯文本（用于搜索）
  publishedAt: Date
  timestamp: number       // Unix 时间戳（用于排序）
  tags: string[]          // 标签数组
  mediaIds: string[]      // 关联的媒体 ID
  inReplyTo?: string      // 回复关系
  sensitive: boolean
  summary?: string        // CW 警告
}

interface Media {
  id: string
  filename: string
  type: 'image' | 'video' | 'audio' | 'unknown'
  blob: Blob             // 媒体文件二进制数据
  url: string            // Object URL（用于显示）
}

interface Like {
  id: string
  likedPostId: string
  likedAt: Date
}

interface Bookmark {
  id: string
  bookmarkedPostId: string
  bookmarkedAt: Date
}

interface ArchiveMetadata {
  id: string
  uploadedAt: Date
  totalPosts: number
  totalLikes: number
  totalBookmarks: number
  totalMedia: number
  originalFilename: string
  fileSize: number
}

// Dexie 数据库定义
class MastodonArchiveDB extends Dexie {
  actor!: Table<Actor>
  posts!: Table<Post>
  media!: Table<Media>
  likes!: Table<Like>
  bookmarks!: Table<Bookmark>
  metadata!: Table<ArchiveMetadata>

  constructor() {
    super('MastodonArchive')
    this.version(1).stores({
      actor: 'id',
      posts: 'id, timestamp, *tags, publishedAt',
      media: 'id, type',
      likes: 'id, likedAt',
      bookmarks: 'id, bookmarkedAt',
      metadata: 'id'
    })
  }
}
```

### 项目结构

```
mastodon-archive-viewer/
├── src/
│   ├── components/
│   │   ├── Upload/
│   │   │   └── UploadZone.tsx       # 文件上传组件
│   │   ├── Timeline/
│   │   │   ├── PostCard.tsx         # 帖子卡片
│   │   │   ├── PostList.tsx         # 虚拟滚动列表
│   │   │   └── FilterBar.tsx        # 筛选器
│   │   ├── Search/
│   │   │   └── SearchBar.tsx        # 搜索框
│   │   ├── MediaGallery/
│   │   │   └── LightBox.tsx         # 媒体查看器
│   │   └── Stats/
│   │       └── Dashboard.tsx        # 统计面板
│   ├── lib/
│   │   ├── db.ts                    # Dexie 数据库定义
│   │   ├── parser.ts                # ZIP 解析器
│   │   ├── search.ts                # 搜索引擎
│   │   └── export.ts                # 导出功能
│   ├── hooks/
│   │   ├── useArchive.ts            # 存档管理
│   │   ├── usePosts.ts              # 帖子查询
│   │   └── useSearch.ts             # 搜索 Hook
│   ├── types/
│   │   └── index.ts                 # TypeScript 类型定义
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
└── README.md
```

---

## 三、核心功能

### 1. 存档上传与解析

```typescript
// 伪代码流程
async function handleUpload(file: File) {
  // 1. 解压 ZIP
  const zip = await JSZip.loadAsync(file)

  // 2. 解析 JSON 文件
  const actor = await parseActor(zip)
  const posts = await parsePosts(zip)      // 处理 outbox.json
  const likes = await parseLikes(zip)
  const bookmarks = await parseBookmarks(zip)

  // 3. 提取媒体文件
  const mediaFiles = await extractMedia(zip)

  // 4. 存入 IndexedDB
  await db.transaction('rw', [db.actor, db.posts, db.media], async () => {
    await db.actor.put(actor)
    await db.posts.bulkAdd(posts)
    await db.media.bulkAdd(mediaFiles)
    await db.likes.bulkAdd(likes)
    await db.bookmarks.bulkAdd(bookmarks)
  })

  // 5. 完成，跳转到时间线
  navigate('/timeline')
}
```

**关键处理：**
- HTML 转纯文本（用于搜索）
- 提取标签、媒体 ID
- 生成 timestamp 用于排序
- Blob 转 Object URL 用于显示

### 2. 时间线浏览

```typescript
// 查询帖子（支持过滤）
function usePosts(filters?: PostFilters) {
  return useLiveQuery(async () => {
    let posts = await db.posts
      .orderBy('timestamp')
      .reverse()
      .toArray()

    // 应用过滤器
    if (filters?.tags?.length) {
      posts = posts.filter(p =>
        filters.tags.some(tag => p.tags.includes(tag))
      )
    }

    if (filters?.hasMedia) {
      posts = posts.filter(p => p.mediaIds.length > 0)
    }

    if (filters?.dateFrom) {
      posts = posts.filter(p => p.publishedAt >= filters.dateFrom)
    }

    return posts
  }, [filters])
}
```

**性能优化：**
- 虚拟滚动（只渲染可见区域）
- 图片懒加载
- 分页加载（每次 20 条）

### 3. 全文搜索

```typescript
// 使用 Fuse.js 模糊搜索
function useSearch(posts: Post[], keyword: string) {
  const fuse = useMemo(
    () => new Fuse(posts, {
      keys: ['contentText', 'tags'],
      threshold: 0.3,        // 模糊度
      includeScore: true
    }),
    [posts]
  )

  return useMemo(() => {
    if (!keyword) return posts
    return fuse.search(keyword).map(r => r.item)
  }, [keyword, fuse, posts])
}
```

### 4. 数据统计

- 总帖子数、转发数
- 时间分布（按月统计）
- 最常用标签（Top 20）
- 媒体类型分布
- 互动统计（点赞、书签）

### 5. 数据导出

```typescript
// 导出备份（JSON 格式）
async function exportArchive() {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    actor: await db.actor.toArray(),
    posts: await db.posts.toArray(),
    likes: await db.likes.toArray(),
    bookmarks: await db.bookmarks.toArray(),
    // 媒体文件太大，不导出
  }

  const blob = new Blob([JSON.stringify(data)], {
    type: 'application/json'
  })

  // 触发下载
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mastodon-backup-${Date.now()}.json`
  a.click()
}
```

---

## 四、开发路线图

### Phase 1: 基础设施（2 天）
- [x] 初始化项目（Vite + React + TS）
- [x] 配置 Tailwind CSS
- [x] 安装核心依赖
- [ ] 定义 IndexedDB Schema
- [ ] 实现 ZIP 解析器
- [ ] 实现数据转换逻辑

### Phase 2: 核心功能（3 天）
- [ ] 上传组件（拖放 + 文件选择）
- [ ] 解析进度展示
- [ ] 时间线视图
- [ ] 帖子卡片组件
- [ ] 搜索功能
- [ ] 过滤器（标签、日期、媒体）

### Phase 3: UI/UX 优化（2 天）
- [ ] 响应式设计（移动端）
- [ ] 虚拟滚动（性能优化）
- [ ] 图片懒加载
- [ ] 骨架屏
- [ ] 暗黑模式
- [ ] 无障碍优化

### Phase 4: 增强功能（2-3 天）
- [ ] 统计面板
- [ ] 数据导出
- [ ] PWA 支持（离线可用）
- [ ] 媒体全屏查看
- [ ] 帖子详情页
- [ ] 键盘快捷键

**总计：9-10 天完成 MVP**

---

## 五、优势与限制

### ✅ 优势

1. **开发速度快**：无需后端，专注前端
2. **完全免费**：静态托管，无服务器成本
3. **极致隐私**：数据完全在本地，不上传云端
4. **离线可用**：PWA 模式，无网络也能访问
5. **零运维**：无服务器，无数据库
6. **易于部署**：一键部署到 Vercel/GitHub Pages

### ⚠️ 限制

1. **无法跨设备同步**：数据存储在浏览器本地
   - 解决方案：提供导出/导入功能
2. **浏览器存储限制**：IndexedDB 通常 <1GB
   - 大部分 Mastodon 存档 < 500MB，足够
3. **清除浏览器数据会丢失**
   - 解决方案：提示用户定期导出备份

---

## 六、可选增强

### 跨设备同步（后期）

如果需要多设备访问，可以添加云备份功能：

```typescript
// 备份到用户自己的 Google Drive
async function backupToGoogleDrive() {
  const data = await exportArchive()

  // 使用 Google Drive API
  const gapi = google.accounts.oauth2.initTokenClient({
    client_id: 'YOUR_CLIENT_ID',
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: async (response) => {
      // 上传文件到用户的 Google Drive
      await uploadFile(data, 'mastodon-archive.json')
    }
  })

  gapi.requestAccessToken()
}
```

### 高级分析

- 发帖时间分析（找出最活跃时段）
- 标签趋势分析
- 互动网络可视化
- 情感分析（可选）

---

## 七、部署

### 部署到 Vercel（推荐）

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 构建项目
npm run build

# 3. 部署
vercel

# 首次部署会要求登录和配置
# 后续更新只需 vercel --prod
```

### 部署到 GitHub Pages

```bash
# 1. 修改 vite.config.ts
export default defineConfig({
  base: '/mastodon-archive-viewer/',  // 仓库名
})

# 2. 安装 gh-pages
npm install -D gh-pages

# 3. 添加部署脚本到 package.json
"scripts": {
  "deploy": "npm run build && gh-pages -d dist"
}

# 4. 部署
npm run deploy
```

---

## 八、技术细节

### 为什么不用传统数据库？

| 传统方案（PostgreSQL） | 本方案（IndexedDB） |
|----------------------|-------------------|
| 需要搭建后端服务器 | 纯前端，无需后端 |
| 需要处理认证、授权 | 无需认证（单用户） |
| 运维成本高 | 零运维 |
| 服务器费用 $20-50/月 | 完全免费 |
| 复杂的数据库设计 | 简单的 JSON 存储 |
| 开发时间 2-3 个月 | 开发时间 9-10 天 |

**结论**：对于只读、单用户的场景，IndexedDB 完全够用，且更简单。

### 性能考虑

**IndexedDB 能处理多少数据？**
- 存储限制：通常 500MB - 2GB（视浏览器而定）
- 查询性能：13,000 条帖子查询 < 100ms
- 加载速度：初次加载 30MB JSON < 1 秒

**优化策略：**
- 使用索引加速查询（timestamp, tags）
- 虚拟滚动减少 DOM 数量
- Web Worker 解析 ZIP（避免阻塞 UI）
- 图片懒加载节省内存

---

## 九、安全与隐私

### 数据安全
- ✅ 数据存储在用户浏览器本地
- ✅ 不上传到任何服务器
- ✅ 完全离线可用
- ✅ 用户可随时清除数据

### 注意事项
- ⚠️ 提醒用户定期导出备份
- ⚠️ 不要在公共电脑上使用
- ⚠️ 清除浏览器数据会丢失存档

---

## 十、总结

这是一个**极简但完整**的解决方案：

- 🎯 **核心目标**：解决"每次上传"和"刷新丢失"的问题 ✅
- ⚡ **技术方案**：纯前端 + IndexedDB
- 💰 **成本**：完全免费
- 🚀 **开发时间**：9-10 天
- 🔒 **隐私**：数据完全本地化

**下一步**：开始搭建项目 🚀
