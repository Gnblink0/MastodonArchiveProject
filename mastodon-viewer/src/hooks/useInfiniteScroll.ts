import { useState, useEffect, useCallback } from 'react'
import { db } from '../lib/db'
import type { Post } from '../types'

const INITIAL_LOAD = 30
const LOAD_MORE_SIZE = 20

export function useInfiniteScrollPosts(accountId?: string) {
  const [posts, setPosts] = useState<Post[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Initial load - 当 accountId 变化时重新加载
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true)
      try {
        let query = db.posts.orderBy('timestamp').reverse()
        let countQuery = db.posts

        // 如果指定了 accountId，则筛选该账号的帖子
        if (accountId) {
          const allPosts = await db.posts.where('accountId').equals(accountId).toArray()
          const sortedPosts = allPosts.sort((a, b) => b.timestamp - a.timestamp)
          const initialPosts = sortedPosts.slice(0, INITIAL_LOAD)
          const count = sortedPosts.length

          setPosts(initialPosts)
          setTotalCount(count)
          setHasMore(initialPosts.length < count)
        } else {
          // 全部账号
          const [initialPosts, count] = await Promise.all([
            query.limit(INITIAL_LOAD).toArray(),
            countQuery.count()
          ])

          setPosts(initialPosts)
          setTotalCount(count)
          setHasMore(initialPosts.length < count)
        }
      } catch (error) {
        console.error('Failed to load initial posts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitial()
  }, [accountId]) // 添加 accountId 依赖

  // Load more function
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    try {
      const offset = posts.length

      let morePosts: Post[]
      if (accountId) {
        const allPosts = await db.posts.where('accountId').equals(accountId).toArray()
        const sortedPosts = allPosts.sort((a, b) => b.timestamp - a.timestamp)
        morePosts = sortedPosts.slice(offset, offset + LOAD_MORE_SIZE)
      } else {
        morePosts = await db.posts
          .orderBy('timestamp')
          .reverse()
          .offset(offset)
          .limit(LOAD_MORE_SIZE)
          .toArray()
      }

      setPosts(prev => [...prev, ...morePosts])
      setHasMore(posts.length + morePosts.length < totalCount)
    } catch (error) {
      console.error('Failed to load more posts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [posts.length, totalCount, hasMore, isLoading, accountId])

  return {
    posts,
    totalCount,
    isLoading,
    hasMore,
    loadMore
  }
}
