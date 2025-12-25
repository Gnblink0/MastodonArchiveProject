// TypeScript 类型定义

export interface Actor {
  id: string
  preferredUsername: string
  displayName: string
  summary: string // HTML 格式
  avatarBlob?: Blob
  avatarUrl?: string
  headerBlob?: Blob
  headerUrl?: string
  fields: ActorField[]
  createdAt: Date
}

// 新增：Account 接口用于存储多个账号
export interface Account {
  id: string
  preferredUsername: string
  displayName: string
  summary: string
  avatarBlob?: Blob
  avatarUrl?: string
  headerBlob?: Blob
  headerUrl?: string
  fields: ActorField[]
  createdAt: Date
  importedAt: Date        // 首次导入时间
  lastUpdatedAt: Date     // 最后更新时间
  postsCount: number      // 该账号的帖子数
  likesCount: number      // 该账号的点赞数
  bookmarksCount: number  // 该账号的书签数
}

// 12.25 新增emoji接口
export interface CustomEmoji {
  shortcode: string
  url: string
  static_url?: string
  visible_in_picker?: boolean
}

export interface ActorField {
  name: string
  value: string
}

export interface Post {
  id: string
  accountId: string       // 新增：关联到账号
  activityId: string
  type: 'post' | 'boost'
  content: string // HTML 内容
  contentText: string // 纯文本（用于搜索）
  publishedAt: Date
  timestamp: number // Unix 时间戳（用于排序）
  tags: string[]
  emojis: CustomEmoji[]   // <--- 新增：这里加上表情包字段！
  mentions: Array<{ name: string, url: string }>
  mediaIds: string[]
  inReplyTo?: string
  sensitive: boolean
  visibility: 'public' | 'unlisted' | 'private' | 'direct'
  summary?: string // CW 警告
  boostedPostId?: string
  originalUrl?: string
}

export interface Media {
  id: string
  accountId: string       // 新增：关联到账号
  filename: string
  type: 'image' | 'video' | 'audio' | 'unknown'
  blob: Blob
  url: string // Object URL
  width?: number
  height?: number
  blurhash?: string
}

export interface Like {
  id: string
  accountId: string       // 新增：关联到账号
  activityId: string
  likedPostId: string
  targetUrl?: string
  likedAt?: Date
  postPreview?: string
}

export interface Bookmark {
  id: string
  accountId: string       // 新增：关联到账号
  activityId: string
  bookmarkedPostId: string
  targetUrl?: string
  bookmarkedAt?: Date
  postPreview?: string
}

export interface ImportRecord {
  id?: number // Auto-incremented by Dexie
  accountId: string
  importedAt: Date
  fileName: string
  fileSize: number
  stats: {
    posts: number
    likes: number
    bookmarks: number
    media: number
  }
  importStrategy: 'replace' | 'merge'
}

export interface ArchiveMetadata {
  id: string
  accountId: string       // 新增：关联到账号
  uploadedAt: Date
  totalPosts: number
  totalLikes: number
  totalBookmarks: number
  totalMedia: number
  originalFilename: string
  fileSize: number
}

// 解析进度
export interface ParseProgress {
  stage: string
  progress: number
  total: number
}

export type ImportStrategy = 'replace' | 'merge'

export interface AccountConflict {
  accountId: string
  username: string
  displayName: string
}

// 帖子查询过滤器
export interface PostFilters {
  tags?: string[]
  hasMedia?: boolean
  dateFrom?: Date
  dateTo?: Date
  searchKeyword?: string
}

// ActivityPub 原始数据类型
export interface ActivityPubActor {
  '@context': any
  id: string
  type: string
  preferredUsername: string
  name: string
  summary: string
  url: string
  icon?: {
    type: string
    mediaType: string
    url: string
  }
  image?: {
    type: string
    mediaType: string
    url: string
  }
  attachment?: Array<{
    type: string
    name: string
    value: string
  }>
  published: string
}

export interface ActivityPubActivity {
  id: string
  type: string
  actor: string
  published: string
  to?: string[]
  cc?: string[]
  object?: ActivityPubNote | string
}

export interface ActivityPubNote {
  id: string
  type: string
  content: string
  published: string
  url: string
  attributedTo: string
  to?: string[]
  cc?: string[]
  sensitive?: boolean
  summary?: string
  inReplyTo?: string
  tag?: Array<{
    type: string
    name?: string
    href?: string
  }>
  attachment?: Array<{
    type: string
    mediaType: string
    url: string
    name?: string
  }>
}
