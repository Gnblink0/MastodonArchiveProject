import Dexie, { type EntityTable } from 'dexie'
import type { Actor, Post, Media, Like, Bookmark, ArchiveMetadata } from '../types'

// 定义数据库类
class MastodonArchiveDB extends Dexie {
  actor!: EntityTable<Actor, 'id'>
  posts!: EntityTable<Post, 'id'>
  media!: EntityTable<Media, 'id'>
  likes!: EntityTable<Like, 'id'>
  bookmarks!: EntityTable<Bookmark, 'id'>
  metadata!: EntityTable<ArchiveMetadata, 'id'>

  constructor() {
    super('MastodonArchive')

    this.version(1).stores({
      actor: 'id',
      posts: 'id, timestamp, *tags, publishedAt, type',
      media: 'id, type',
      likes: 'id, likedAt, likedPostId',
      bookmarks: 'id, bookmarkedAt, bookmarkedPostId',
      metadata: 'id'
    })

    this.version(2).stores({
      posts: 'id, timestamp, *tags, publishedAt, type, inReplyTo'
    })

    this.version(3).stores({
      posts: 'id, timestamp, *tags, publishedAt, type, inReplyTo, visibility'
    })
  }

  // 清空所有数据
  async clearAll() {
    await this.transaction('rw', [this.actor, this.posts, this.media, this.likes, this.bookmarks, this.metadata], async () => {
      await this.actor.clear()
      await this.posts.clear()
      await this.media.clear()
      await this.likes.clear()
      await this.bookmarks.clear()
      await this.metadata.clear()
    })
  }

  // 获取存档元数据
  async getMetadata(): Promise<ArchiveMetadata | undefined> {
    return await this.metadata.get('current')
  }

  // 检查是否有数据
  async hasData(): Promise<boolean> {
    const count = await this.posts.count()
    return count > 0
  }
}

// 导出数据库实例
export const db = new MastodonArchiveDB()

// 导出类型以便在其他地方使用
export type { MastodonArchiveDB }
