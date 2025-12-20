import { useCallback, useState } from 'react'
import { Upload, FileArchive, Loader2 } from 'lucide-react'
import { ArchiveParser } from '../../lib/parser'
import type { ParseProgress } from '../../types'

interface UploadZoneProps {
  onUploadComplete: () => void
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<ParseProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setError('请上传 .zip 格式的 Mastodon 存档文件')
      return
    }

    setUploading(true)
    setError(null)
    setProgress(null)

    try {
      const parser = new ArchiveParser(setProgress)
      await parser.parseArchive(file)

      // 解析完成
      onUploadComplete()
    } catch (err) {
      console.error('解析失败:', err)
      setError(err instanceof Error ? err.message : '存档解析失败，请检查文件格式')
    } finally {
      setUploading(false)
    }
  }, [onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div
        className="border-2 border-dashed border-mastodon-border rounded-lg p-12 text-center hover:border-mastodon-primary transition-colors cursor-pointer bg-mastodon-surface"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {uploading ? (
          <div className="space-y-4">
            <Loader2 className="w-16 h-16 mx-auto animate-spin text-mastodon-primary" />
            <div>
              <p className="text-lg font-medium text-white">
                {progress?.stage || 'Processing...'}
              </p>
              {progress && progress.total > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm text-mastodon-text-secondary">
                    {progress.progress} / {progress.total}
                  </p>
                  <div className="w-full bg-mastodon-bg rounded-full h-2">
                    <div
                      className="bg-mastodon-primary h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(progress.progress / progress.total) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-mastodon-error/20 flex items-center justify-center">
              <span className="text-2xl">❌</span>
            </div>
            <div>
              <p className="text-lg font-medium text-mastodon-error">
                Upload Failed
              </p>
              <p className="text-sm text-mastodon-text-secondary mt-2">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-mastodon-primary text-white rounded-lg hover:bg-mastodon-primary-hover transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <FileArchive className="w-16 h-16 mx-auto text-mastodon-text-secondary" />
            <div>
              <p className="text-xl font-medium text-white">
                Drag & Drop Mastodon Archive
              </p>
              <p className="text-sm text-mastodon-text-secondary mt-2">
                or click to select file
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-mastodon-primary text-white rounded-lg cursor-pointer hover:bg-mastodon-primary-hover transition-colors font-medium">
              <Upload className="w-5 h-5" />
              Select File
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleChange}
              />
            </label>
            <p className="text-xs text-mastodon-text-secondary mt-4">
              Supports .zip archives exported from Mastodon
            </p>
          </div>
        )}
      </div>

      {!uploading && !error && (
        <div className="mt-6 p-4 bg-mastodon-surface border border-mastodon-border rounded-lg">
          <h3 className="text-sm font-medium text-mastodon-primary mb-2">
            How to get your archive?
          </h3>
          <ol className="text-sm text-mastodon-text-secondary space-y-1 list-decimal list-inside">
            <li>Log in to your Mastodon account</li>
            <li>Go to Settings → Import and Export → Request Archive</li>
            <li>Wait for the email (minutes to hours)</li>
            <li>Download the .zip file and upload it here</li>
          </ol>
        </div>
      )}
    </div>
  )
}
