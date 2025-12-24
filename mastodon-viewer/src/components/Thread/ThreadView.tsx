import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../../lib/db'
import type { Post } from '../../types'
import { PostCard } from '../Timeline/PostCard'
import { Loader2, ArrowLeft } from 'lucide-react'

interface ThreadViewProps {
  postId?: string
  onClose?: () => void
}

export function ThreadView({ postId: propPostId, onClose }: ThreadViewProps) {
  const params = useParams<{ id: string }>()
  const id = propPostId || params.id
  const navigate = useNavigate()
  const [post, setPost] = useState<Post | null>(null)
  const [ancestors, setAncestors] = useState<Post[]>([])
  const [replies, setReplies] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const fetchThread = async () => {
      setLoading(true)
      try {
        // 1. Fetch current post
        const currentPost = await db.posts.get(id)
        if (!currentPost) {
          setLoading(false)
          return
        }
        setPost(currentPost)

        // 2. Fetch ancestors (parents)
        const parents: Post[] = []
        let currentId = currentPost.inReplyTo
        while (currentId) {
          const parent = await db.posts.get(currentId)
          if (parent) {
            parents.unshift(parent) // Add to beginning
            currentId = parent.inReplyTo
          } else {
            // Parent not found in archive
            break 
          }
        }
        setAncestors(parents)

        // 3. Fetch direct replies (children)
        // Note: Dexie/IndexedDB index query for equality
        const children = await db.posts
          .where('inReplyTo')
          .equals(id)
          .sortBy('timestamp')
          
        setReplies(children)

      } catch (error) {
        console.error('Error fetching thread:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchThread()
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-mastodon-primary" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="text-center py-12 text-mastodon-text-secondary">
        <p>Post not found</p>
        {!propPostId && (
          <button 
             onClick={() => navigate('/')} 
             className="mt-4 text-mastodon-primary hover:underline"
          >
             Return Home
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="h-full px-4 py-4">
      {!propPostId && (
      <div className="mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-3 py-2 text-mastodon-primary hover:bg-mastodon-surface transition-colors font-medium cursor-pointer rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>
      )}

      {propPostId && onClose && (
        <div className="mb-4 flex justify-between items-center border-b border-mastodon-border pb-3">
            <h2 className="text-lg font-bold text-white">Thread</h2>
            <button onClick={onClose} className="text-mastodon-text-secondary hover:text-white cursor-pointer text-xl leading-none p-1">✕</button>
        </div>
      )}

      <div className="flex flex-col">
        {/* Missing Parent Indicator */}
        {(ancestors.length > 0 ? ancestors[0] : post)?.inReplyTo && (
           <div className="mb-4 p-4 border border-mastodon-border border-dashed rounded text-center text-mastodon-text-secondary bg-mastodon-bg/50">
              <p className="mb-2 text-sm">Parent post not found in local archive.</p>
              <a
                 href={(ancestors.length > 0 ? ancestors[0] : post)?.activityId}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-mastodon-primary hover:underline text-sm"
              >
                 This thread continues from an earlier post.
              </a>
           </div>
        )}

        {/* Ancestors */}
        {ancestors.map((p, index) => (
          <div key={p.id} className="relative mb-3">
             <PostCard post={p} showBorder={false} />
             {/* Connection line to next post */}
             <div className="absolute left-[26px] bottom-[-12px] w-[2px] h-3 bg-mastodon-border/40"></div>
          </div>
        ))}

        {/* Current Post - Highlighted */}
        <div className="relative mb-3">
           {ancestors.length > 0 && (
             <div className="absolute left-[26px] top-[-12px] w-[2px] h-3 bg-mastodon-border/40"></div>
           )}
           <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-mastodon-primary rounded-full"></div>
              <div className="pl-2">
                 <PostCard post={post} showBorder={false} />
              </div>
           </div>
           {/* Connection line to replies */}
           {replies.length > 0 && (
             <div className="absolute left-[26px] bottom-[-12px] w-[2px] h-3 bg-mastodon-border/40"></div>
           )}
        </div>

        {/* Replies */}
        {replies.length > 0 && (
           <div className="relative">
              {replies.map((p, index) => (
                 <div key={p.id} className="relative mb-3">
                    {/* Vertical line connecting all replies */}
                    {index < replies.length - 1 && (
                      <div className="absolute left-[26px] top-0 bottom-[-12px] w-[2px] bg-mastodon-border/30"></div>
                    )}
                    {/* Horizontal connector to avatar */}
                    <div className="absolute left-[26px] top-[26px] w-4 h-[2px] bg-mastodon-border/30"></div>
                    <div className="pl-10">
                       <PostCard post={p} showBorder={false} />
                    </div>
                 </div>
              ))}
           </div>
        )}
        {replies.length === 0 && ancestors.length === 0 && (
           <p className="text-center text-sm text-mastodon-text-secondary py-8 mt-4">
              No replies found in archive.
           </p>
        )}
      </div>
    </div>
  )
}
