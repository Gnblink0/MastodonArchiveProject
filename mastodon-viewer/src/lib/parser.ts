import JSZip from 'jszip'
import * as pako from 'pako'
import untar from 'js-untar'
import { db } from './db'
import type {
  Actor,
  Post,
  Media,
  Like,
  Bookmark,
  ArchiveMetadata,
  ParseProgress,
  ActivityPubActor,
  ActivityPubActivity,
  ActivityPubNote
} from '../types'

// Unified file interface for both ZIP and tar.gz
interface ArchiveFile {
  name: string
  dir: boolean
  async(type: 'string'): Promise<string>
  async(type: 'blob'): Promise<Blob>
  async(type: 'arraybuffer'): Promise<ArrayBuffer>
}

interface ArchiveContainer {
  file(path: string): ArchiveFile | null
  file(regex: RegExp): ArchiveFile[]
  forEach(callback: (relativePath: string, file: ArchiveFile) => void): void
}

export class ArchiveParser {
  private onProgress?: (progress: ParseProgress) => void

  constructor(onProgress?: (progress: ParseProgress) => void) {
    this.onProgress = onProgress
  }

  async parseArchive(file: File): Promise<ArchiveMetadata> {
    this.reportProgress('开始解析', 0, 100)

    // Detect file type and load appropriate format
    const container = await this.loadArchive(file)

    // 调试：列出所有文件
    console.log('=== 存档文件列表 ===')
    container.forEach((relativePath, archiveFile) => {
      console.log(relativePath, archiveFile.dir ? '(目录)' : '(文件)')
    })
    console.log('===================')

    // 解析各个部分
    const actor = await this.parseActor(container)
    const posts = await this.parsePosts(container)
    const likes = await this.parseLikes(container)
    const bookmarks = await this.parseBookmarks(container)
    const media = await this.parseMedia(container)

    // 保存到数据库
    await this.saveToDatabase(actor, posts, likes, bookmarks, media)

    // 创建元数据
    const metadata: ArchiveMetadata = {
      id: 'current',
      uploadedAt: new Date(),
      totalPosts: posts.length,
      totalLikes: likes.length,
      totalBookmarks: bookmarks.length,
      totalMedia: media.length,
      originalFilename: file.name,
      fileSize: file.size
    }

    await db.metadata.put(metadata)

    this.reportProgress('完成', 100, 100)

    return metadata
  }

  private async loadArchive(file: File): Promise<ArchiveContainer> {
    const filename = file.name.toLowerCase()

    if (filename.endsWith('.tar.gz') || filename.endsWith('.tgz')) {
      this.reportProgress('解压 tar.gz 文件', 10, 100)
      return await this.loadTarGz(file)
    } else {
      this.reportProgress('解压 ZIP 文件', 10, 100)
      return await this.loadZip(file)
    }
  }

  private async loadZip(file: File): Promise<ArchiveContainer> {
    const zip = await JSZip.loadAsync(file)
    // JSZip already implements our interface, just wrap it
    return zip as any as ArchiveContainer
  }

  private async loadTarGz(file: File): Promise<ArchiveContainer> {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Decompress gzip
    const decompressed = pako.ungzip(new Uint8Array(arrayBuffer))

    // Extract tar
    const files = await untar(decompressed.buffer)

    // Create a container that mimics JSZip's interface
    const fileMap = new Map<string, any>()
    const fileList: any[] = []

    for (const file of files) {
      const archiveFile = {
        name: file.name,
        dir: file.type === '5', // Directory type in tar
        async(type: 'string' | 'blob' | 'arraybuffer'): Promise<any> {
          if (type === 'string') {
            return Promise.resolve(new TextDecoder().decode(file.buffer))
          } else if (type === 'blob') {
            return Promise.resolve(new Blob([file.buffer]))
          } else if (type === 'arraybuffer') {
            return Promise.resolve(file.buffer)
          }
          throw new Error(`Unknown type: ${type}`)
        }
      }

      fileMap.set(file.name, archiveFile)
      fileList.push(archiveFile)
    }

    return {
      file(pathOrRegex: string | RegExp): any {
        if (typeof pathOrRegex === 'string') {
          return fileMap.get(pathOrRegex) || null
        } else {
          return fileList.filter(f => pathOrRegex.test(f.name))
        }
      },
      forEach(callback: (relativePath: string, file: any) => void): void {
        fileList.forEach(f => callback(f.name, f))
      }
    }
  }

