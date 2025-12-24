
import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { db } from '../../lib/db'
import type { Post } from '../../types'
import { PostCard } from '../Timeline/PostCard'
import { Loader2, ArrowLeft, ExternalLink } from 'lucide-react'

interface ThreadNode {
  post: Post
  children: ThreadNode[]
  depth: number
}

interface ThreadViewProps {
  postId?: string
  onClose?: () => void
}

export function ThreadView({ postId: propPostId, onClose }: ThreadViewProps) {
  const params = useParams<{ id: string }>()
  const initialId = propPostId || params.id
  const navigate = useNavigate()
  const location = useLocation()
  const [focusedPostId, setFocusedPostId] = useState<string>(initialId || '')
  const [post, setPost] = useState<Post | null>(null)
  const [ancestors, setAncestors] = useState<Post[]>([])
  const [replyTree, setReplyTree] = useState<ThreadNode[]>([])
  const [loading, setLoading] = useState(true)
  const focusedPostRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)

  // Build reply tree recursively
  const buildReplyTree = async (postId: string, depth: number = 0): Promise<ThreadNode[]> => {
    const children = await db.posts
      .where('inReplyTo')
      .equals(postId)
      .sortBy('timestamp')

    const nodes: ThreadNode[] = []
    for (const child of children) {
      const childNodes = await buildReplyTree(child.id, depth + 1)
      nodes.push({
        post: child,
        children: childNodes,
        depth
      })
    }
    return nodes
  }

  const handlePostClick = (postId: string) => {
    setFocusedPostId(postId)
  }

  // Sync focused post with external prop changes
  useEffect(() => {
    if (initialId) {
      setFocusedPostId(initialId)
    }
  }, [initialId])

  useEffect(() => {
    if (!focusedPostId) return

    const fetchThread = async () => {
      setLoading(true)
      try {
        // 1. Fetch current post
        const currentPost = await db.posts.get(focusedPostId)
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

        // 3. Build reply tree
        const tree = await buildReplyTree(focusedPostId)
        setReplyTree(tree)

      } catch (error) {
        console.error('Error fetching thread:', error)
      } finally {
        setLoading(false)
        hasScrolledRef.current = false // Reset scroll flag
      }
    }

    fetchThread()
  }, [focusedPostId])

  // Scroll to focused post after content loads
  useEffect(() => {
    if (!loading && focusedPostRef.current && !hasScrolledRef.current) {
      hasScrolledRef.current = true

      // Use requestIdleCallback for smoother performance, fallback to setTimeout
      const scroll = () => {
        focusedPostRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }

      if ('requestIdleCallback' in window) {
        requestIdleCallback(scroll, { timeout: 100 })
      } else {
        setTimeout(scroll, 0)
      }
    }
  }, [loading, focusedPostId])

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

  // Recursive component to render reply tree
  const RenderThreadNode = ({ node, showTopLine = true }: { node: ThreadNode, showTopLine?: boolean }) => {
    const hasChildren = node.children.length > 0
    // If it has children, the line must continue down from the avatar.
    // If it has a previous sibling/parent calling it (showTopLine), the line comes from top.
    
    // Actually, `showTopLine` comes from parent saying "I am connecting to you".
    // For a reply list, the parent (focused post or previous reply) connects to this.
    
    // Logic:
    // Line from Top: Always true for replies (connected to parent/prev).
    // Line to Bottom: True if hasChildren OR if strictly inside a chain? 
    // Actually, simply:
    // If hasChildren -> Line flows down.
    // Is connected from top -> Line flows up.
    
    const showBottomLine = hasChildren

    return (
      <div className="relative">
        <div className="relative group pb-4"> 
            {/* Wrapper has padding-bottom for gap */}

            {/* Connection Lines */}
            {showTopLine && showBottomLine && (
                <div className="absolute left-[40px] top-0 bottom-0 w-[2px] bg-mastodon-border/30 -translate-x-1/2 z-0" />
            )}
            
            {showTopLine && !showBottomLine && (
                <div className="absolute left-[40px] top-0 h-[40px] w-[2px] bg-mastodon-border/30 -translate-x-1/2 z-0" />
            )}

            {!showTopLine && showBottomLine && (
                <div className="absolute left-[40px] top-[40px] bottom-0 w-[2px] bg-mastodon-border/30 -translate-x-1/2 z-0" />
            )}

          {/* Post content */}
          <div onClick={() => handlePostClick(node.post.id)} className="relative z-10 cursor-pointer">
            <PostCard 
                post={node.post} 
                showBorder={false} 
                className="bg-mastodon-surface border border-mastodon-border rounded-lg"
            />
          </div>
        </div>

        {/* Children */}
        {hasChildren && (
          <div className="">
            {node.children.map((child) => (
              <RenderThreadNode
                key={child.post.id}
                node={child}
                showTopLine={true}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const handleBack = () => {
    // If onClose is provided (desktop sidebar mode), just close the panel
    if (onClose) {
      onClose()
      return
    }

    // Otherwise, navigate back (mobile mode)
    const state = location.state as { from?: string } | null
    if (state?.from) {
      // Navigate back to the saved location
      navigate(state.from)
    } else {
      // Fallback to browser back
      navigate(-1)
    }
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col">
       <div className="p-4 border-b border-mastodon-border flex justify-between items-center bg-mastodon-surface/50 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-mastodon-primary hover:text-mastodon-primary/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium">Back</span>
            </button>
            <h2 className="text-lg font-bold text-white">Thread</h2>
          </div>
          {onClose && (
             <button onClick={onClose} className="text-mastodon-text-secondary hover:text-white cursor-pointer p-1">✕</button>
          )}
       </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col pb-20">
            {/* Missing Parent Indicator */}
            {/* Logic: if the first available ancestor has inReplyTo, but we don't have it in the list (meaning it's not in DB) */}
            {(ancestors.length > 0 ? ancestors[0] : post)?.inReplyTo && (
            <div className="relative pb-4">
                 {/* Line descending from the missing parent */}
                <div className="absolute left-[40px] top-0 bottom-0 w-[2px] bg-mastodon-border/30 -translate-x-1/2 z-0"></div>
                
                <div className="p-4 pl-[80px] text-mastodon-text-secondary bg-mastodon-surface border border-mastodon-border rounded-lg border-dashed">
                   <a
                      href={(ancestors.length > 0 ? ancestors[0] : post)?.activityId}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-mastodon-primary hover:underline text-sm flex items-center gap-1"
                   >
                     <span>Read earlier replies</span>
                     <ExternalLink className="w-3 h-3" />
                   </a>
                </div>
            </div>
            )}

            {/* Ancestors */}
            {ancestors.map((p, index) => {
                // Determine lines
                // Top line: If not first, OR if first but has inReplyTo (handled by outer check, but visual connection needed)
                const hasParent = index > 0 || !!p.inReplyTo
                const hasChild = true // Ancestors always have a child (next ancestor or focused post)
                
                return (
                <div key={p.id} className="relative cursor-pointer group pb-4" onClick={() => handlePostClick(p.id)}>
                    {/* Lines */}
                    {hasParent && hasChild && (
                        <div className="absolute left-[40px] top-0 bottom-0 w-[2px] bg-mastodon-border/30 -translate-x-1/2 z-0" />
                    )}
                    {!hasParent && hasChild && (
                        <div className="absolute left-[40px] top-[40px] bottom-0 w-[2px] bg-mastodon-border/30 -translate-x-1/2 z-0" />
                    )}

                    <div className="relative z-10">
                        <PostCard post={p} showBorder={false} className="bg-mastodon-surface border border-mastodon-border rounded-lg" />
                    </div>
                </div>
            )})}

            {/* Current Post - Highlighted/Expanded */}
            <div ref={focusedPostRef} className="relative group pb-4">
                {/* Lines */}
                {(ancestors.length > 0 || !!post.inReplyTo) && (
                    <div className="absolute left-[40px] top-0 h-[40px] w-[2px] bg-mastodon-border/30 -translate-x-1/2 z-0"></div>
                )}

                {replyTree.length > 0 && (
                   <div className="absolute left-[40px] top-[40px] bottom-0 w-[2px] bg-mastodon-border/30 -translate-x-1/2 z-0"></div>
                )}

                <div className="relative z-10">
                    <PostCard post={post} showBorder={false} className="bg-mastodon-surface border border-mastodon-border rounded-lg ring-2 ring-mastodon-primary/20" />
                </div>
            </div>

            {/* Reply Tree */}
            <div className="">
                {replyTree.map((node) => (
                    <RenderThreadNode
                        key={node.post.id}
                        node={node}
                        showTopLine={true}
                    />
                ))}
            </div>

            {replyTree.length === 0 && ancestors.length === 0 && (
            <div className="p-8 text-center text-mastodon-text-secondary">
                <p>No replies found in archive.</p>
            </div>
            )}
        </div>
      </div>
    </div>
  )
}
