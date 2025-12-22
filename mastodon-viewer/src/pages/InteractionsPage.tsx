import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { Star, Bookmark as BookmarkIcon, ArrowUpDown, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmbeddedPost } from '../components/Timeline/EmbeddedPost'
import { ScrollToTopButton } from '../components/Timeline/ScrollToTopButton'

interface InteractionsPageProps {
  type: 'likes' | 'bookmarks'
}

type SortOption = 'original' | 'reverse'

const PAGE_SIZE = 20

export function InteractionsPage({ type }: InteractionsPageProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [sortOption, setSortOption] = useState<SortOption>('original')
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Query for total count
  const totalCount = useLiveQuery(async () => {
    const table = type === 'likes' ? db.likes : db.bookmarks
    return await table.count()
  }, [type]) || 0

  // Query for paginated data
  const data = useLiveQuery(async () => {
    const table = type === 'likes' ? db.likes : db.bookmarks
    const offset = (currentPage - 1) * PAGE_SIZE
    
    let collection = table.toCollection()
    
    if (sortOption === 'reverse') {
      collection = collection.reverse()
    }
    
    const items = await collection
      .offset(offset)
      .limit(PAGE_SIZE)
      .toArray()

    // Process items to extract displayable info
    return items.map(item => {
       const url = item.targetUrl || ''
       return {
         id: item.id,
         url,
         timestamp: type === 'likes' ? (item as any).likedAt : (item as any).bookmarkedAt,
       }
    })
  }, [type, currentPage, sortOption])

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'original', label: 'Original Order' },
    { value: 'reverse', label: 'Newest (Reverse)' },
  ]

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    parentRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }

  // Reset page when sort changes
  const handleSortChange = (option: SortOption) => {
    setSortOption(option)
    setIsSortOpen(false)
    setCurrentPage(1)
  }

  if (!data) {
    return (
       <div className="flex justify-center items-center h-full text-mastodon-text-secondary">
          <p>Loading...</p>
       </div>
    )
  }

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      <div className="px-4 pt-8 pb-4 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="p-3 bg-mastodon-surface rounded-full">
               {type === 'likes' ? (
                   <Star className="w-6 h-6 text-[#e5c500]" />
               ) : (
                   <BookmarkIcon className="w-6 h-6 text-[#2b90d9]" />
               )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white capitalize">
                  {type === 'likes' ? 'Favourites' : 'Bookmarks'}
              </h1>
              <p className="text-sm text-mastodon-text-secondary">{totalCount} items</p>
            </div>
         </div>

         <div className="relative">
             <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-mastodon-surface hover:bg-mastodon-surface/80 rounded-lg text-sm font-medium text-mastodon-text-primary transition-colors border border-mastodon-border cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span>Sort</span>
            </button>

            {isSortOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsSortOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-mastodon-surface border border-mastodon-border rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSortChange(option.value)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span className={sortOption === option.value ? 'text-mastodon-primary font-medium' : 'text-mastodon-text-primary'}>
                        {option.label}
                      </span>
                      {sortOption === option.value && (
                        <Check className="w-4 h-4 text-mastodon-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
         </div>
      </div>

      <div
        ref={parentRef}
        className="flex-1 overflow-auto px-4 pb-4"
      >
        {data.length === 0 ? (
          <div className="bg-mastodon-surface rounded-xl border border-mastodon-border p-8 text-center text-mastodon-text-secondary">
             No items found.
          </div>
        ) : (
          <div className="space-y-6">
            {data.map((item) => (
              <div key={item.id}>
                <EmbeddedPost
                  url={item.url}
                  timestamp={item.timestamp ? new Date(item.timestamp) : undefined}
                />
              </div>
            ))}
          </div>
        )}

            {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8 mb-8">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-mastodon-text-secondary text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <ScrollToTopButton scrollElement={parentRef.current} />
    </div>
  )
}
