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

export interface ActorField {
  name: string
  value: string
}

export interface Post {
  id: string
  activityId: string
  type: 'post' | 'boost'
  content: string // HTML 内容
  contentText: string // 纯文本（用于搜索）
  publishedAt: Date
  timestamp: number // Unix 时间戳（用于排序）
  tags: string[]
  mediaIds: string[]
  inReplyTo?: string
  sensitive: boolean
  summary?: string // CW 警告
  boostedPostId?: string
}

export interface Media {
  id: string
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
  activityId: string
  likedPostId: string
  likedAt: Date
  postPreview?: string
}

export interface Bookmark {
  id: string
  activityId: string
  bookmarkedPostId: string
  bookmarkedAt: Date
  postPreview?: string
}

export interface ArchiveMetadata {
  id: string
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
