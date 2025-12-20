import { useState, useEffect, useMemo } from 'react'
import { PostCard } from './PostCard'
import { usePosts, usePostsCount } from '../../hooks/usePosts'
import { Loader2, Search as SearchIcon, X, ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { db } from '../../lib/db'
import type { Post } from '../../types'
import Fuse from 'fuse.js'
import ReactPaginate from 'react-paginate'

interface TimelineProps {
  onPostClick?: (postId: string) => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (isOpen: boolean) => void
}

export function Timeline({ onPostClick, setMobileMenuOpen }: TimelineProps) {
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  
  // Search State
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [, setIsSearching] = useState(false)

  // Data fetching for normal timeline
  const postsCallback = usePosts(pageSize, (page - 1) * pageSize)
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

  const handlePageClick = (event: { selected: number }) => {
    setPage(event.selected + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setPage(1) // Reset to first page when changing page size
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

  if (isLoading && !query) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-mastodon-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      {/* Search Bar and Mobile Menu Button */}
      <div className="mb-4 flex items-center gap-2">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden bg-mastodon-surface p-3 rounded-full text-white"
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

      {/* Posts List */}
      <div>
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
                <div className="mt-4 border-t border-mastodon-border pt-4 px-4">
                  {/* Page Size Selector */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-sm text-mastodon-text-secondary">Posts per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                      className="bg-mastodon-surface text-mastodon-text-primary border border-mastodon-border rounded px-3 py-1 text-sm cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  {/* Pagination */}
                  <ReactPaginate
                      breakLabel="..."
                      nextLabel={<ChevronRight className="w-5 h-5" />}
                      onPageChange={handlePageClick}
                      pageRangeDisplayed={3}
                      pageCount={totalPages}
                      previousLabel={<ChevronLeft className="w-5 h-5" />}
                      forcePage={page - 1}
                      renderOnZeroPageCount={null}

                      containerClassName="flex items-center justify-center gap-2 py-4 select-none"

                      pageClassName="block"
                      pageLinkClassName="flex items-center justify-center w-8 h-8 rounded-md bg-mastodon-surface text-mastodon-text-secondary hover:bg-mastodon-primary/20 hover:text-mastodon-primary transition-colors cursor-pointer text-sm"

                      activeClassName="block"
                      activeLinkClassName="!bg-mastodon-primary !text-white hover:bg-mastodon-primary hover:text-white"

                      previousClassName="mr-auto sm:mr-2"
                      previousLinkClassName="p-2 rounded-lg bg-mastodon-surface text-white hover:bg-mastodon-border transition-colors cursor-pointer flex items-center"

                      nextClassName="ml-auto sm:ml-2"
                      nextLinkClassName="p-2 rounded-lg bg-mastodon-surface text-white hover:bg-mastodon-border transition-colors cursor-pointer flex items-center"

                      disabledClassName="opacity-50 cursor-not-allowed"
                      disabledLinkClassName="cursor-not-allowed hover:bg-mastodon-surface"

                      breakClassName="flex items-center justify-center w-8 h-8 text-mastodon-text-secondary"
                      breakLinkClassName="block w-full h-full text-center leading-8"
                  />
                </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
