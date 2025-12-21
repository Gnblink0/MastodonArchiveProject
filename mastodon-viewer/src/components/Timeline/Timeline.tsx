import { useState, useEffect, useMemo, useRef } from 'react'
import { PostCard } from './PostCard'
import { usePostsCount } from '../../hooks/usePosts'
import { Loader2, Search as SearchIcon, X, Menu } from 'lucide-react'
import { db } from '../../lib/db'
import type { Post } from '../../types'
import Fuse from 'fuse.js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useInfiniteScrollPosts } from '../../hooks/useInfiniteScroll'
import { ScrollToTopButton } from './ScrollToTopButton'

interface TimelineProps {
  onPostClick?: (postId: string) => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (isOpen: boolean) => void
}

export function Timeline({ onPostClick, setMobileMenuOpen }: TimelineProps) {
  // Infinite scroll for normal timeline
  const { posts: timelinePosts, isLoading, hasMore, loadMore } = useInfiniteScrollPosts()
  const totalCountDB = usePostsCount()

  // Search State
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Ref for scroll container
  const parentRef = useRef<HTMLDivElement>(null)

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
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [query, fuse])

  // Determine what to display
  const displayedPosts = query ? searchResults : timelinePosts

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: displayedPosts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 400, // Estimated post height, will be measured automatically
    overscan: 5, // Render 5 extra items above/below viewport for smoother scrolling
  })

  // Infinite scroll: detect when we're near the end
  useEffect(() => {
    if (query) return // Don't load more when searching

    const virtualItems = rowVirtualizer.getVirtualItems()
    if (virtualItems.length === 0) return

    const lastItem = virtualItems[virtualItems.length - 1]

    // When we're rendering the last few items, load more
    if (lastItem && lastItem.index >= displayedPosts.length - 3 && hasMore && !isLoading) {
      loadMore()
    }
  }, [rowVirtualizer.getVirtualItems(), hasMore, isLoading, loadMore, displayedPosts.length, query])

  if (isLoading && displayedPosts.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-mastodon-primary" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto">
      {/* Search Bar and Mobile Menu Button */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden bg-mastodon-surface p-3 rounded-full text-white cursor-pointer"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Search Bar */}
        <div className="flex-1">
          <div className={`
              flex items-center w-full bg-mastodon-surface
              border-2 transition-colors duration-200 rounded-full overflow-hidden
              ${query ? 'border-mastodon-primary' : 'border-mastodon-border hover:border-mastodon-text-secondary focus-within:border-mastodon-primary'}
          `}>
              <div className="pl-5 text-mastodon-text-secondary">
                  <SearchIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search posts..."
                className="w-full bg-transparent border-none py-4 px-4 text-mastodon-text-primary placeholder:text-mastodon-text-secondary/50 focus:outline-none focus:ring-0 text-base"
              />
              {query && (
                  <button
                    onClick={clearSearch}
                    className="pr-5 text-mastodon-text-secondary hover:text-white transition-colors cursor-pointer"
                  >
                      <X className="w-5 h-5" />
                  </button>
              )}
          </div>
        </div>
      </div>

      {/* Posts count indicator */}
      {!query && totalCountDB && (
        <div className="px-4 pb-2 text-sm text-mastodon-text-secondary text-center">
          Loaded {displayedPosts.length} of {totalCountDB} posts
        </div>
      )}

      {query && (
        <div className="px-4 pb-2 text-sm text-mastodon-text-secondary text-center">
          {isSearching ? 'Searching...' : `Found ${searchResults.length} results`}
        </div>
      )}

      {/* Virtual Scrolling Container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto px-4"
        style={{
          contain: 'strict',
        }}
      >
        {displayedPosts.length === 0 ? (
          <div className="text-center py-12 text-mastodon-text-secondary">
            {query ? 'Try different keywords' : 'No posts in archive'}
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const post = displayedPosts[virtualItem.index]
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <PostCard
                    post={post}
                    highlight={query}
                    onClick={onPostClick ? () => onPostClick(post.id) : undefined}
                  />
                </div>
              )
            })}

            {/* Loading indicator at the bottom */}
            {!query && isLoading && hasMore && (
              <div
                style={{
                  position: 'absolute',
                  top: `${rowVirtualizer.getTotalSize()}px`,
                  left: 0,
                  width: '100%',
                }}
                className="flex justify-center py-8"
              >
                <Loader2 className="w-6 h-6 animate-spin text-mastodon-primary" />
              </div>
            )}

            {/* End of timeline indicator */}
            {!query && !hasMore && displayedPosts.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: `${rowVirtualizer.getTotalSize()}px`,
                  left: 0,
                  width: '100%',
                }}
                className="text-center py-8 text-mastodon-text-secondary text-sm"
              >
                You've reached the end of your timeline
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scroll to Top Button */}
      <ScrollToTopButton scrollElement={parentRef.current} />
    </div>
  )
}
