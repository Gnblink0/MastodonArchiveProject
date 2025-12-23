import Dexie, { type EntityTable } from 'dexie'
import type { Actor, Account, Post, Media, Like, Bookmark, ArchiveMetadata } from '../types'

// 定义数据库类
class MastodonArchiveDB extends Dexie {
  actor!: EntityTable<Actor, 'id'>
  accounts!: EntityTable<Account, 'id'>  // 新增：多账号支持
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

    // Version 4: 多账号支持
    this.version(4).stores({
      accounts: 'id, preferredUsername, lastUpdatedAt',
      posts: 'id, [accountId+timestamp], accountId, timestamp, *tags, publishedAt, type, inReplyTo, visibility',
      media: 'id, accountId, [accountId+type], type',
      likes: 'id, accountId, [accountId+likedAt], likedAt, likedPostId',
      bookmarks: 'id, accountId, [accountId+bookmarkedAt], bookmarkedAt, bookmarkedPostId',
      metadata: 'id, accountId',
      actor: null  // 删除旧的 actor 表
    }).upgrade(async (trans) => {
      console.log('开始数据库迁移到 Version 4...')

      try {
        // 1. 读取旧的 actor 数据
        const oldActors = await trans.table('actor').toArray()

        if (oldActors.length > 0) {
          const actor = oldActors[0]
          const accountId = actor.id

          console.log(`迁移账号: ${actor.preferredUsername} (${accountId})`)

          // 2. 统计数据
          const postsCount = await trans.table('posts').count()
          const likesCount = await trans.table('likes').count()
          const bookmarksCount = await trans.table('bookmarks').count()

          // 3. 创建新的 account 记录
          const account: Account = {
            ...actor,
            importedAt: new Date(),
            lastUpdatedAt: new Date(),
            postsCount,
            likesCount,
            bookmarksCount
          }

          await trans.table('accounts').add(account)
          console.log('账号记录已创建')

          // 4. 为所有现有数据添加 accountId（批量更新）
          const BATCH_SIZE = 1000

          // 更新 posts
          const allPosts = await trans.table('posts').toArray()
          console.log(`开始更新 ${allPosts.length} 条帖子...`)
          for (let i = 0; i < allPosts.length; i += BATCH_SIZE) {
            const batch = allPosts.slice(i, i + BATCH_SIZE)
            await Promise.all(
              batch.map(post =>
                trans.table('posts').update(post.id, { accountId })
              )
            )
            console.log(`已更新帖子: ${Math.min(i + BATCH_SIZE, allPosts.length)}/${allPosts.length}`)
          }

          // 更新 media
          const allMedia = await trans.table('media').toArray()
          console.log(`开始更新 ${allMedia.length} 个媒体文件...`)
          for (let i = 0; i < allMedia.length; i += BATCH_SIZE) {
            const batch = allMedia.slice(i, i + BATCH_SIZE)
            await Promise.all(
              batch.map(m =>
                trans.table('media').update(m.id, { accountId })
              )
            )
          }

          // 更新 likes
          const allLikes = await trans.table('likes').toArray()
          console.log(`开始更新 ${allLikes.length} 个点赞...`)
          for (let i = 0; i < allLikes.length; i += BATCH_SIZE) {
            const batch = allLikes.slice(i, i + BATCH_SIZE)
            await Promise.all(
              batch.map(like =>
                trans.table('likes').update(like.id, { accountId })
              )
            )
          }

          // 更新 bookmarks
          const allBookmarks = await trans.table('bookmarks').toArray()
          console.log(`开始更新 ${allBookmarks.length} 个书签...`)
          for (let i = 0; i < allBookmarks.length; i += BATCH_SIZE) {
            const batch = allBookmarks.slice(i, i + BATCH_SIZE)
            await Promise.all(
              batch.map(bm =>
                trans.table('bookmarks').update(bm.id, { accountId })
              )
            )
          }

          // 5. 更新 metadata
          const oldMetadata = await trans.table('metadata').get('current')
          if (oldMetadata) {
            await trans.table('metadata').delete('current')
            await trans.table('metadata').add({
              ...oldMetadata,
              id: accountId,
              accountId
            })
            console.log('元数据已更新')
          }

          console.log('数据库迁移完成！')
        } else {
          console.log('没有找到旧数据，跳过迁移')
        }
      } catch (error) {
        console.error('数据库迁移失败:', error)
        throw error
      }
    })
  }

  // 清空所有数据（保留用于完全重置）
  async clearAll() {
    await this.transaction('rw', [this.accounts, this.posts, this.media, this.likes, this.bookmarks, this.metadata], async () => {
      await this.accounts.clear()
      await this.posts.clear()
      await this.media.clear()
      await this.likes.clear()
      await this.bookmarks.clear()
      await this.metadata.clear()
    })
  }

  // 删除单个账号的所有数据
  async clearAccount(accountId: string) {
    await this.transaction('rw', [this.accounts, this.posts, this.media, this.likes, this.bookmarks, this.metadata], async () => {
      // 删除账号数据
      await this.posts.where('accountId').equals(accountId).delete()
      await this.media.where('accountId').equals(accountId).delete()
      await this.likes.where('accountId').equals(accountId).delete()
      await this.bookmarks.where('accountId').equals(accountId).delete()
      await this.metadata.where('accountId').equals(accountId).delete()
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
