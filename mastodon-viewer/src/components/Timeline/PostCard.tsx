import { ExternalLink, Reply } from 'lucide-react'
import type { Post } from '../../types'
import { useMedia, useAccount } from '../../hooks/usePosts'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import { EmbeddedPost } from './EmbeddedPost'

interface PostCardProps {
  post: Post
  highlight?: string
  onClick?: () => void
  showBorder?: boolean
  className?: string
}

export function PostCard({ post, onClick, highlight, showBorder = true, className = '' }: PostCardProps) {
  // 侦探代码：看看控制台里有没有打印出 emojis 数组
  console.log('当前帖子数据:', post.id, (post as any).emojis);
  // Logic to fetch boosted post if it's a boost
  const boostedPost = useLiveQuery(
    async () => {
      if (post.type !== 'boost' || !post.boostedPostId) return null
      const idPart = post.boostedPostId.split('/').pop()
      if (!idPart) return null
      return db.posts.get(idPart)
    },
    [post.id, post.type, post.boostedPostId]
  )

  const displayPost = boostedPost || post
  const media = useMedia(displayPost.mediaIds)
  const actor = useAccount(post.accountId)
  const [isExpanded, setIsExpanded] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

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
    const target = e.target as HTMLElement
    if (target.closest('a') || target.closest('button') || target.closest('video') || target.closest('img')) {
      return
    }
    onClick?.()
  }

  const handleImageClick = (mediaIndex: number) => {
    let imageIndex = 0
    for (let i = 0; i < mediaIndex; i++) {
      if (media?.[i]?.type === 'image') {
        imageIndex++
      }
    }
    setLightboxIndex(imageIndex)
    setLightboxOpen(true)
  }

  // Content cleaner helper
  const cleanContent = (content: string) => {
    if (!content) return content
    let cleaned = content
    const tagRegex = /(?:<p>)?\s*<a [^>]*class="[^"]*hashtag[^"]*"[^>]*>#[^<]+<\/a>\s*(?:<\/p>)?\s*$/i
    while (tagRegex.test(cleaned)) {
      cleaned = cleaned.replace(tagRegex, '')
    }
    return cleaned
  }

  /**
   * 新增：自定义表情替换函数
   * 将 :shortcode: 替换为 <img /> 标签
   */
  const replaceCustomEmojis = (content: string, emojis: any[]) => {
    if (!content || !emojis || emojis.length === 0) return content

    let newContent = content
    emojis.forEach((emoji) => {
      const shortcode = `:${emoji.shortcode}:`
      // 使用内联样式确保表情大小和文字一致
      const imgTag = `<img 
        src="${emoji.url}" 
        alt="${emoji.shortcode}" 
        title="${emoji.shortcode}" 
        class="custom-emoji" 
        style="height: 1.3em; width: auto; vertical-align: middle; display: inline-block; object-fit: contain; margin: 0 2px;" 
      />`
      
      // 全局替换
      newContent = newContent.split(shortcode).join(imgTag)
    })

    return newContent
  }

  const getHighlightedContent = (content: string, term?: string) => {
    const cleanedContent = cleanContent(content)
    let finalContent = cleanedContent

    // 1. 先处理高亮
    if (term && term.trim()) {
      try {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`(${escapedTerm})(?![^<]*>)`, 'gi')
        finalContent = cleanedContent.replace(regex, '<mark class="bg-yellow-500/30 text-white rounded-sm px-0.5 font-bold">$1</mark>')
      } catch (e) {
        console.error('Highlight error', e)
      }
    }

    // 2. 最后处理 Emoji 替换 (确保高亮逻辑不会破坏 img 标签)
    // 使用 (displayPost as any) 是为了防止类型定义中缺少 emojis 字段导致报错
    const emojis = (displayPost as any).emojis || []
    return replaceCustomEmojis(finalContent, emojis)
  }

  const slides = media
    ?.filter(m => m.type === 'image')
    .map(m => ({
      src: m.url,
      alt: m.filename,
    })) || []

  return (
    <article
       onClick={handleCardClick}
       className={`p-4 hover:bg-opacity-80 transition-colors cursor-pointer ${
         showBorder ? 'border-b border-mastodon-border first:rounded-t-md last:rounded-b-md' : 'rounded-md'
       } ${className ? className : 'bg-mastodon-surface'}`}
    >
      {post.type === 'boost' && (
        <div className="mb-2 text-sm text-mastodon-text-secondary flex items-center gap-2 pl-12">
          <span>🔄</span>
          <span>Boosted</span>
        </div>
      )}

      <div className="flex gap-3">
        {actor?.avatarUrl ? (
          <img
            src={actor.avatarUrl}
            alt={actor.displayName}
            className="w-12 h-12 rounded-full shrink-0 object-cover relative z-10 bg-mastodon-surface"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-mastodon-border shrink-0 relative z-10" />
        )}

        <div className="flex-1 min-w-0">
           <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col min-w-0 mr-2">
                 <span className="font-bold text-white text-base leading-snug truncate">{actor?.displayName || 'Me'}</span>
                 <span className="text-mastodon-text-secondary text-sm leading-snug truncate">@{actor?.preferredUsername || 'me'}</span>
              </div>

              <div className="flex items-center gap-1 text-mastodon-text-secondary text-sm whitespace-nowrap ml-4">
                 <time dateTime={post.publishedAt.toISOString()} className="hover:underline cursor-pointer">
                    {formatDate(post.publishedAt)}
                 </time>
                  {displayPost.sensitive && (
                  <span className="ml-2 px-1.5 py-0.5 bg-mastodon-bg border border-mastodon-border text-xs rounded text-mastodon-warning">
                    CW
                  </span>
                 )}
              </div>
           </div>

          {displayPost.summary && (
            <div className="mb-3 p-3 bg-mastodon-bg border border-mastodon-border rounded flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{post.summary}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(!isExpanded)
                }}
                className="text-xs text-mastodon-text-link uppercase font-bold hover:underline cursor-pointer"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            </div>
          )}

          {/* 渲染内容 */}
          {displayPost.content && (!displayPost.summary || isExpanded) && (
            <div
              className="prose prose-invert prose-sm max-w-none mb-3 text-mastodon-text-primary leading-snug break-words overflow-hidden"
              dangerouslySetInnerHTML={{ __html: getHighlightedContent(displayPost.content, highlight) }}
            />
          )}

          {post.type === 'boost' && !boostedPost && post.boostedPostId && (
              <div className="mb-3">
                 <EmbeddedPost url={post.boostedPostId} />
              </div>
          )}

          {media && media.length > 0 && (!displayPost.summary || isExpanded) && (
            <div className={`grid gap-2 mb-3 mt-3 rounded-lg overflow-hidden ${
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

          {displayPost.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {displayPost.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-mastodon-text-link hover:underline text-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-4 text-xs text-mastodon-text-secondary">
             <div className="flex items-center gap-4">
                {displayPost.inReplyTo && (
                   <div className="flex items-center gap-1.5">
                      <Reply className="w-3.5 h-3.5" />
                      <span>In reply to a post</span>
                   </div>
                )}
                
                {post.type === 'boost' && !boostedPost && (
                   <div className="flex items-center gap-1.5 text-mastodon-text-secondary italic">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>External Boost</span>
                   </div>
                )}
             </div>

             <a 
               href={displayPost.activityId || displayPost.originalUrl} 
               target="_blank" 
               rel="noopener noreferrer"
               onClick={(e) => e.stopPropagation()}
               className="flex items-center gap-1.5 hover:text-mastodon-primary transition-colors"
               title="View Original on Server"
             >
               <ExternalLink className="w-3.5 h-3.5" />
               <span>View Original</span>
             </a>
          </div>
        </div>
      </div>

      {slides.length > 0 && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          index={lightboxIndex}
          slides={slides}
          carousel={{ finite: true }}
          render={{
            buttonPrev: slides.length <= 1 ? () => null : undefined,
            buttonNext: slides.length <= 1 ? () => null : undefined,
          }}
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