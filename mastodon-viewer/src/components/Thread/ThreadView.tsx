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
    <div className="max-w-2xl mx-auto pt-4 pb-12">
      {!propPostId && (
      <div className="mb-4 px-4">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-mastodon-primary hover:text-mastodon-primary-hover transition-colors font-medium cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>
      )}
      
      {propPostId && onClose && (
        <div className="mb-4 px-4 flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Thread</h2>
            <button onClick={onClose} className="text-mastodon-text-secondary hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      <div className="flex flex-col">
        {/* Missing Parent Indicator */}
        {(ancestors.length > 0 ? ancestors[0] : post)?.inReplyTo && (
           <div className="mb-4 p-4 border border-mastodon-border border-dashed rounded-lg text-center text-mastodon-text-secondary bg-mastodon-bg/50">
              <p className="mb-2 text-sm">Parent post not found in local archive.</p>
              <a 
                 href={(ancestors.length > 0 ? ancestors[0] : post)?.activityId} // This might be wrong, we want the PARENT'S URL. But we don't have it easily unless we store strict InReplyTo URL.
                 // Actually, we only have the ID.
                 // But wait, the post object has `activityId` which is the URL.
                 // We don't have the parent object, so we don't have its URL.
                 // We only have the Short ID (index).
                 // However, we can just say "View thread on original instance" using the current post's link?
                 // Or just a static message.
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-mastodon-primary hover:underline text-sm"
              >
                 This thread continues from an earlier post.
              </a>
           </div>
        )}

        {/* Ancestors */}
        {ancestors.map(p => (
          <div key={p.id} className="relative">
             <PostCard post={p} />
              {/* Connecting line idea - styled via border or pseudoelement if needed, but simple stack works for now */}
             <div className="mx-auto w-0.5 h-4 bg-mastodon-border/50"></div>
          </div>
        ))}
        
        {/* Current Post */}
        <div className="my-2 border-l-4 border-mastodon-primary pl-0 rounded-lg overflow-hidden shadow-lg transform scale-[1.01]">
           <PostCard post={post} />
        </div>

        {/* Replies */}
        {replies.length > 0 && (
           <div className="pl-4 border-l-2 border-mastodon-border ml-6 mt-2 space-y-4">
              {replies.map(p => (
                 <PostCard key={p.id} post={p} />
              ))}
           </div>
        )}
        {replies.length === 0 && (
           <p className="text-center text-sm text-mastodon-text-secondary py-8">
              No replies found in archive.
           </p>
        )}
      </div>
    </div>
  )
}
