import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { Star, Bookmark as BookmarkIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmbeddedPost } from '../components/Timeline/EmbeddedPost'
import ReactPaginate from 'react-paginate'

interface InteractionsPageProps {
  type: 'likes' | 'bookmarks'
}

export function InteractionsPage({ type }: InteractionsPageProps) {
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const data = useLiveQuery(async () => {
    const table = type === 'likes' ? db.likes : db.bookmarks
    const items = await table
      .reverse()
      .toArray()
    
    // Process items to extract displayable info
    return items.map(item => {
       const url = item.targetUrl || ''
       let username = 'Unknown User'
       
       try {
         const urlObj = new URL(url)
         const path = urlObj.pathname
         const atMatch = path.match(/\/(@[\w\-\.]+)/)
         if (atMatch) {
            username = atMatch[1]
         } else {
             const usersMatch = path.match(/\/users\/([\w\-\.]+)/)
             if (usersMatch) {
                username = '@' + usersMatch[1]
             }
         }
       } catch (e) {}

       return {
         id: item.id,
         url,
         timestamp: type === 'likes' ? (item as any).likedAt : (item as any).bookmarkedAt,
         username
       }
    })
  }, [type])

  if (!data) {
    return (
       <div className="flex justify-center items-center h-full text-mastodon-text-secondary">
          <p>Loading...</p>
       </div>
    )
  }

  const paginatedData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(data.length / PAGE_SIZE)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
         <div className="p-3 bg-mastodon-surface rounded-full">
            {type === 'likes' ? (
                <Star className="w-6 h-6 text-[#e5c500]" />
            ) : (
                <BookmarkIcon className="w-6 h-6 text-[#2b90d9]" />
            )}
         </div>
         <h1 className="text-2xl font-bold text-white capitalize">
            {type === 'likes' ? 'Favourites' : 'Bookmarks'}
         </h1>
         <span className="text-mastodon-text-secondary">({data.length})</span>
      </div>

      <div className="space-y-6">
          {paginatedData.length === 0 ? (
             <div className="bg-mastodon-surface rounded-xl border border-mastodon-border p-8 text-center text-mastodon-text-secondary">
                No items found.
             </div>
          ) : (
             <div className="grid gap-6">
                {paginatedData.map((item) => (
                   <EmbeddedPost 
                      key={item.id} 
                      url={item.url} 
                      timestamp={item.timestamp ? new Date(item.timestamp) : undefined} 
                   />
                ))}
             </div>
          )}
      </div>

      {totalPages > 1 && (
         <div className="mt-8 border-t border-mastodon-border pt-4">
             <ReactPaginate
                breakLabel="..."
                nextLabel={<ChevronRight className="w-5 h-5" />}
                onPageChange={(e) => {
                    setPage(e.selected + 1)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
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
    </div>
  )
}