  private async parseActor(container: ArchiveContainer): Promise<Actor> {
    this.reportProgress('解析用户信息', 0, 1)

    // 查找 actor.json（支持根目录或子目录）
    let actorFile = container.file('actor.json')

    if (!actorFile) {
      // 尝试在所有文件中查找
      const actorFiles = container.file(/actor\.json$/i)
      if (actorFiles.length > 0) {
        actorFile = actorFiles[0]
        console.log(`在 ${actorFile.name} 找到 actor.json`)
      }
    }

    if (!actorFile) {
      throw new Error('找不到 actor.json 文件。请确认这是一个有效的 Mastodon 存档。')
    }

    const jsonStr = await actorFile.async('string')
    const json: ActivityPubActor = JSON.parse(jsonStr)

    // 提取头像
    let avatarBlob: Blob | undefined
    let avatarUrl: string | undefined
    if (json.icon?.url) {
      const avatarFile = container.file(json.icon.url)
      if (avatarFile) {
        avatarBlob = await avatarFile.async('blob')
        avatarUrl = URL.createObjectURL(avatarBlob)
      }
    }

    // 提取封面
    let headerBlob: Blob | undefined
    let headerUrl: string | undefined
    if (json.image?.url) {
      const headerFile = container.file(json.image.url)
      if (headerFile) {
        headerBlob = await headerFile.async('blob')
        headerUrl = URL.createObjectURL(headerBlob)
      }
    }

    const actor: Actor = {
      id: json.id,
      preferredUsername: json.preferredUsername,
      displayName: json.name,
      summary: json.summary,
      avatarBlob,
      avatarUrl,
      headerBlob,
      headerUrl,
      fields: json.attachment?.map(a => ({
        name: a.name,
        value: a.value
      })) || [],
      createdAt: new Date(json.published)
    }

    this.reportProgress('解析用户信息', 1, 1)

    return actor
  }

  private async parsePosts(container: ArchiveContainer): Promise<Post[]> {
    // 查找 outbox.json
    let outboxFile = container.file('outbox.json')
    if (!outboxFile) {
      const outboxFiles = container.file(/outbox\.json$/i)
      if (outboxFiles.length > 0) {
        outboxFile = outboxFiles[0]
        console.log(`在 ${outboxFile.name} 找到 outbox.json`)
      }
    }

    if (!outboxFile) {
      throw new Error('找不到 outbox.json 文件。请确认这是一个有效的 Mastodon 存档。')
    }

    const jsonStr = await outboxFile.async('string')
    const json = JSON.parse(jsonStr)
    const items: ActivityPubActivity[] = json.orderedItems || []

    this.reportProgress('解析帖子', 0, items.length)

    const posts: Post[] = []
    let skippedCount = 0

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      if (item.type === 'Create' && typeof item.object === 'object') {
        const obj = item.object as ActivityPubNote

        // 确保有有效的 ID
        if (!obj.id) {
          console.warn(`跳过没有 ID 的帖子 (索引 ${i})`)
          skippedCount++
          continue
        }

        // Helper to extract ID from URL handling trailing slashes
        const extractId = (url: string) => {
           if (!url) return url
           const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url
           return cleanUrl.split('/').pop() || url
        }

        const postId = extractId(obj.id)
        const inReplyToId = obj.inReplyTo ? extractId(obj.inReplyTo) : undefined

        posts.push({
          id: postId,
          activityId: obj.id,
          type: 'post',
          content: obj.content || '',
          contentText: this.stripHtml(obj.content || ''),
          publishedAt: new Date(obj.published),
          timestamp: new Date(obj.published).getTime(),
          tags: obj.tag?.filter(t => t.type === 'Hashtag')
                       .map(t => t.name?.replace('#', '') || '') || [],
          mediaIds: obj.attachment?.map(a => {
            // Simple helper to get filename from URL
            const getFilename = (url: string) => {
               const clean = url.split('?')[0]
               return clean.split('/').pop() || ''
            }
            return getFilename(a.url)
          }) || [],
          inReplyTo: inReplyToId,
          sensitive: obj.sensitive || false,
          summary: obj.summary
        })
      } else if (item.type === 'Announce') {
        // 确保有有效的 ID
        if (!item.id) {
          console.warn(`跳过没有 ID 的转发 (索引 ${i})`)
          skippedCount++
          continue
        }

        const postId = item.id.split('/').pop() || item.id

        posts.push({
          id: postId,
          activityId: item.id,
          type: 'boost',
          content: '',
          contentText: '',
          publishedAt: new Date(item.published),
          timestamp: new Date(item.published).getTime(),
          tags: [],
          mediaIds: [],
          sensitive: false,
          boostedPostId: typeof item.object === 'string' ? item.object : undefined
        })
      }

      if ((i + 1) % 100 === 0) {
        this.reportProgress('解析帖子', i + 1, items.length)
      }
    }

    this.reportProgress('解析帖子', items.length, items.length)

    if (skippedCount > 0) {
      console.log(`跳过了 ${skippedCount} 条无效帖子，成功解析 ${posts.length} 条`)
    }

