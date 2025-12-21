import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js'
import type { Entry } from '@zip.js/zip.js'
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
    // Use zip.js for better large file support (>2GB)
    const zipFileReader = new BlobReader(file)
    const zipReader = new ZipReader(zipFileReader)
    const entries = await zipReader.getEntries()

    // Create a map for fast lookup
    const fileMap = new Map<string, Entry>()
    for (const entry of entries) {
      fileMap.set(entry.filename, entry)
    }

    // Wrapper to convert zip.js Entry to our ArchiveFile interface
    const wrapEntry = (entry: Entry): ArchiveFile => {
      const asyncMethod = async (type: 'string' | 'blob' | 'arraybuffer'): Promise<any> => {
        if (entry.directory) {
          return type === 'string' ? '' : new ArrayBuffer(0)
        }

        if (!entry.getData) {
          throw new Error(`Entry ${entry.filename} has no getData method`)
        }

        if (type === 'string') {
          const blob = await entry.getData(new BlobWriter())
          return blob.text()
        } else if (type === 'blob') {
          return entry.getData(new BlobWriter())
        } else if (type === 'arraybuffer') {
          const blob = await entry.getData(new BlobWriter())
          return blob.arrayBuffer()
        }
        throw new Error(`Unknown type: ${type}`)
      }

      return {
        name: entry.filename,
        dir: entry.directory,
        async: asyncMethod
      }
    }

    return {
      file(pathOrRegex: string | RegExp): any {
        if (typeof pathOrRegex === 'string') {
          const entry = fileMap.get(pathOrRegex)
          return entry ? wrapEntry(entry) : null
        } else {
          return entries
            .filter(e => pathOrRegex.test(e.filename))
            .map(e => wrapEntry(e))
        }
      },
      forEach(callback: (relativePath: string, file: ArchiveFile) => void): void {
        entries.forEach(entry => {
          callback(entry.filename, wrapEntry(entry))
        })
      }
    }
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
      const type = item.type ? item.type.toLowerCase() : ''

      if (type === 'create' && typeof item.object === 'object') {
        const obj = item.object as ActivityPubNote

        // 确保有有效的 ID
        if (!obj.id) {
          // Fallback: use url if id is missing or not a string
          if (obj.url) {
             obj.id = obj.url
          } else {
             console.warn(`跳过没有 ID 的帖子 (索引 ${i})`)
             skippedCount++
             continue
          }
        }

        // Helper to extract ID from URL handling trailing slashes
        const extractId = (url: string) => {
           if (!url) return url
           const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url
           return cleanUrl.split('/').pop() || url
        }

        const postId = extractId(obj.id)
        const inReplyToId = obj.inReplyTo ? extractId(obj.inReplyTo) : undefined
        
        // Determine Visibility
        // Public: in to field and matches public constant
        // Unlisted: in cc field and matches public constant
        // Private: followers only
        // Direct: specific users only
        const PUBLIC_COLLECTION = 'https://www.w3.org/ns/activitystreams#Public'
        let visibility: 'public' | 'unlisted' | 'private' | 'direct' = 'direct'
        
        const to = obj.to || []
        const cc = obj.cc || []
        
        if (to.includes(PUBLIC_COLLECTION)) {
          visibility = 'public'
        } else if (cc.includes(PUBLIC_COLLECTION)) {
          visibility = 'unlisted'
        } else if (to.some(url => url.includes('followers'))) {
          // Simplistic check for followers collection
          visibility = 'private'
        }

        // Extract Mentions
        const mentions = obj.tag?.filter(t => t.type === 'Mention').map(t => ({ // Fix: t.type casing might vary, usually 'Mention'
             name: t.name || '',
             url: t.href || ''
        })) || []

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
          mentions,
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
          visibility,
          summary: obj.summary,
          originalUrl: obj.id
        })
      } else if (type === 'announce') {
        // Boosts often have the same ID structure or might be duplicated in some exports
        // We append the index 'i' to ensure uniqueness in our local DB if the ID is generic or reused
        const rawId = item.id ? (item.id.split('/').pop() || item.id) : `boost-${i}`
        const postId = `${rawId}-${i}`

        // Extract boosted ID/URL safely handling both string and object forms of 'object'
        let boostedPostId: string | undefined
        let originalUrl: string | undefined

        if (typeof item.object === 'string') {
          boostedPostId = item.object
          originalUrl = item.object
        } else if (item.object && typeof item.object === 'object') {
           boostedPostId = item.object.id || item.object.url
           originalUrl = item.object.url || item.object.id
        }

        console.log(`Found Boost (Index ${i}):`, { postId, boostedPostId })

        posts.push({
          id: postId,
          activityId: item.id || '',
          type: 'boost',
          content: '',
          contentText: '',
          publishedAt: new Date(item.published),
          timestamp: new Date(item.published).getTime(),
          tags: [],
          mentions: [],
          mediaIds: [],
          sensitive: false,
          visibility: 'public', // Boosts are usually public
          boostedPostId,
          originalUrl: originalUrl || item.id
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
    const BATCH_SIZE = 20 // Process 20 files concurrently

    for (let i = 0; i < mediaFiles.length; i += BATCH_SIZE) {
      const batch = mediaFiles.slice(i, i + BATCH_SIZE)
      
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          // Skip directories
          if (file.dir) return null

          const filename = file.name.split('/').pop() || ''
          // Detect MIME type
          const mimeType = this.getMimeTypeFromFilename(filename)

          try {
             // Get blob data
             const arrayBuffer = await file.async('arraybuffer')
             const blob = new Blob([arrayBuffer], { type: mimeType })
             
             // Use filename as ID
             const id = filename

             return {
                id,
                filename,
                type: this.detectMediaType(mimeType),
                blob,
                url: URL.createObjectURL(blob)
             }
          } catch (e) {
             console.error(`Failed to parse media file ${filename}`, e)
             return null
          }
        })
      )

      // Filter out nulls (directories or failed files) and add to results
      const validResults = batchResults.filter((m): m is Media => m !== null)
      media.push(...validResults)

      // Report progress based on actual processed count
      this.reportProgress('解析媒体文件', Math.min(i + BATCH_SIZE, mediaFiles.length), mediaFiles.length)
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

    const likes: Like[] = items.map((item: any, index: number) => {
      // Handle case where item is just a string URL (common in some exports)
      if (typeof item === 'string') {
        return {
          id: `like-${index}-${Date.now()}`, // Generate a synthetic ID
          activityId: `like-${index}`,
          likedPostId: item,
          targetUrl: item,
          likedAt: undefined // No date available
        }
      }

      // Handle standard ActivityPub object format
      const targetUrl = typeof item.object === 'string' ? item.object : item.object?.id || item.object?.url
      return {
        id: item.id || `like-${index}-${Date.now()}`,
        activityId: item.id || `like-${index}`,
        likedPostId: targetUrl,
        targetUrl: targetUrl,
        likedAt: new Date(item.published || Date.now())
      }
    })

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

    const bookmarks: Bookmark[] = items.map((item: any, index: number) => {
      // Handle case where item is just a string URL
      if (typeof item === 'string') {
        return {
          id: `bookmark-${index}-${Date.now()}`, // Generate synthetic ID
          activityId: `bookmark-${index}`,
          bookmarkedPostId: item,
          targetUrl: item,
          bookmarkedAt: undefined // No date available
        }
      }

      // Handle standard ActivityPub object format
      const targetUrl = typeof item.object === 'string' ? item.object : item.object?.id || item.object?.url
      return {
        id: item.id || `bookmark-${index}-${Date.now()}`,
        activityId: item.id || `bookmark-${index}`,
        bookmarkedPostId: targetUrl,
        targetUrl: targetUrl,
        bookmarkedAt: new Date(item.published || Date.now())
      }
    })

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
    this.reportProgress('准备保存...', 0, 100)

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

    // 1. 清空旧数据
    this.reportProgress('清空旧数据...', 0, 100)
    await db.transaction('rw', [db.actor, db.posts, db.likes, db.bookmarks, db.media], async () => {
      await db.actor.clear()
      await db.posts.clear()
      await db.likes.clear()
      await db.bookmarks.clear()
      await db.media.clear()
      
      // 保存用户信息
      await db.actor.put(actor)
    })

    // 2. 分批保存帖子
    const POST_BATCH_SIZE = 2000
    for (let i = 0; i < uniquePosts.length; i += POST_BATCH_SIZE) {
      const batch = uniquePosts.slice(i, i + POST_BATCH_SIZE)
      await db.posts.bulkPut(batch)
      this.reportProgress('正在保存帖子...', Math.min(i + batch.length, uniquePosts.length), uniquePosts.length)
    }

    // 3. 分批保存媒体文件
    // 媒体文件包含 Blob，需要更小的批次以避免内存问题
    const MEDIA_BATCH_SIZE = 50
    for (let i = 0; i < validMedia.length; i += MEDIA_BATCH_SIZE) {
      const batch = validMedia.slice(i, i + MEDIA_BATCH_SIZE)
      await db.media.bulkPut(batch)
      this.reportProgress('正在保存媒体文件...', Math.min(i + batch.length, validMedia.length), validMedia.length)
    }

    // 4. 分批保存点赞
    const LIKE_BATCH_SIZE = 5000
    for (let i = 0; i < validLikes.length; i += LIKE_BATCH_SIZE) {
      const batch = validLikes.slice(i, i + LIKE_BATCH_SIZE)
      await db.likes.bulkPut(batch)
      this.reportProgress('正在保存点赞...', Math.min(i + batch.length, validLikes.length), validLikes.length)
    }

    // 5. 分批保存书签
    const BOOKMARK_BATCH_SIZE = 5000
    for (let i = 0; i < validBookmarks.length; i += BOOKMARK_BATCH_SIZE) {
      const batch = validBookmarks.slice(i, i + BOOKMARK_BATCH_SIZE)
      await db.bookmarks.bulkPut(batch)
      this.reportProgress('正在保存书签...', Math.min(i + batch.length, validBookmarks.length), validBookmarks.length)
    }

    this.reportProgress('保存完成', 100, 100)
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
