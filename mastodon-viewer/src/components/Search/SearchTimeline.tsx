import { useState, useEffect, useMemo, useRef } from 'react'
import { db } from '../../lib/db'
import type { Post } from '../../types'
import { PostCard } from '../Timeline/PostCard'
import { Search as SearchIcon, Loader2, X } from 'lucide-react'
import Fuse from 'fuse.js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ScrollToTopButton } from '../Timeline/ScrollToTopButton'

interface SearchTimelineProps {
  onPostClick?: (postId: string) => void
}

export function SearchTimeline({ onPostClick }: SearchTimelineProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Post[]>([])
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [isInitializing, setIsInitializing] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)

  // Load all posts once for indexing
  useEffect(() => {
    const loadPosts = async () => {
      try {
        const posts = await db.posts.toArray()
        setAllPosts(posts)
      } catch (error) {
        console.error('Failed to load posts for search index', error)
      } finally {
        setIsInitializing(false)
      }
    }
    loadPosts()
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

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery)

    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsSearching(true)
    setTimeout(() => {
        const searchResults = fuse.search(searchQuery)
        const posts = searchResults.map(result => result.item)
        setResults(posts)
        setIsSearching(false)
    }, 10)
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
  }

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 400,
    overscan: 5,
  })

  if (isInitializing) {
      return (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-mastodon-primary" />
          </div>
      )
  }

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto">
       <div className="px-4 pt-4 pb-4 relative group">
          <div className={`
              flex items-center w-full bg-mastodon-surface
              border-2 transition-colors duration-200 rounded-lg overflow-hidden
              ${query ? 'border-mastodon-primary' : 'border-mastodon-border group-hover:border-mastodon-text-secondary'}
          `}>
              <div className="pl-4 text-mastodon-text-secondary">
                  <SearchIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search your archive..."
                className="w-full bg-transparent border-none py-3 px-3 text-mastodon-text-primary placeholder:text-mastodon-text-secondary/50 focus:outline-none focus:ring-0 text-lg"
                autoFocus
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
       </div>

       {query && (
          <div className="px-4 pb-2 flex items-center justify-between text-mastodon-text-secondary">
             <p className="text-sm font-medium">
                {isSearching
                  ? 'Searching...'
                  : results.length === 0
                    ? 'No matches found'
                    : `Found ${results.length} match${results.length === 1 ? '' : 'es'}`
                }
             </p>
          </div>
       )}

       {isSearching ? (
          <div className="flex justify-center py-8">
             <Loader2 className="w-8 h-8 animate-spin text-mastodon-primary" />
          </div>
       ) : query && results.length > 0 ? (
          <div
            ref={parentRef}
            className="flex-1 overflow-auto px-4"
            style={{ contain: 'strict' }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const post = results[virtualItem.index]
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
                      onClick={onPostClick ? () => onPostClick(post.id) : undefined}
                    />
                  </div>
                )
              })}
            </div>
            <ScrollToTopButton scrollElement={parentRef.current} />
          </div>
       ) : query && results.length === 0 ? (
           <div className="text-center py-12 opacity-50">
               <div className="text-6xl mb-4">🔍</div>
               <p>Try different keywords or tags</p>
           </div>
       ) : (
           <div className="text-center py-20 opacity-30 select-none">
               <SearchIcon className="w-24 h-24 mx-auto mb-4" />
               <p className="text-xl">Type to start searching</p>
           </div>
       )}
    </div>
  )
}
