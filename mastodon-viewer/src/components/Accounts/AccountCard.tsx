import type { Account } from '../../types'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Star, Bookmark, Trash2, Calendar, Clock } from 'lucide-react'
import { db } from '../../lib/db'
import { useState } from 'react'

interface AccountCardProps {
  account: Account
}

export function AccountCard({ account }: AccountCardProps) {
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation() // 防止触发卡片点击

    if (!confirm(`Are you sure you want to delete all data for @${account.preferredUsername}? This cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      await db.clearAccount(account.id)
      // 如果这是最后一个账号，刷新页面回到上传界面
      const remainingAccounts = await db.getAllAccounts()
      if (remainingAccounts.length === 0) {
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert('Failed to delete account. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date)
  }

  return (
    <div
      onClick={() => navigate(`/account/${encodeURIComponent(account.id)}`)}
      className="bg-mastodon-surface rounded-xl border border-mastodon-border hover:border-mastodon-primary transition-all cursor-pointer group p-6 relative"
    >
      {/* Delete Button - Top Right */}
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="absolute top-4 right-4 p-2 text-mastodon-text-secondary hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
        title="Delete Account"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      {/* First row: Avatar + Name & Username */}
      <div className="flex items-center gap-4 mb-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {account.avatarUrl ? (
            <img
              src={account.avatarUrl}
              alt={account.displayName}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-mastodon-bg" />
          )}
        </div>

        {/* Name & Username */}
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-white truncate group-hover:text-mastodon-primary transition-colors">
            {account.displayName}
          </h3>
          <p className="text-mastodon-text-secondary truncate">@{account.preferredUsername}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-mastodon-text-secondary" />
          <div>
            <div className="text-xl font-bold text-white">{account.postsCount.toLocaleString()}</div>
            <div className="text-xs text-mastodon-text-secondary">Posts</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-[#e5c500]" />
          <div>
            <div className="text-xl font-bold text-white">{account.likesCount.toLocaleString()}</div>
            <div className="text-xs text-mastodon-text-secondary">Likes</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-[#2b90d9]" />
          <div>
            <div className="text-xl font-bold text-white">{account.bookmarksCount.toLocaleString()}</div>
            <div className="text-xs text-mastodon-text-secondary">Bookmarks</div>
          </div>
        </div>
      </div>

      {/* Timestamps row */}
      <div className="flex gap-6 text-xs text-mastodon-text-secondary">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          <span>Imported {formatDate(account.importedAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          <span>Updated {formatDate(account.lastUpdatedAt)}</span>
        </div>
      </div>
    </div>
  )
}
