import { AlertCircle, RefreshCw, Combine } from 'lucide-react'
import type { AccountConflict, ImportStrategy } from '../../types'

interface ImportStrategyDialogProps {
  conflict: AccountConflict
  onSelect: (strategy: ImportStrategy) => void
}

export function ImportStrategyDialog({ conflict, onSelect }: ImportStrategyDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative bg-mastodon-bg rounded-xl shadow-2xl max-w-2xl w-full mx-4 p-6 border border-mastodon-border">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">
              Account Already Exists
            </h2>
            <p className="text-mastodon-text-secondary">
              The account <span className="text-white font-medium">@{conflict.username}</span> ({conflict.displayName}) is already imported.
            </p>
          </div>
        </div>

        {/* Info */}
        <p className="text-mastodon-text-secondary mb-6">
          How would you like to handle the new archive?
        </p>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Replace Mode */}
          <button
            onClick={() => onSelect('replace')}
            className="group p-6 bg-mastodon-surface border-2 border-mastodon-border hover:border-red-500/50 rounded-lg transition-all text-left cursor-pointer"
          >
            <div className="flex items-start gap-3 mb-3">
              <RefreshCw className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Replace (Overwrite)
                </h3>
                <p className="text-sm text-mastodon-text-secondary">
                  Delete all existing data for this account and import the new archive.
                </p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300">
              <strong>Warning:</strong> All existing posts, likes, and bookmarks will be permanently deleted.
            </div>
          </button>

          {/* Merge Mode */}
          <button
            onClick={() => onSelect('merge')}
            className="group p-6 bg-mastodon-surface border-2 border-mastodon-border hover:border-mastodon-primary rounded-lg transition-all text-left cursor-pointer"
          >
            <div className="flex items-start gap-3 mb-3">
              <Combine className="w-6 h-6 text-mastodon-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Merge (Smart Combine)
                </h3>
                <p className="text-sm text-mastodon-text-secondary">
                  Keep existing data and add new items from the archive.
                </p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-mastodon-primary/10 border border-mastodon-primary/20 rounded text-xs text-mastodon-text-secondary">
              <strong>Smart:</strong> Posts with the same ID will be updated. New posts will be added.
            </div>
          </button>
        </div>

        {/* Additional Info */}
        <div className="text-xs text-mastodon-text-secondary bg-mastodon-surface p-4 rounded-lg">
          <p className="mb-2">
            <strong className="text-white">💡 Recommendation:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Use <strong className="text-white">Replace</strong> if you're re-importing the same period to fix issues</li>
            <li>Use <strong className="text-white">Merge</strong> if you're importing archives from different time periods</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
