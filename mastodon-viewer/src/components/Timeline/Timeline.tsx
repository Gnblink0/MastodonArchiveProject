import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { useAccountFilter } from '../../contexts/AccountFilterContext'

interface TimelineProps {
  onPostClick?: (postId: string) => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (isOpen: boolean) => void
  scrollToIndex?: number | null // New prop for scrolling
  clearScrollToIndex?: () => void // New prop to clear scroll index in parent
}

export function Timeline({ onPostClick, setMobileMenuOpen, ...props }: TimelineProps) {
  // --- Account Filter from Global Context ---
  const { selectedAccountId } = useAccountFilter()

  // --- URL Search Params for preserving jumped month ---
  const [searchParams, setSearchParams] = useSearchParams()

  // --- States and Refs ---
  const { posts: timelinePosts, isLoading, hasMore, loadMore } = useInfiniteScrollPosts(selectedAccountId)
  const totalCountDB = usePostsCount(selectedAccountId)

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const [timelineDrawerOpen, setTimelineDrawerOpen] = useState(false)
  const [currentVisibleMonth, setCurrentVisibleMonth] = useState<string>()
  const [jumpedPosts, setJumpedPosts] = useState<Post[] | null>(null)
  const [isLoadingJumped, setIsLoadingJumped] = useState(false)

  // Pull-to-refresh states
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isAtTop, setIsAtTop] = useState(true) // Track if scrolled to top

  const parentRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number>(0)
  const currentTouchY = useRef<number>(0)
  const pendingScrollToPost = useRef<string | null>(null) // Store post ID to scroll to
  const hasRestoredScroll = useRef(false) // Track if we've already restored scroll position

  // --- Derived State (must be before virtualizer) ---
  const displayedPosts = query ? searchResults : (jumpedPosts || timelinePosts)

  // --- Virtualizer Setup ---
  const rowVirtualizer = useVirtualizer({
    count: displayedPosts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 400, // Estimated post height, will be measured automatically
    overscan: 5, // Render 5 extra items above/below viewport for smoother scrolling
  })

  // --- Event Handlers (defined before useEffect to avoid initialization errors) ---

  // Load newer posts in jumped mode (triggered by pull-to-refresh)
  const loadNewerPosts = useCallback(async () => {
    if (!jumpedPosts || isLoadingJumped || isRefreshing) return

    setIsRefreshing(true)
    setIsLoadingJumped(true)

    try {
      // Minimum delay to show loading animation
      await new Promise(resolve => setTimeout(resolve, 800))

      const newestPost = jumpedPosts[0]
      const newerPosts = await db.posts
        .where('timestamp')
        .above(newestPost.timestamp)
        .limit(20)
        .toArray()

      if (newerPosts.length > 0) {
        // Remember the first visible post to restore scroll position
        const virtualItems = rowVirtualizer.getVirtualItems()
        const firstVisiblePost = virtualItems.length > 0 ? jumpedPosts[virtualItems[0].index] : null

        // Store the post ID to scroll to after render
        if (firstVisiblePost) {
          pendingScrollToPost.current = firstVisiblePost.id
        }

        const sortedNewer = [...newerPosts].sort((a, b) => b.timestamp - a.timestamp)
        const newCombinedPosts = [...sortedNewer, ...jumpedPosts]

        setJumpedPosts(newCombinedPosts)
      }
    } catch (error) {
      console.error('Failed to load newer jumped posts:', error)
    } finally {
      setIsLoadingJumped(false)
      // Reset refresh state after animation
      setTimeout(() => {
        setIsRefreshing(false)
        setPullDistance(0)
      }, 300)
    }
  }, [jumpedPosts, isLoadingJumped, isRefreshing, rowVirtualizer])

  // --- Effects ---

  // Effect to restore scroll position when returning from post detail
  useLayoutEffect(() => {
    if (displayedPosts.length > 0 && !hasRestoredScroll.current) {
      const savedPostId = sessionStorage.getItem('timeline-scroll-post-id')
      if (savedPostId) {
        // Find the post index in displayedPosts
        const postIndex = displayedPosts.findIndex(p => p.id === savedPostId)

        if (postIndex >= 0) {
          // Use requestAnimationFrame to wait for virtualizer to be ready
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Double RAF ensures virtualizer has measured elements
              rowVirtualizer.scrollToIndex(postIndex, {
                align: 'start',
                behavior: 'auto'
              })
            })
          })
        }

        // Clear the saved position and mark as restored
        sessionStorage.removeItem('timeline-scroll-post-id')
        hasRestoredScroll.current = true
      }
    }
  }, [displayedPosts, rowVirtualizer])

  // Reset scroll restoration flag when view changes (search, jump, or account filter)
  useEffect(() => {
    hasRestoredScroll.current = false
  }, [query, jumpedPosts, selectedAccountId])

  // Update cache whenever jumpedPosts changes (including when loading more)
  useEffect(() => {
    if (jumpedPosts && jumpedPosts.length > 0) {
      const monthParam = searchParams.get('month')
      if (monthParam) {
        const cacheKey = `jumped-posts-${monthParam}-${selectedAccountId || 'all'}`
        sessionStorage.setItem(cacheKey, JSON.stringify(jumpedPosts))
      }
    }
  }, [jumpedPosts, searchParams, selectedAccountId])

  // Effect to restore jumped month from URL params on mount
  useEffect(() => {
    const monthParam = searchParams.get('month')
    if (monthParam && !query) {
      // Parse month parameter (format: YYYY-MM)
      const [yearStr, monthStr] = monthParam.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10) - 1 // Month is 0-indexed in Date

      if (!isNaN(year) && !isNaN(month)) {
        // Try to restore from sessionStorage cache first for instant loading
        const cacheKey = `jumped-posts-${monthParam}-${selectedAccountId || 'all'}`
        const cached = sessionStorage.getItem(cacheKey)

        if (cached) {
          try {
            const cachedPosts = JSON.parse(cached)
            // Convert date strings back to Date objects
            const restoredPosts = cachedPosts.map((p: any) => ({
              ...p,
              publishedAt: new Date(p.publishedAt)
            }))
            setJumpedPosts(restoredPosts)
          } catch (e) {
            console.error('Failed to restore from cache:', e)
          }
        }

        // Restore jumped posts for this month (will update cache)
        const loadMonthPosts = async () => {
          const monthStart = new Date(year, month, 1).getTime()
          const nextMonthStart = new Date(year, month + 1, 1).getTime()

          try {
            let monthPosts: Post[]
            if (selectedAccountId) {
              const allAccountPosts = await db.posts.where('accountId').equals(selectedAccountId).toArray()
              monthPosts = allAccountPosts.filter(p => p.timestamp >= monthStart && p.timestamp < nextMonthStart)
            } else {
              monthPosts = await db.posts
                .where('timestamp')
                .between(monthStart, nextMonthStart, true, false)
                .toArray()
            }

            if (monthPosts.length > 0) {
              const sortedPosts = [...monthPosts]
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 30)
              setJumpedPosts(sortedPosts)
              // Cache will be updated automatically by the effect
            }
          } catch (error) {
            console.error('Failed to restore jumped month:', error)
          }
        }
        loadMonthPosts()
      }
    } else if (!monthParam && jumpedPosts) {
      // If month param is removed but we still have jumped posts, clear them
      setJumpedPosts(null)
    }
  }, [searchParams, selectedAccountId, query]) // Run when URL params or account changes

  // Effect to restore scroll position after loading newer posts
  // Use useLayoutEffect to execute before browser paint, avoiding flicker
  useLayoutEffect(() => {
    if (pendingScrollToPost.current && displayedPosts.length > 0) {
      const postId = pendingScrollToPost.current
      const targetIndex = displayedPosts.findIndex(p => p.id === postId)

      if (targetIndex >= 0) {
        // Scroll immediately without delay
        rowVirtualizer.scrollToIndex(targetIndex, {
          align: 'start',
          behavior: 'auto'
        })
        pendingScrollToPost.current = null
      }
    }
  }, [displayedPosts, rowVirtualizer])

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


  // Load all posts for search indexing (lazy load - only when user starts searching)
  useEffect(() => {
    // Only load all posts if user has typed a search query
    if (!query.trim()) {
      return
    }

    // If already loaded, skip
    if (allPosts.length > 0) {
      return
    }

    const loadAllPosts = async () => {
      try {
        console.log('Loading all posts for search...')
        let p: Post[]
        if (selectedAccountId) {
          p = await db.posts.where('accountId').equals(selectedAccountId).toArray()
        } else {
          p = await db.posts.toArray()
        }
        setAllPosts(p)
        console.log(`Loaded ${p.length} posts for search indexing`)
      } catch (e) {
        console.error("Failed to load posts for search", e)
      }
    }
    loadAllPosts()
  }, [query, selectedAccountId, allPosts.length])

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

  // Track current visible month for highlighting and scroll position
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const handleScroll = () => {
      const scrollElement = parentRef.current
      if (!scrollElement) return

      // Update isAtTop state
      setIsAtTop(scrollElement.scrollTop === 0)

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

  // Pull-to-refresh for loading newer posts in jumped mode (mobile only)
  useEffect(() => {
    if (!jumpedPosts) return // Only in jumped mode

    const scrollElement = parentRef.current
    if (!scrollElement) return

    const PULL_THRESHOLD = 80 // Threshold to trigger refresh (in px)
    const MAX_PULL = 120 // Maximum pull distance

    // Touch event handlers for mobile
    const handleTouchStart = (e: TouchEvent) => {
      // Only start tracking if at the top of scroll
      if (scrollElement.scrollTop === 0 && !isRefreshing) {
        touchStartY.current = e.touches[0].clientY
        currentTouchY.current = touchStartY.current
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      // If user scrolled away from top, reset
      if (scrollElement.scrollTop > 0) {
        setPullDistance(0)
        touchStartY.current = 0
        currentTouchY.current = 0
        return
      }

      // Ignore if not at top, already refreshing, or no touch start recorded
      if (scrollElement.scrollTop > 0 || isRefreshing || touchStartY.current === 0) {
        return
      }

      currentTouchY.current = e.touches[0].clientY
      const diff = currentTouchY.current - touchStartY.current

      // Only respond to downward pull (diff > 0 means finger moving down)
      if (diff > 0) {
        // Prevent default scroll behavior when pulling down
        if (scrollElement.scrollTop === 0) {
          e.preventDefault()
        }

        // Apply resistance curve: harder to pull as distance increases
        const resistance = 0.5
        const distance = Math.min(diff * resistance, MAX_PULL)

        setPullDistance(distance)
      }
    }

    const handleTouchEnd = () => {
      // Always reset touch tracking first
      const wasTracking = touchStartY.current !== 0
      const diff = currentTouchY.current - touchStartY.current

      // Reset touch tracking immediately
      touchStartY.current = 0
      currentTouchY.current = 0

      // Only process if we were actually tracking a pull
      if (!wasTracking) return

      const resistance = 0.5
      const distance = Math.min(diff * resistance, MAX_PULL)

      // Trigger refresh if pulled beyond threshold
      if (distance >= PULL_THRESHOLD) {
        loadNewerPosts()
      } else {
        // Reset if not pulled enough
        setPullDistance(0)
      }
    }

    const handleTouchCancel = () => {
      // Force reset everything when touch is cancelled
      touchStartY.current = 0
      currentTouchY.current = 0
      if (!isRefreshing) {
        setPullDistance(0)
      }
    }

    // Add touch event listeners for mobile only
    scrollElement.addEventListener('touchstart', handleTouchStart, { passive: true })
    scrollElement.addEventListener('touchmove', handleTouchMove, { passive: false })
    scrollElement.addEventListener('touchend', handleTouchEnd, { passive: true })
    scrollElement.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      scrollElement.removeEventListener('touchstart', handleTouchStart)
      scrollElement.removeEventListener('touchmove', handleTouchMove)
      scrollElement.removeEventListener('touchend', handleTouchEnd)
      scrollElement.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [jumpedPosts, isRefreshing, loadNewerPosts])


  // --- Additional Event Handlers ---

  const handleSearch = (val: string) => {
    setQuery(val)
    setJumpedPosts(null) // Clear jumped posts when searching
    setSearchParams({}) // Clear URL params when searching
  }

  const clearSearch = () => {
    setQuery('')
    setSearchResults([])
    setIsSearching(false)
    setJumpedPosts(null)
    setSearchParams({}) // Clear URL params
  }

  // Handle month click from timeline drawer
  const handleMonthClick = async (year: number, month: number) => {
    if (query) {
      setQuery('')
      setSearchResults([])
      setIsSearching(false)
    }

    // Update URL params to preserve the jumped month
    const monthParam = `${year}-${String(month + 1).padStart(2, '0')}`
    setSearchParams({ month: monthParam })

    const monthStart = new Date(year, month, 1).getTime()
    const nextMonthStart = new Date(year, month + 1, 1).getTime()

    try {
      // Get posts from this month, filtered by account if selected
      let monthPosts: Post[]
      if (selectedAccountId) {
        const allAccountPosts = await db.posts.where('accountId').equals(selectedAccountId).toArray()
        monthPosts = allAccountPosts.filter(p => p.timestamp >= monthStart && p.timestamp < nextMonthStart)
      } else {
        monthPosts = await db.posts
          .where('timestamp')
          .between(monthStart, nextMonthStart, true, false)
          .toArray()
      }

      if (monthPosts.length > 0) {
        // Sort by timestamp descending (newest first) and take first 30
        const sortedPosts = [...monthPosts]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 30)

        setJumpedPosts(sortedPosts)
        // Cache will be updated automatically by the effect

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
          className="bg-mastodon-surface p-3 rounded-full text-white hover:bg-mastodon-surface/80 transition-colors cursor-pointer"
          aria-label="Open timeline navigation"
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
        <div className="px-4 pb-2 space-y-2">
          {/* Load more button for desktop - only show when at top */}
          {isAtTop && (
            <div className="hidden md:flex justify-center">
              <button
                onClick={loadNewerPosts}
                disabled={isLoadingJumped || isRefreshing}
                className="px-4 py-2 text-sm text-mastodon-primary hover:text-mastodon-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-2 border border-mastodon-border hover:border-mastodon-primary rounded-lg"
              >
                {isLoadingJumped || isRefreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <span>Load earlier posts</span>
                )}
              </button>
            </div>
          )}

          <div className="text-sm text-mastodon-text-secondary text-center">
            Viewing {displayedPosts.length} posts from selected month
            <button
              onClick={() => {
                setJumpedPosts(null)
                setSearchParams({}) // Clear URL params when returning to timeline
              }}
              className="ml-2 text-mastodon-primary hover:underline cursor-pointer"
            >
              Return to timeline
            </button>
          </div>
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
        className="flex-1 overflow-auto px-4 relative"
        style={{
          contain: 'strict',
        }}
      >
        {/* Pull-to-refresh indicator - positioned above the content (mobile only) */}
        {jumpedPosts && pullDistance > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '100%',
              height: '60px',
              zIndex: 50,
            }}
            className="flex justify-center items-center md:hidden"
          >
            <div className="flex items-center gap-2 text-mastodon-primary bg-mastodon-surface/90 backdrop-blur-sm rounded-lg px-4 py-2">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}

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
              transform: `translateY(${pullDistance}px)`,
              transition: pullDistance === 0 || isRefreshing
                ? 'transform 0.3s ease-out'
                : 'none',
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
                    onClick={onPostClick ? () => {
                      // Save the clicked post ID to restore scroll position when returning
                      sessionStorage.setItem('timeline-scroll-post-id', post.id)
                      onPostClick(post.id)
                    } : undefined}
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