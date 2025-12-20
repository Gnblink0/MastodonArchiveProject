import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

export function usePosts(limit = 20, offset = 0) {
  return useLiveQuery(
    async () => {
      const posts = await db.posts
        .orderBy('timestamp')
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray()

      return posts
    },
    [limit, offset]
  )
}

export function usePostsCount() {
  return useLiveQuery(async () => {
    return await db.posts.count()
  })
}

export function useActor() {
  return useLiveQuery(async () => {
    const actor = await db.actor.toArray().then(actors => actors[0])
    if (!actor) return undefined

    // 从 Blob 重新生成 Object URL（解决刷新后失效的问题）
    if (actor.avatarBlob) {
      actor.avatarUrl = URL.createObjectURL(actor.avatarBlob)
    }
    if (actor.headerBlob) {
      actor.headerUrl = URL.createObjectURL(actor.headerBlob)
    }

    return actor
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
