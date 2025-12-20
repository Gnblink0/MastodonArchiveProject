import { ExternalLink } from 'lucide-react'
import type { Post } from '../../types'
import { useMedia, useActor } from '../../hooks/usePosts'
import { useEffect, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'

interface PostCardProps {
  post: Post
  highlight?: string
  onClick?: () => void
}

export function PostCard({ post, onClick, highlight }: PostCardProps) {
  const media = useMedia(post.mediaIds)
  const actor = useActor()
  const [isExpanded, setIsExpanded] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  useEffect(() => {
    if (media && media.length > 0) {
      console.log('PostCard media debug:', post.id, media)
    }
  }, [media, post.id])

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking on a link, button, video, or image, don't trigger card click
    const target = e.target as HTMLElement
    if (target.closest('a') || target.closest('button') || target.closest('video') || target.closest('img')) {
      return
    }

    // Call the onClick callback to show post in right panel
    onClick?.()
  }

  const handleImageClick = (mediaIndex: number) => {
    // Calculate the index in the images-only array
    // Count how many images come before this index
    let imageIndex = 0
    for (let i = 0; i < mediaIndex; i++) {
      if (media?.[i]?.type === 'image') {
        imageIndex++
      }
    }

    setLightboxIndex(imageIndex)
    setLightboxOpen(true)
  }

  // Highlight helper
  const getHighlightedContent = (content: string, term?: string) => {
    if (!term || !term.trim()) return content
    
    try {
      // Escape special regex characters
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Match the term only if it's NOT inside an HTML tag
      const regex = new RegExp(`(${escapedTerm})(?![^<]*>)`, 'gi')
      
      return content.replace(regex, '<mark class="bg-yellow-500/30 text-white rounded-sm px-0.5 font-bold">$1</mark>')
    } catch (e) {
      console.error('Highlight error', e)
      return content
    }
  }

  return (
    <article
       onClick={handleCardClick}
       className="bg-mastodon-surface border-b border-mastodon-border p-6 hover:bg-opacity-80 transition-colors first:rounded-t-md last:rounded-b-md cursor-pointer"
    >
      {/* 转发标识 */}
      {post.type === 'boost' && (
        <div className="mb-4 text-sm text-mastodon-text-secondary flex items-center gap-2 pl-14 font-medium">
          <span>🔄</span>
          <span>Boosted</span>
        </div>
      )}

      <div className="flex gap-4">
        {/* 用户头像 */}
        {actor?.avatarUrl ? (
          <img
            src={actor.avatarUrl}
            alt={actor.displayName}
            className="w-12 h-12 rounded-full shrink-0 object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-mastodon-border shrink-0" />
        )}

        <div className="flex-1 min-w-0">
           {/* Header: Name and Time */}
           <div className="flex justify-between items-start mb-3">
              <div className="flex flex-col gap-0.5">
                 <span className="font-bold text-white text-base leading-snug">{actor?.displayName || 'Me'}</span>
                 <span className="text-mastodon-text-secondary text-sm leading-snug">@{actor?.preferredUsername || 'me'}</span>
              </div>

              <div className="flex items-center gap-2 text-mastodon-text-secondary text-sm whitespace-nowrap ml-4">
                 <time dateTime={post.publishedAt.toISOString()} className="hover:underline cursor-pointer">
                    {formatDate(post.publishedAt)}
                 </time>
                 {post.sensitive && (
                  <span className="px-2 py-1 bg-mastodon-warning/10 border border-mastodon-warning/30 text-xs rounded-md text-mastodon-warning font-semibold">
                    CW
                  </span>
                 )}
              </div>
           </div>


          {/* CW 警告 */}
          {post.summary && (
            <div className="mb-4 p-4 bg-mastodon-bg border border-mastodon-border rounded flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{post.summary}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(!isExpanded)
                }}
                className="px-3 py-1.5 text-xs text-mastodon-text-link uppercase font-bold hover:underline cursor-pointer"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            </div>
          )}

          {/* 帖子内容 */}
          {post.content && (!post.summary || isExpanded) && (
            <div
              className="prose prose-invert prose-sm max-w-none mb-4 text-mastodon-text-primary leading-relaxed"
              dangerouslySetInnerHTML={{ __html: getHighlightedContent(post.content, highlight) }}
            />
          )}

          {/* 媒体附件 */}
          {media && media.length > 0 && (!post.summary || isExpanded) && (
            <div className={`grid gap-2 mb-4 mt-4 rounded-lg overflow-hidden ${
              media.length === 1 ? 'grid-cols-1' :
              media.length === 2 ? 'grid-cols-2' :
              media.length === 3 ? 'grid-cols-3' :
              'grid-cols-2'
            }`}>
              {media.map((m, index) => (
                <div key={m.id} className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
                  {m.type === 'image' && (
                    <img
                      src={m.url}
                      alt={m.filename}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      loading="lazy"
                      onClick={() => handleImageClick(index)}
                    />
                  )}
                  {m.type === 'video' && (
                    <video
                      src={m.url}
                      controls
                      className="w-full h-full"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 标签 */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-mastodon-text-link hover:underline text-sm cursor-pointer"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* View Original Link */}
          <div className="flex justify-end mt-5">
             <a 
               href={post.activityId} 
               target="_blank" 
               rel="noopener noreferrer"
               onClick={(e) => e.stopPropagation()}
               className="flex items-center gap-1.5 text-xs text-mastodon-text-secondary hover:text-mastodon-primary transition-colors"
               title="View Original on Server"
             >
               <ExternalLink className="w-3.5 h-3.5" />
               <span>View Original</span>
             </a>
          </div>

          {/* 回复信息 */}
          {post.inReplyTo && (
            <div className="mt-3 text-xs text-mastodon-text-secondary flex items-center gap-1">
              <span>↩️ In reply to a post</span>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox for images */}
      {media && media.length > 0 && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          index={lightboxIndex}
          slides={media
            .filter(m => m.type === 'image')
            .map(m => ({
              src: m.url,
              alt: m.filename,
            }))}
          plugins={[Zoom]}
          zoom={{
            maxZoomPixelRatio: 3,
            scrollToZoom: true
          }}
        />
      )}
    </article>
  )
}
