import { useState, useEffect, useMemo } from 'react'
import { PostCard } from './PostCard'
import { usePosts, usePostsCount } from '../../hooks/usePosts'
import { Loader2, Search as SearchIcon, X } from 'lucide-react'
import { db } from '../../lib/db'
import type { Post } from '../../types'
import Fuse from 'fuse.js'

interface TimelineProps {
  onPostClick?: (postId: string) => void
}

export function Timeline({ onPostClick }: TimelineProps) {
  const [pageSize] = useState(20)
  const [page, setPage] = useState(1)
  
  // Search State
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Data fetching for normal timeline
  const postsCallback = usePosts(pageSize, (page - 1) * pageSize)
  // usePosts might be returning undefined initially or loading
  // The hook returns: { posts: Post[], loading: boolean, error: Error, hasMore: boolean, total: number } - wait, looking at my previous view_file of Timeline.tsx (step 370), usePosts returns `Post[] | undefined`.
  // Wait, looking at Step 330: `const posts = usePosts(pageSize, (page - 1) * pageSize)`
  // And Step 260/267 showed usePosts source? No, Step 260 viewed usePosts.ts.
  // Let's assume `usePosts` returns `Post[] | undefined` based on previous Timeline.tsx code `if (!posts) return <Loader...>`.
  
  const totalCountDB = usePostsCount()

  // Load all posts for search indexing
  useEffect(() => {
    const loadAllPosts = async () => {
      try {
        const p = await db.posts.toArray()
        setAllPosts(p)
      } catch (e) {
        console.error("Failed to load posts for search", e)
      }
    }
    loadAllPosts()
  }, [])

  // Initialize Fuse
  const fuse = useMemo(() => {
    return new Fuse(allPosts, {
      keys: ['content', 'contentText', 'summary', 'tags'],
      threshold: 0.3,
      ignoreLocation: true,
      includeScore: true
    })
  }, [allPosts])

  // Handle Search Input
  const handleSearch = (val: string) => {
    setQuery(val)
  }

  const clearSearch = () => {
    setQuery('')
    setSearchResults([])
    setIsSearching(false)
    setPage(1)
  }

  // Debounced Search Effect
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timeoutId = setTimeout(() => {
      // Perform search
      if (fuse) {
        const results = fuse.search(query)
          .map(r => r.item)
          .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        setSearchResults(results)
      }
      setIsSearching(false)
      setPage(1) // Reset to first page when results update
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [query, fuse])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Determine what to display
  let displayedPosts: Post[] = []
  let totalItems = 0
  let isLoading = false

  if (query) {
    // Search Mode
    totalItems = searchResults.length
    const start = (page - 1) * pageSize
    const end = start + pageSize
    displayedPosts = searchResults.slice(start, end)
    isLoading = false // client side is instant mostly
  } else {
    // Normal Timeline Mode
    displayedPosts = postsCallback || []
    totalItems = totalCountDB || 0
    isLoading = !postsCallback
  }

  const totalPages = Math.ceil(totalItems / pageSize)
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  if (isLoading && !query) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-mastodon-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pt-4 pb-12">
      {/* Search Bar */}
      <div className="mb-6 px-4">
        <div className={`
            flex items-center w-full bg-mastodon-surface 
            border-2 transition-colors duration-200 rounded-full overflow-hidden
            ${query ? 'border-mastodon-primary' : 'border-mastodon-border hover:border-mastodon-text-secondary focus-within:border-mastodon-text-secondary'}
        `}>
            <div className="pl-4 text-mastodon-text-secondary">
                <SearchIcon className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search posts..."
              className="w-full bg-transparent border-none py-3 px-3 text-mastodon-text-primary placeholder:text-mastodon-text-secondary/50 focus:outline-none focus:ring-0 text-base"
            />
            {query && (
                <button 
                  onClick={clearSearch}
                  className="pr-4 text-mastodon-text-secondary hover:text-white transition-colors cursor-pointer"
                >
                    <X className="w-5 h-5" />
                </button>
            )}
        </div>
        
        {/* Search Stats */}
        {query && (
          <div className="mt-2 ml-2 text-sm text-mastodon-text-secondary">
             {searchResults.length === 0 ? 'No matches found' : `Found ${searchResults.length} matches`}
          </div>
        )}
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {displayedPosts.length === 0 ? (
          <div className="text-center py-12 text-mastodon-text-secondary">
            {query ? 'Try different keywords' : 'No posts in archive'}
          </div>
        ) : (
          <>
            {displayedPosts.map((post) => (
              <PostCard 
                key={post.id} 
                post={post} 
                highlight={query}
                onClick={onPostClick ? () => onPostClick(post.id) : undefined}
              />
            ))}

            {/* Pagination Controls */}
            {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-8 mt-4 border-t border-mastodon-border mx-4">
               <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!hasPrevPage}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-mastodon-surface hover:bg-mastodon-border text-white cursor-pointer"
               >
                  Previous
               </button>
               
               <span className="text-sm text-mastodon-text-secondary">
                  Page {page} of {totalPages}
               </span>

               <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!hasNextPage}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-mastodon-surface hover:bg-mastodon-border text-white cursor-pointer"
               >
                  Next
               </button>
            </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
