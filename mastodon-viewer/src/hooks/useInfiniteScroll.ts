import { useState, useEffect, useCallback } from 'react'
import { db } from '../lib/db'
import type { Post } from '../types'

const INITIAL_LOAD = 30
const LOAD_MORE_SIZE = 20

export function useInfiniteScrollPosts() {
  const [posts, setPosts] = useState<Post[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Initial load
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true)
      try {
        const [initialPosts, count] = await Promise.all([
          db.posts
            .orderBy('timestamp')
            .reverse()
            .limit(INITIAL_LOAD)
            .toArray(),
          db.posts.count()
        ])

        setPosts(initialPosts)
        setTotalCount(count)
        setHasMore(initialPosts.length < count)
      } catch (error) {
        console.error('Failed to load initial posts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitial()
  }, [])

  // Load more function
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    try {
      const offset = posts.length
      const morePosts = await db.posts
        .orderBy('timestamp')
        .reverse()
        .offset(offset)
        .limit(LOAD_MORE_SIZE)
        .toArray()

      setPosts(prev => [...prev, ...morePosts])
      setHasMore(posts.length + morePosts.length < totalCount)
    } catch (error) {
      console.error('Failed to load more posts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [posts.length, totalCount, hasMore, isLoading])

  return {
    posts,
    totalCount,
    isLoading,
    hasMore,
    loadMore
  }
}
