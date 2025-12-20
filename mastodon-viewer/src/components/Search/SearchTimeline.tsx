import { useState, useEffect, useMemo } from 'react'
import { db } from '../../lib/db'
import type { Post } from '../../types'
import { PostCard } from '../Timeline/PostCard'
import { Search as SearchIcon, Loader2, X } from 'lucide-react'
import Fuse from 'fuse.js'

interface SearchTimelineProps {
  onPostClick?: (postId: string) => void
}

export function SearchTimeline({ onPostClick }: SearchTimelineProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Post[]>([])
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [isInitializing, setIsInitializing] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  
  // Load all posts once for indexing
  useEffect(() => {
    const loadPosts = async () => {
      try {
        const posts = await db.posts.toArray()
        // Sort by date desc initially or keep natural order?
        // Fuse will return ranked results, but we might want to sort results by date?
        // Usually search relevance > date, but for archives date is important.
        // Let's stick to Fuse default ranking for now, or sort results by date if matches are equal.
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
      threshold: 0.3, // 0.0 = perfect match, 1.0 = match anything. 0.3 is good for fuzzy.
      ignoreLocation: true, // Search entire string
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
    // Debounce could be added here if real-time, but for now let's just run it
    // setTimeout to allow UI to update loading state if large dataset
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

  if (isInitializing) {
      return (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-mastodon-primary" />
          </div>
      )
  }

  return (
    <div className="max-w-2xl mx-auto pt-4 pb-12 px-4">
       <div className="mb-8 relative group">
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

       {isSearching ? (
          <div className="flex justify-center py-8">
             <Loader2 className="w-8 h-8 animate-spin text-mastodon-primary" />
          </div>
       ) : (
          <div className="space-y-4">
             {query && (
                <div className="mb-4 flex items-center justify-between text-mastodon-text-secondary px-1">
                   <p className="text-sm font-medium">
                      {results.length === 0 
                        ? 'No matches found'
                        : `Found ${results.length} match${results.length === 1 ? '' : 'es'}`
                      }
                   </p>
                </div>
             )}
             
             {results.map(post => (
                <PostCard 
                   key={post.id} 
                   post={post} 
                   onClick={onPostClick ? () => onPostClick(post.id) : undefined}
                />
             ))}
             
             {query && results.length === 0 && (
                 <div className="text-center py-12 opacity-50">
                     <div className="text-6xl mb-4">🔍</div>
                     <p>Try different keywords or tags</p>
                 </div>
             )}

             {!query && (
                 <div className="text-center py-20 opacity-30 select-none">
                     <SearchIcon className="w-24 h-24 mx-auto mb-4" />
                     <p className="text-xl">Type to start searching</p>
                 </div>
             )}
          </div>
       )}
    </div>
  )
}
