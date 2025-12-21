import { useState, useEffect, useMemo, useRef } from 'react'
import { PostCard } from './PostCard'
import { usePostsCount } from '../../hooks/usePosts'
import { Loader2, Search as SearchIcon, X, Menu, Calendar } from 'lucide-react'
import { db } from '../../lib/db'
import type { Post } from '../../types'
import Fuse from 'fuse.js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useInfiniteScrollPosts } from '../../hooks/useInfiniteScroll'
import { ScrollToTopButton } from './ScrollToTopButton'
import { TimelineDrawer } from './TimelineDrawer'

interface TimelineProps {
  onPostClick?: (postId: string) => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (isOpen: boolean) => void
  scrollToIndex?: number | null // New prop for scrolling
  clearScrollToIndex?: () => void // New prop to clear scroll index in parent
}

export function Timeline({ onPostClick, setMobileMenuOpen, ...props }: TimelineProps) {
  // --- States and Refs ---
  const { posts: timelinePosts, isLoading, hasMore, loadMore } = useInfiniteScrollPosts()
  const totalCountDB = usePostsCount()

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const [timelineDrawerOpen, setTimelineDrawerOpen] = useState(false)
  const [currentVisibleMonth, setCurrentVisibleMonth] = useState<string>()
  const [jumpedPosts, setJumpedPosts] = useState<Post[] | null>(null)
  const [isLoadingJumped, setIsLoadingJumped] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)

  // --- Derived State (must be before virtualizer) ---
  const displayedPosts = query ? searchResults : (jumpedPosts || timelinePosts)

  // --- Virtualizer Setup ---
  const rowVirtualizer = useVirtualizer({
    count: displayedPosts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 400, // Estimated post height, will be measured automatically
    overscan: 5, // Render 5 extra items above/below viewport for smoother scrolling
  })

  // --- Effects ---

  // Effect to scroll to a specific index when requested from parent (App.tsx)
  useEffect(() => {
    if (props.scrollToIndex !== null && props.scrollToIndex !== undefined) {
      rowVirtualizer.scrollToIndex(props.scrollToIndex, {
        align: 'start',
        behavior: 'smooth',
      });
      // Clear the scrollToIndex prop after use to avoid re-scrolling
      if (props.clearScrollToIndex) {
        props.clearScrollToIndex();
      }
    }
  }, [props.scrollToIndex, rowVirtualizer, props.clearScrollToIndex]);


  // Load all posts for search indexing (and timeline drawer)
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

  // Initialize Fuse for search
  const fuse = useMemo(() => {
    return new Fuse(allPosts, {
      keys: ['content', 'contentText', 'summary', 'tags'],
      threshold: 0.3,
      ignoreLocation: true,
      includeScore: true
    })
  }, [allPosts])

  // Debounced Search Effect
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timeoutId = setTimeout(() => {
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

  // Infinite scroll: detect when we're near the end (for scrolling down only)
  useEffect(() => {
    if (query) return // Don't load more when searching

    const virtualItems = rowVirtualizer.getVirtualItems()
    if (virtualItems.length === 0) return

    // Check for upward scroll (Load newer posts)
    if (jumpedPosts && !isLoadingJumped && parentRef.current && parentRef.current.scrollTop < 50) {
      loadNewerPosts()
    }

    const lastItem = virtualItems[virtualItems.length - 1]

    // Load older posts when scrolling down
    if (lastItem && lastItem.index >= displayedPosts.length - 3) {
      if (jumpedPosts) {
        // In jumped posts mode, load more older posts
        const loadMoreJumpedPosts = async () => {
          if (isLoadingJumped) return

          setIsLoadingJumped(true)
          try {
            const oldestPost = jumpedPosts[jumpedPosts.length - 1]
            const morePosts = await db.posts
              .where('timestamp')
              .below(oldestPost.timestamp)
              .reverse()
              .limit(20)
              .toArray()

            if (morePosts.length > 0) {
              const sortedMore = [...morePosts].sort((a, b) => b.timestamp - a.timestamp)
              setJumpedPosts(prev => prev ? [...prev, ...sortedMore] : sortedMore)
            }
          } catch (error) {
            console.error('Failed to load more jumped posts:', error)
          } finally {
            setIsLoadingJumped(false)
          }
        }
        loadMoreJumpedPosts()
      } else if (hasMore && !isLoading) {
        // Normal infinite scroll
        loadMore()
      }
    }
  }, [rowVirtualizer.getVirtualItems(), hasMore, isLoading, loadMore, displayedPosts.length, query, jumpedPosts, isLoadingJumped])

  // Track current visible month for highlighting
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const handleScroll = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        const virtualItems = rowVirtualizer.getVirtualItems()
        if (virtualItems.length === 0) return

        const firstPost = displayedPosts[virtualItems[0].index]
        if (firstPost) {
          const date = new Date(firstPost.publishedAt)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          setCurrentVisibleMonth(monthKey)
        }
      }, 200)
    }

    const scrollElement = parentRef.current
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll)
      handleScroll() // Initial call
    }

    return () => {
      clearTimeout(timeoutId)
      if (scrollElement) {
        scrollElement.removeEventListener('scroll', handleScroll)
      }
    }
  }, [displayedPosts, rowVirtualizer])


  // --- Event Handlers ---

  const handleSearch = (val: string) => {
    setQuery(val)
    setJumpedPosts(null) // Clear jumped posts when searching
  }

  const clearSearch = () => {
    setQuery('')
    setSearchResults([])
    setIsSearching(false)
    setJumpedPosts(null)
  }

  // Load newer posts in jumped mode (manual trigger or scroll to top)
  const loadNewerPosts = async () => {
    if (!jumpedPosts || isLoadingJumped) return

    setIsLoadingJumped(true)
    await new Promise(resolve => setTimeout(resolve, 800)) // Artificial delay

    try {
      const newestPost = jumpedPosts[0]
      const newerPosts = await db.posts
        .where('timestamp')
        .above(newestPost.timestamp)
        .limit(20)
        .toArray()

      if (newerPosts.length > 0) {
        const scrollContainer = parentRef.current
        const previousScrollHeight = scrollContainer?.scrollHeight || 0
        const previousScrollTop = scrollContainer?.scrollTop || 0
        
        const sortedNewer = [...newerPosts].sort((a, b) => b.timestamp - a.timestamp)
        setJumpedPosts(prev => prev ? [...sortedNewer, ...prev] : sortedNewer)

        requestAnimationFrame(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight
            const heightDifference = newScrollHeight - previousScrollHeight
            scrollContainer.scrollTop = previousScrollTop + heightDifference
          }
        })
      }
    } catch (error) {
      console.error('Failed to load newer jumped posts:', error)
    } finally {
      setIsLoadingJumped(false)
    }
  }

  // Handle month click from timeline drawer
  const handleMonthClick = async (year: number, month: number) => {
    if (query) {
      setQuery('')
      setSearchResults([])
      setIsSearching(false)
    }

    const nextMonthStart = new Date(year, month + 1, 1).getTime()

    try {
      const newPosts = await db.posts
        .where('timestamp')
        .below(nextMonthStart) // Strictly less than the first moment of next month
        .reverse()
        .limit(30)
        .toArray()

      if (newPosts.length > 0) {
        const sortedPosts = [...newPosts].sort((a, b) => b.timestamp - a.timestamp)
        setJumpedPosts(sortedPosts)

        // Give React a moment to render the new posts into the virtualizer
        setTimeout(() => {
          if (rowVirtualizer) {
             rowVirtualizer.scrollToIndex(0, {
               align: 'start',
               behavior: 'auto'
             })
          }
        }, 50)
      }
    } catch (error) {
      console.error('Failed to jump to month:', error)
    }
  }

  // --- Render Logic ---

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

        {/* Timeline Navigation Button */}
        <button
          onClick={() => setTimelineDrawerOpen(true)}
          className="bg-mastodon-surface p-3 rounded-full text-white hover:bg-mastodon-surface/80 transition-colors"
          aria-label="打开时间轴导航"
        >
          <Calendar className="w-6 h-6" />
        </button>
      </div>

      {/* Posts count indicator */}
      {!query && !jumpedPosts && totalCountDB && (
        <div className="px-4 pb-2 text-sm text-mastodon-text-secondary text-center">
          Loaded {displayedPosts.length} of {totalCountDB} posts
        </div>
      )}

      {jumpedPosts && !query && (
        <div className="px-4 pb-2 text-sm text-mastodon-text-secondary text-center">
          Viewing {displayedPosts.length} posts from selected month
          <button
            onClick={() => setJumpedPosts(null)}
            className="ml-2 text-mastodon-primary hover:underline"
          >
            Return to timeline
          </button>
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
            {/* Loading indicator at the top (for scroll up in jumped mode) */}
            {/* Loading indicator at the top (for scroll up in jumped mode) */}
            {jumpedPosts && isLoadingJumped && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  zIndex: 50,
                }}
                className="flex justify-center py-4 bg-mastodon-surface/90 backdrop-blur-sm shadow-md transition-all duration-300"
              >
                <div className="flex items-center gap-2 text-mastodon-primary">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">Loading previous posts...</span>
                </div>
              </div>
            )}

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
            {!query && (isLoading || isLoadingJumped) && (jumpedPosts ? true : hasMore) && (
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

      {/* Timeline Drawer */}
      <TimelineDrawer
        isOpen={timelineDrawerOpen}
        onClose={() => setTimelineDrawerOpen(false)}
        onMonthSelect={handleMonthClick}
        currentMonth={currentVisibleMonth}
      />
    </div>
  )
}