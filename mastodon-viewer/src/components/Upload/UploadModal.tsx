import { X } from 'lucide-react'
import { UploadZone } from './UploadZone'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: () => void
  googleUser?: any
  googleLogin?: () => void
  googleAccessToken?: string | null
}

export function UploadModal({
  isOpen,
  onClose,
  onUploadComplete,
  googleUser,
  googleLogin,
  googleAccessToken
}: UploadModalProps) {
  if (!isOpen) return null

  const handleUploadComplete = () => {
    onUploadComplete()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-mastodon-bg rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-mastodon-surface hover:bg-mastodon-border transition-colors text-mastodon-text-secondary hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Upload Zone */}
        <div className="p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Import Another Archive</h2>
          <UploadZone
            onUploadComplete={handleUploadComplete}
            googleUser={googleUser}
            googleLogin={googleLogin}
            googleAccessToken={googleAccessToken}
          />
        </div>
      </div>
    </div>
  )
}
