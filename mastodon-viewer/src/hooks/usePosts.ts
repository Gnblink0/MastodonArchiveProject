import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useMemo } from 'react'

// Object URL缓存，避免重复创建
const urlCache = new Map<string, string>()

function getCachedUrl(key: string, blob: Blob): string {
  if (!urlCache.has(key)) {
    urlCache.set(key, URL.createObjectURL(blob))
  }
  return urlCache.get(key)!
}

// 获取所有账号
export function useAccounts() {
  return useLiveQuery(async () => {
    const accounts = await db.getAllAccounts()

    // 为每个账号生成 Object URL（使用缓存）
    return accounts.map(account => {
      const updated = { ...account }
      if (account.avatarBlob) {
        updated.avatarUrl = getCachedUrl(`${account.id}-avatar`, account.avatarBlob)
      }
      if (account.headerBlob) {
        updated.headerUrl = getCachedUrl(`${account.id}-header`, account.headerBlob)
      }
      return updated
    })
  })
}

// 获取单个账号
export function useAccount(accountId?: string) {
  const data = useLiveQuery(async () => {
    if (!accountId) return undefined

    const account = await db.accounts.get(accountId)
    if (!account) return null
    return account
  }, [accountId])

  // 使用 useMemo 缓存带有 URL 的账号对象
  return useMemo(() => {
    if (data === undefined || data === null) return data

    const accountWithUrls = { ...data }
    if (data.avatarBlob) {
      accountWithUrls.avatarUrl = getCachedUrl(`${data.id}-avatar`, data.avatarBlob)
    }
    if (data.headerBlob) {
      accountWithUrls.headerUrl = getCachedUrl(`${data.id}-header`, data.headerBlob)
    }

    return accountWithUrls
  }, [data])
}

// 获取帖子（支持按账号过滤）
export function usePosts(limit = 20, offset = 0, accountId?: string) {
  return useLiveQuery(
    async () => {
      if (accountId) {
        // 查询单个账号的帖子
        const posts = await db.posts
          .where('accountId')
          .equals(accountId)
          .reverse()
          .offset(offset)
          .limit(limit)
          .toArray()
        return posts
      } else {
        // 查询所有账号的帖子（混合显示）
        const posts = await db.posts
          .orderBy('timestamp')
          .reverse()
          .offset(offset)
          .limit(limit)
          .toArray()
        return posts
      }
    },
    [limit, offset, accountId]
  )
}

// 获取帖子总数（支持按账号过滤）
export function usePostsCount(accountId?: string) {
  return useLiveQuery(async () => {
    if (accountId) {
      return await db.posts.where('accountId').equals(accountId).count()
    } else {
      return await db.posts.count()
    }
  }, [accountId])
}

// 兼容旧代码：useActor 改为获取第一个账号
// @deprecated 请使用 useAccount(accountId) 代替
export function useActor() {
  return useLiveQuery(async () => {
    const accounts = await db.getAllAccounts()
    if (accounts.length === 0) return undefined

    const account = accounts[0]

    // 从 Blob 重新生成 Object URL（解决刷新后失效的问题）
    if (account.avatarBlob) {
      account.avatarUrl = URL.createObjectURL(account.avatarBlob)
    }
    if (account.headerBlob) {
      account.headerUrl = URL.createObjectURL(account.headerBlob)
    }

    return account
  })
}

export function useMedia(mediaIds: string[]) {
  return useLiveQuery(
    async () => {
      if (mediaIds.length === 0) return []
      const mediaItems = await db.media.where('id').anyOf(mediaIds).toArray()

      // 从 Blob 重新生成 Object URL
      return mediaItems.map(m => {
        console.log('Media item debug:', {
          id: m.id,
          filename: m.filename,
          type: m.type,
          blobType: m.blob?.type,
          blobSize: m.blob?.size,
          hasBlob: !!m.blob
        })
        return {
          ...m,
          url: m.blob ? URL.createObjectURL(m.blob) : m.url
        }
      })
    },
    [mediaIds.join(',')]
  )
}
