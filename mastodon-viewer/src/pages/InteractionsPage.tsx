import { useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { Star, Bookmark as BookmarkIcon } from 'lucide-react'
import { EmbeddedPost } from '../components/Timeline/EmbeddedPost'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ScrollToTopButton } from '../components/Timeline/ScrollToTopButton'

interface InteractionsPageProps {
  type: 'likes' | 'bookmarks'
}

export function InteractionsPage({ type }: InteractionsPageProps) {
  const parentRef = useRef<HTMLDivElement>(null)

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

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: data?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300, // Estimated item height
    overscan: 3,
  })

  if (!data) {
    return (
       <div className="flex justify-center items-center h-full text-mastodon-text-secondary">
          <p>Loading...</p>
       </div>
    )
  }

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      <div className="px-4 pt-8 pb-4 flex items-center gap-3">
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

      {data.length === 0 ? (
        <div className="px-4 bg-mastodon-surface rounded-xl border border-mastodon-border p-8 text-center text-mastodon-text-secondary mx-4">
           No items found.
        </div>
      ) : (
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
              const item = data[virtualItem.index]
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
                  className="pb-6"
                >
                  <EmbeddedPost
                    url={item.url}
                    timestamp={item.timestamp ? new Date(item.timestamp) : undefined}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ScrollToTopButton scrollElement={parentRef.current} />
    </div>
  )
}
