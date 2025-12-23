import { useNavigate, useLocation } from 'react-router-dom'
import { useAccount } from '../hooks/usePosts'
import { Calendar, MessageSquare, ArrowLeft, Star, Bookmark } from 'lucide-react'
import { useInfiniteScrollPosts } from '../hooks/useInfiniteScroll'
import { PostCard } from '../components/Timeline/PostCard'
import { Loader2 } from 'lucide-react'
import { useRef, useEffect } from 'react'

export function AccountDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()

  // Extract accountId from pathname (everything after /account/)
  const accountId = decodeURIComponent(location.pathname.replace('/account/', ''))

  const account = useAccount(accountId)

  // 加载该账号的帖子
  const { posts, isLoading, hasMore, loadMore } = useInfiniteScrollPosts(accountId)

  // 无限滚动检测
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      const element = scrollRef.current
      if (!element) return

      const { scrollTop, scrollHeight, clientHeight } = element
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 500

      if (isNearBottom && hasMore && !isLoading) {
        loadMore()
      }
    }

    const element = scrollRef.current
    if (element) {
      element.addEventListener('scroll', handleScroll)
      return () => element.removeEventListener('scroll', handleScroll)
    }
  }, [hasMore, isLoading, loadMore])

  // Loading state (undefined means still loading)
  if (account === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-mastodon-primary mb-4"></div>
          <p className="text-mastodon-text-secondary">Loading account...</p>
        </div>
      </div>
    )
  }

  // Not found (null means query completed but no result)
  if (account === null || !account) {
    return (
      <div className="flex items-center justify-center h-full text-mastodon-text-secondary">
        <div className="text-center">
          <p className="text-lg mb-4">Account not found</p>
          <p className="text-sm mb-4">ID: {accountId}</p>
          <button
            onClick={() => navigate('/accounts')}
            className="text-mastodon-primary hover:underline"
          >
            Back to Accounts
          </button>
        </div>
      </div>
    )
  }

  // Format date
  const joinDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(account.createdAt)

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto pb-10">
        {/* Back Button */}
        <div className="px-6 pt-4 pb-2">
          <button
            onClick={() => navigate('/accounts')}
            className="flex items-center gap-2 text-mastodon-text-secondary hover:text-mastodon-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Accounts</span>
          </button>
        </div>

        {/* Header Banner */}
        <div className="h-48 md:h-64 bg-mastodon-surface relative overflow-hidden rounded-b-lg">
          {account.headerUrl ? (
            <img
              src={account.headerUrl}
              alt="Header"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-mastodon-primary to-purple-600 opacity-30" />
          )}
        </div>

        <div className="px-6 relative">
          {/* Avatar */}
          <div className="-mt-16 md:-mt-20 mb-4 inline-block relative">
            <div className="p-1.5 bg-mastodon-bg rounded-full">
              {account.avatarUrl ? (
                <img
                  src={account.avatarUrl}
                  alt={account.displayName}
                  className="w-32 h-32 md:w-36 md:h-36 rounded-full object-cover border-4 border-mastodon-bg"
                />
              ) : (
                <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-mastodon-surface border-4 border-mastodon-bg" />
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{account.displayName}</h1>
              <p className="text-mastodon-text-secondary text-lg">@{account.preferredUsername}</p>
            </div>

            {/* Bio */}
            <div
              className="prose prose-invert max-w-none text-mastodon-text-primary"
              dangerouslySetInnerHTML={{ __html: account.summary }}
            />

            {/* Metadata Fields */}
            {account.fields && account.fields.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-mastodon-border py-4">
                {account.fields.map((field, index) => (
                  <div key={index} className="flex flex-col">
                    <span className="text-mastodon-text-secondary text-sm uppercase font-bold text-xs">{field.name}</span>
                    <span className="text-white font-medium" dangerouslySetInnerHTML={{ __html: field.value }} />
                  </div>
                ))}
              </div>
            )}

            {/* Joined Date */}
            <div className="flex items-center gap-2 text-mastodon-text-secondary border-t border-mastodon-border pt-4 pb-4">
              <Calendar className="w-4 h-4" />
              <span>Joined {joinDate}</span>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4 border-t border-mastodon-border py-6">
              <div className="flex flex-col items-center gap-2 p-4 bg-mastodon-bg rounded-lg">
                <MessageSquare className="w-6 h-6 text-mastodon-primary" />
                <span className="font-bold text-white text-2xl">{account.postsCount.toLocaleString()}</span>
                <span className="text-mastodon-text-secondary text-sm">Posts</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-mastodon-bg rounded-lg">
                <Star className="w-6 h-6 text-[#e5c500]" />
                <span className="font-bold text-white text-2xl">{account.likesCount.toLocaleString()}</span>
                <span className="text-mastodon-text-secondary text-sm">Likes</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-mastodon-bg rounded-lg">
                <Bookmark className="w-6 h-6 text-[#2b90d9]" />
                <span className="font-bold text-white text-2xl">{account.bookmarksCount.toLocaleString()}</span>
                <span className="text-mastodon-text-secondary text-sm">Bookmarks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Posts Timeline Section */}
        <div className="px-6 mt-8">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            Posts
          </h2>

          {posts && posts.length > 0 ? (
            <div className="space-y-0 bg-mastodon-surface rounded-lg overflow-hidden">
              {posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                />
              ))}

              {/* Loading more indicator */}
              {isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-mastodon-primary" />
                </div>
              )}

              {/* End of posts */}
              {!hasMore && posts.length > 0 && (
                <div className="text-center py-8 text-mastodon-text-secondary text-sm">
                  No more posts
                </div>
              )}
            </div>
          ) : (
            <div className="bg-mastodon-surface rounded-lg p-12 text-center text-mastodon-text-secondary">
              No posts yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