    return posts
  }

  private async parseMedia(container: ArchiveContainer): Promise<Media[]> {
    const mediaFiles = container.file(/^media_attachments\//)

    this.reportProgress('解析媒体文件', 0, mediaFiles.length)

    const media: Media[] = []

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i]

      // 跳过目录
      if (file.dir) continue

      const filename = file.name.split('/').pop() || ''

      // Detect MIME type from filename extension
      const mimeType = this.getMimeTypeFromFilename(filename)

      // Get blob data and create properly typed blob
      const arrayBuffer = await file.async('arraybuffer')
      const blob = new Blob([arrayBuffer], { type: mimeType })

      console.log('Parsing media file:', {
        filename,
        detectedMimeType: mimeType,
        blobType: blob.type,
        blobSize: blob.size
      })

      // Use filename as ID to match parsePosts logic
      const id = filename

      media.push({
        id,
        filename,
        type: this.detectMediaType(mimeType),
        blob,
        url: URL.createObjectURL(blob)
      })

      if ((i + 1) % 10 === 0) {
        this.reportProgress('解析媒体文件', i + 1, mediaFiles.length)
      }
    }

    this.reportProgress('解析媒体文件', mediaFiles.length, mediaFiles.length)

    return media
  }

  private async parseLikes(container: ArchiveContainer): Promise<Like[]> {
    // 查找 likes.json（可选文件）
    let likesFile = container.file('likes.json')
    if (!likesFile) {
      const likesFiles = container.file(/likes\.json$/i)
      if (likesFiles.length > 0) {
        likesFile = likesFiles[0]
        console.log(`在 ${likesFile.name} 找到 likes.json`)
      }
    }
    if (!likesFile) {
      console.log('未找到 likes.json，跳过点赞记录')
      return []
    }

    this.reportProgress('解析点赞记录', 0, 1)

    const jsonStr = await likesFile.async('string')
    const json = JSON.parse(jsonStr)
    const items = json.orderedItems || []

    const likes: Like[] = items.map((item: any) => ({
      id: item.id,
      activityId: item.id,
      likedPostId: item.object,
      likedAt: new Date(item.published || Date.now())
    }))

    this.reportProgress('解析点赞记录', 1, 1)

    return likes
  }

  private async parseBookmarks(container: ArchiveContainer): Promise<Bookmark[]> {
    // 查找 bookmarks.json（可选文件）
    let bookmarksFile = container.file('bookmarks.json')
    if (!bookmarksFile) {
      const bookmarksFiles = container.file(/bookmarks\.json$/i)
      if (bookmarksFiles.length > 0) {
        bookmarksFile = bookmarksFiles[0]
        console.log(`在 ${bookmarksFile.name} 找到 bookmarks.json`)
      }
    }
    if (!bookmarksFile) {
      console.log('未找到 bookmarks.json，跳过书签记录')
      return []
    }

    this.reportProgress('解析书签记录', 0, 1)

    const jsonStr = await bookmarksFile.async('string')
    const json = JSON.parse(jsonStr)
    const items = json.orderedItems || []

    const bookmarks: Bookmark[] = items.map((item: any) => ({
      id: item.id,
      activityId: item.id,
      bookmarkedPostId: item.object,
      bookmarkedAt: new Date(item.published || Date.now())
    }))

    this.reportProgress('解析书签记录', 1, 1)

    return bookmarks
  }

  private async saveToDatabase(
    actor: Actor,
    posts: Post[],
    likes: Like[],
    bookmarks: Bookmark[],
    media: Media[]
  ) {
    this.reportProgress('保存到数据库', 0, 100)

    // 过滤掉无效 ID 并去重
    const validPosts = posts.filter(p => p.id && typeof p.id === 'string')
    const uniquePosts = Array.from(
      new Map(validPosts.map(p => [p.id, p])).values()
    )

    console.log(`原始: ${posts.length} 条，有效: ${validPosts.length} 条，去重后: ${uniquePosts.length} 条`)

    // 过滤无效的 likes 和 bookmarks
    const validLikes = likes.filter(l => l.id && typeof l.id === 'string')
    const validBookmarks = bookmarks.filter(b => b.id && typeof b.id === 'string')
    const validMedia = media.filter(m => m.id && typeof m.id === 'string')

    await db.transaction('rw', [db.actor, db.posts, db.likes, db.bookmarks, db.media], async () => {
      // 清空旧数据
      await db.actor.clear()
      await db.posts.clear()
      await db.likes.clear()
      await db.bookmarks.clear()
      await db.media.clear()

      // 使用 bulkPut 代替 bulkAdd，这样会覆盖而不是报错
      await db.actor.put(actor)

      if (uniquePosts.length > 0) {
        await db.posts.bulkPut(uniquePosts)
      }

      if (validLikes.length > 0) {
        await db.likes.bulkPut(validLikes)
      }

      if (validBookmarks.length > 0) {
        await db.bookmarks.bulkPut(validBookmarks)
      }

      if (validMedia.length > 0) {
        await db.media.bulkPut(validMedia)
      }
    })

    this.reportProgress('保存到数据库', 100, 100)
  }

  private stripHtml(html: string): string {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  private getMimeTypeFromFilename(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop() || ''

    // Image types
    const imageTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon'
    }

    // Video types
    const videoTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogg': 'video/ogg',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska'
    }

    // Audio types
    const audioTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'm4a': 'audio/mp4',
      'flac': 'audio/flac'
    }

    return imageTypes[ext] || videoTypes[ext] || audioTypes[ext] || 'application/octet-stream'
  }

  private detectMediaType(mimeType: string): Media['type'] {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    return 'unknown'
  }

  private reportProgress(stage: string, progress: number, total: number) {
    this.onProgress?.({ stage, progress, total })
  }
}
