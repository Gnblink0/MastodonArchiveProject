import Dexie, { type EntityTable } from 'dexie'
import type { Actor, Account, Post, Media, Like, Bookmark, ArchiveMetadata, ImportRecord } from '../types'

// 定义数据库类
class MastodonArchiveDB extends Dexie {
  actor!: EntityTable<Actor, 'id'>
  accounts!: EntityTable<Account, 'id'>  // 新增：多账号支持
  posts!: EntityTable<Post, 'id'>
  media!: EntityTable<Media, 'id'>
  likes!: EntityTable<Like, 'id'>
  bookmarks!: EntityTable<Bookmark, 'id'>
  metadata!: EntityTable<ArchiveMetadata, 'id'>
  importHistory!: EntityTable<ImportRecord, 'id'>

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

    // Version 4: 多账号支持
    this.version(4).stores({
      accounts: 'id, preferredUsername, lastUpdatedAt',
      posts: 'id, [accountId+timestamp], accountId, timestamp, *tags, publishedAt, type, inReplyTo, visibility',
      media: 'id, accountId, [accountId+type], type',
      likes: 'id, accountId, [accountId+likedAt], likedAt, likedPostId',
      bookmarks: 'id, accountId, [accountId+bookmarkedAt], bookmarkedAt, bookmarkedPostId',
      metadata: 'id, accountId',
      actor: null  // 删除旧的 actor 表
    })

    // Version 5: Import History
    this.version(5).stores({
      importHistory: '++id, accountId, importedAt'
    }).upgrade(async (trans) => {
      console.log('Migrating to Version 5: Creating Import History...')
      const allMetadata = await trans.table('metadata').toArray()
      
      for (const meta of allMetadata) {
        if (!meta.accountId) continue
        
        // Convert existing metadata to an import record
        const record: ImportRecord = {
          accountId: meta.accountId,
          importedAt: meta.uploadedAt || new Date(),
          fileName: meta.originalFilename || 'Unknown Archive',
          fileSize: meta.fileSize || 0,
          stats: {
            posts: meta.totalPosts || 0,
            likes: meta.totalLikes || 0,
            bookmarks: meta.totalBookmarks || 0,
            media: meta.totalMedia || 0
          },
          importStrategy: 'replace' // Assume replace for legacy imports
        }
        
        await trans.table('importHistory').add(record)
        console.log(`Migrated metadata for account ${meta.accountId} to history.`)
      }
    })
  }

  // 清空所有数据（保留用于完全重置）
  async clearAll() {
    await this.transaction('rw', [this.accounts, this.posts, this.media, this.likes, this.bookmarks, this.metadata, this.importHistory], async () => {
      await this.accounts.clear()
      await this.posts.clear()
      await this.media.clear()
      await this.likes.clear()
      await this.bookmarks.clear()
      await this.metadata.clear()
      await this.importHistory.clear()
    })
  }

  // 删除单个账号的所有数据
  async clearAccount(accountId: string) {
    await this.transaction('rw', [this.accounts, this.posts, this.media, this.likes, this.bookmarks, this.metadata, this.importHistory], async () => {
      // 删除账号数据
      await this.posts.where('accountId').equals(accountId).delete()
      await this.media.where('accountId').equals(accountId).delete()
      await this.likes.where('accountId').equals(accountId).delete()
      await this.bookmarks.where('accountId').equals(accountId).delete()
      await this.metadata.where('accountId').equals(accountId).delete()
      await this.importHistory.where('accountId').equals(accountId).delete()
      await this.accounts.delete(accountId)
    })
  }

  // 获取所有账号
  async getAllAccounts(): Promise<Account[]> {
    return await this.accounts.orderBy('lastUpdatedAt').reverse().toArray()
  }

  // 检查账号是否存在
  async hasAccount(accountId: string): Promise<boolean> {
    const account = await this.accounts.get(accountId)
    return !!account
  }

  // 获取存档元数据（已废弃，改用 getAccountMetadata）
  async getMetadata(): Promise<ArchiveMetadata | undefined> {
    // 兼容旧代码：返回第一个账号的 metadata
    const accounts = await this.getAllAccounts()
    if (accounts.length === 0) return undefined
    return await this.metadata.get(accounts[0].id)
  }

  // 获取指定账号的元数据
  async getAccountMetadata(accountId: string): Promise<ArchiveMetadata | undefined> {
    return await this.metadata.get(accountId)
  }

  // Get import history for an account
  async getImportHistory(accountId: string): Promise<ImportRecord[]> {
    return await this.importHistory
      .where('accountId')
      .equals(accountId)
      .reverse() // Newest first
      .sortBy('importedAt')
  }

  // Add an import record
  async addImportRecord(record: ImportRecord): Promise<number> {
    return (await this.importHistory.add(record)) as number
  }

  // 检查是否有数据
  async hasData(): Promise<boolean> {
    const count = await this.accounts.count()
    return count > 0
  }
}

// 导出数据库实例
export const db = new MastodonArchiveDB()

// 导出类型以便在其他地方使用
export type { MastodonArchiveDB }
