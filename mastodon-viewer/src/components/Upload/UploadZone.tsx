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
    const fileName = file.name.toLowerCase()
    const isValidFormat = fileName.endsWith('.zip') || fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz')

    if (!isValidFormat) {
      setError('请上传 .zip 或 .tar.gz 格式的 Mastodon 存档文件')
      return
    }

    // 检查文件大小
    if (file.size === 0) {
      setError('文件为空，请选择有效的存档文件')
      return
    }

    // 检查文件是否可读
    try {
      // 尝试读取文件的前几个字节来验证文件可访问性
      const testChunk = file.slice(0, 4)
      await testChunk.arrayBuffer()
    } catch (err) {
      console.error('文件访问测试失败:', err)
      setError('无法读取文件。请确保：\n1. 文件未被其他程序占用\n2. 文件没有被移动或删除\n3. 浏览器有权限访问该文件\n\n请关闭其他可能占用该文件的程序，然后重试。')
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
      const errorMessage = err instanceof Error ? err.message : '存档解析失败，请检查文件格式'

      // 检查是否是文件读取权限错误
      if (errorMessage.includes('permission') || errorMessage.includes('could not be read')) {
        setError('文件读取权限错误。可能的解决方法：\n1. 关闭可能占用文件的程序（如解压软件、杀毒软件）\n2. 将文件复制到其他位置后重试\n3. 检查文件是否损坏\n4. 尝试使用不同的浏览器')
      } else {
        setError(errorMessage)
      }
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
    <div className="w-full max-w-3xl mx-auto px-8 py-12">
      <div
        className="border-2 border-dashed border-mastodon-border rounded-lg py-6 text-center hover:border-mastodon-primary transition-colors cursor-pointer bg-mastodon-surface"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {uploading ? (
          <div className="space-y-6">
            <Loader2 className="w-20 h-20 mx-auto animate-spin text-mastodon-primary" />
            <div>
              <p className="text-xl font-medium text-white mb-3">
                {progress?.stage || 'Processing...'}
              </p>
              {progress && progress.total > 0 && (
                <div className="mt-4 space-y-3 max-w-md mx-auto">
                  <p className="text-sm text-mastodon-text-secondary">
                    {progress.progress} / {progress.total}
                  </p>
                  <div className="w-full bg-mastodon-bg rounded-full h-3">
                    <div
                      className="bg-mastodon-primary h-3 rounded-full transition-all duration-300"
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
          <div className="space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-mastodon-error/20 flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <div>
              <p className="text-xl font-semibold text-mastodon-error mb-2">
                Upload Failed
              </p>
              <div className="text-sm text-mastodon-text-secondary mt-3 max-w-md mx-auto whitespace-pre-line text-left">
                {error}
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="px-8 py-4 bg-mastodon-primary text-white rounded-lg hover:bg-mastodon-primary-hover transition-colors font-medium text-base"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <FileArchive className="w-20 h-20 mx-auto text-mastodon-text-secondary" />
            <div>
              <p className="text-2xl font-semibold text-white mb-3">
                Drag & Drop Mastodon Archive
              </p>
              <p className="text-base text-mastodon-text-secondary">
                or click to select file
              </p>
            </div>
            <label className="inline-flex items-center gap-3 px-8 py-4 bg-mastodon-primary text-white rounded-lg cursor-pointer hover:bg-mastodon-primary-hover transition-colors font-semibold text-base">
              <Upload className="w-5 h-5" />
              Select File
              <input
                type="file"
                accept=".zip,application/zip,.tar.gz,application/gzip,application/x-gzip,.tgz"
                className="hidden"
                onChange={handleChange}
              />
            </label>
            <p className="text-sm text-mastodon-text-secondary mt-6">
              Supports .zip and .tar.gz archives exported from Mastodon
            </p>
          </div>
        )}
      </div>

      {!uploading && !error && (
        <div className="mt-8 p-6 bg-mastodon-surface border border-mastodon-border rounded-lg">
          <h3 className="text-base font-semibold text-mastodon-primary mb-4">
            How to get your archive?
          </h3>
          <ol className="text-sm text-mastodon-text-secondary space-y-2 list-decimal list-inside">
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
