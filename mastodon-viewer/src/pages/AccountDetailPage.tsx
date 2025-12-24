import { useNavigate, useLocation } from 'react-router-dom'
import { useAccount } from '../hooks/usePosts'
import { Calendar, MessageSquare, ArrowLeft, Star, Bookmark, History, FileArchive, Database } from 'lucide-react'
import { useState, useEffect } from 'react'
import { db } from '../lib/db'
import type { ImportRecord } from '../types'

export function AccountDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()

  // Extract accountId from pathname (everything after /account/)
  const accountId = decodeURIComponent(location.pathname.replace('/account/', ''))

  const account = useAccount(accountId)
  const [history, setHistory] = useState<ImportRecord[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  useEffect(() => {
    if (accountId) {
      const loadHistory = async () => {
        try {
          const records = await db.getImportHistory(accountId)
          setHistory(records)
        } catch (error) {
          console.error('Failed to load import history:', error)
        } finally {
          setIsLoadingHistory(false)
        }
      }
      loadHistory()
    }
  }, [accountId])

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

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto pb-10">
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-mastodon-text-secondary text-lg">@{account.preferredUsername}</p>
                <div className="flex items-center gap-1.5 text-mastodon-text-secondary text-sm bg-white/5 px-2 py-0.5 rounded-full">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Joined {joinDate}</span>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div
              className="prose prose-invert max-w-none text-mastodon-text-primary"
              dangerouslySetInnerHTML={{ __html: account.summary }}
            />

            {/* Metadata Fields */}
            {account.fields && account.fields.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-mastodon-border pt-4">
                {account.fields.map((field, index) => (
                  <div key={index} className="flex flex-col">
                    <span className="text-mastodon-text-secondary text-sm uppercase font-bold text-xs">{field.name}</span>
                    <span className="text-white font-medium" dangerouslySetInnerHTML={{ __html: field.value }} />
                  </div>
                ))}
              </div>
            )}

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4 border-t border-mastodon-border pt-6 pb-2">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-5 h-5 text-mastodon-text-secondary" />
                  <span className="font-bold text-white text-2xl">{account.postsCount.toLocaleString()}</span>
                </div>
                <span className="text-mastodon-text-secondary text-sm uppercase tracking-wider font-medium">Posts</span>
              </div>
              
              <div className="flex flex-col items-center border-l border-mastodon-border">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-5 h-5 text-[#e5c500]" />
                  <span className="font-bold text-white text-2xl">{account.likesCount.toLocaleString()}</span>
                </div>
                <span className="text-mastodon-text-secondary text-sm uppercase tracking-wider font-medium">Likes</span>
              </div>
              
              <div className="flex flex-col items-center border-l border-mastodon-border">
                <div className="flex items-center gap-2 mb-1">
                  <Bookmark className="w-5 h-5 text-[#2b90d9]" />
                  <span className="font-bold text-white text-2xl">{account.bookmarksCount.toLocaleString()}</span>
                </div>
                <span className="text-mastodon-text-secondary text-sm uppercase tracking-wider font-medium">Saved</span>
              </div>
            </div>
          </div>
        </div>

        {/* Archive History Section */}
        <div className="px-6 mt-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <History className="w-6 h-6" />
            Archive History
          </h2>

          <div className="bg-mastodon-surface rounded-lg overflow-hidden border border-mastodon-border">
            {isLoadingHistory ? (
              <div className="p-8 text-center text-mastodon-text-secondary">
                Loading history...
              </div>
            ) : history.length > 0 ? (
              <div className="divide-y divide-mastodon-border">
                {history.map((record) => (
                  <div key={record.id} className="p-6 hover:bg-white/5 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-mastodon-primary/20 rounded-lg text-mastodon-primary mt-1">
                          <FileArchive className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{record.fileName}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-mastodon-text-secondary">
                            <span>{new Date(record.importedAt).toLocaleString()}</span>
                            <span>•</span>
                            <span>{formatFileSize(record.fileSize)}</span>
                            <span>•</span>
                            <span className={`uppercase text-xs font-bold px-2 py-0.5 rounded ${
                              record.importStrategy === 'replace' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
                            }`}>
                              {record.importStrategy || 'Replace'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 bg-mastodon-bg/50 p-4 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-mastodon-text-secondary text-xs uppercase font-bold">Posts</span>
                        <span className="text-white text-lg font-mono">{record.stats.posts.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-mastodon-text-secondary text-xs uppercase font-bold">Media</span>
                        <span className="text-white text-lg font-mono">{record.stats.media.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-mastodon-text-secondary text-xs uppercase font-bold">Likes</span>
                        <span className="text-white text-lg font-mono">{record.stats.likes.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-mastodon-text-secondary text-xs uppercase font-bold">Bookmarks</span>
                        <span className="text-white text-lg font-mono">{record.stats.bookmarks.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="inline-block p-4 bg-mastodon-bg rounded-full mb-4 text-mastodon-text-secondary">
                  <Database className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Import History</h3>
                <p className="text-mastodon-text-secondary">
                  Import records will appear here after you upload an archive.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}