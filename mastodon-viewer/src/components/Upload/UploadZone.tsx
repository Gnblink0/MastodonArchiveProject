import { useCallback, useState, useEffect } from 'react'
import { Upload, FileArchive, Loader2, Cloud, ArrowRight, Eye, X, ChevronRight, Download } from 'lucide-react'
import step1Img from '../../assets/step1.png'
import step2Img from '../../assets/step2.png'
import { ArchiveParser } from '../../lib/parser'
import { ImportStrategyDialog } from './ImportStrategyDialog'
import { loadSampleData } from '../../lib/sampleData'
import { useTranslation } from 'react-i18next'
import type { ParseProgress, ImportStrategy, AccountConflict } from '../../types'

interface UploadZoneProps {
  onUploadComplete: () => void
  googleUser?: any
  googleLogin?: () => void
  googleAccessToken?: string | null
}

export function UploadZone({ onUploadComplete, googleUser, googleLogin, googleAccessToken }: UploadZoneProps) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const [driveLoading, setDriveLoading] = useState(false)
  const [loadingSample, setLoadingSample] = useState(false)
  const [progress, setProgress] = useState<ParseProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [driveStatus, setDriveStatus] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState(-1)
  const [mode, setMode] = useState<'local' | 'drive'>('local')
  const [driveFiles, setDriveFiles] = useState<any[]>([])
  const [hasCheckedFiles, setHasCheckedFiles] = useState(false)
  const [showSlowDownloadTip, setShowSlowDownloadTip] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  // Import strategy dialog state
  const [showStrategyDialog, setShowStrategyDialog] = useState(false)
  const [currentConflict, setCurrentConflict] = useState<AccountConflict | null>(null)
  const [strategyResolver, setStrategyResolver] = useState<((strategy: ImportStrategy) => void) | null>(null)

  // Core fetch: return all archive files in Drive (newest first)
  const fetchDriveFiles = useCallback(async (): Promise<any[]> => {
    if (!googleAccessToken) return []

    const query = "name contains 'archive' and trashed = false"
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,createdTime,mimeType)`

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${googleAccessToken}` }
    })

    if (!searchRes.ok) throw new Error('Failed to search Drive')

    const data = await searchRes.json()
    let files = data.files || []

    // Filter for archive extensions
    files = files.filter((f: any) =>
       f.name.endsWith('.tar.gz') ||
       f.name.endsWith('.tgz') ||
       f.name.endsWith('.zip')
    )

    // Sort by createdTime desc (newest first)
    files.sort((a: any, b: any) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())

    return files
  }, [googleAccessToken])

  // Search for existing files in Drive (initial check, gated by hasCheckedFiles)
  const searchDriveFiles = useCallback(async () => {
    if (!googleAccessToken || hasCheckedFiles) return

    try {
      const files = await fetchDriveFiles()
      setDriveFiles(files)
      setHasCheckedFiles(true)
    } catch (err) {
      console.error('Error searching Drive files:', err)
      setHasCheckedFiles(true)
    }
  }, [googleAccessToken, hasCheckedFiles, fetchDriveFiles])

  // Check for files when user logs in
  useEffect(() => {
    if (googleAccessToken && mode === 'drive' && !hasCheckedFiles) {
      searchDriveFiles()
    }
  }, [googleAccessToken, mode, hasCheckedFiles, searchDriveFiles])

  // Download a single Drive file (streaming, with progress) and return it as a File
  const downloadDriveFileAsFile = async (driveFile: any): Promise<File> => {
      const totalBytes = parseInt(driveFile.size, 10) || 0
      setDriveStatus(`${t('upload.processing')} ${driveFile.name}...`)

      // Download the file using Fetch API with streaming for better mobile compatibility
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media`

      setUploadProgress(0) // Start progress bar at 0%

      const blob = await new Promise<Blob>(async (resolve, reject) => {
         try {
            // Create abort controller for fetch timeout
            const controller = new AbortController()

            const response = await fetch(downloadUrl, {
               headers: {
                  'Authorization': `Bearer ${googleAccessToken}`
               },
               signal: controller.signal,
               // Enable caching and keep-alive for better performance
               cache: 'default',
               keepalive: true
            })

            if (!response.ok) {
               throw new Error(`Download failed with status: ${response.status}`)
            }

            // Get response body reader for streaming
            const reader = response.body?.getReader()
            if (!reader) {
               throw new Error('Unable to read response body')
            }

            // Get total size from content-length or use metadata
            const contentLength = response.headers.get('content-length')
            const total = contentLength ? parseInt(contentLength, 10) : totalBytes

            let receivedBytes = 0
            const chunks: Uint8Array[] = []
            let lastProgressTime = Date.now()
            const startTime = Date.now()
            let lastSpeedUpdateTime = startTime
            let lastSpeedUpdateBytes = 0

            // Helper function to format bytes
            const formatBytes = (bytes: number) => {
               if (bytes < 1024) return `${bytes} B`
               if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
               return `${(bytes / 1024 / 1024).toFixed(1)} MB`
            }

            // Helper function to format time
            const formatTime = (seconds: number) => {
               if (seconds < 60) return `${Math.round(seconds)}s`
               const minutes = Math.floor(seconds / 60)
               const secs = Math.round(seconds % 60)
               return `${minutes}m ${secs}s`
            }

            // Read stream in chunks with stall detection
            while (true) {
               // Check for stall (no progress for 2 minutes)
               const now = Date.now()
               if (now - lastProgressTime > 120000) {
                  controller.abort()
                  throw new Error('Download stalled for 2 minutes. Please check your connection and try again.')
               }

               const { done, value } = await reader.read()

               if (done) break

               chunks.push(value)
               receivedBytes += value.length
               lastProgressTime = Date.now()

               // Calculate speed and ETA (update every 500ms to avoid too frequent updates)
               if (now - lastSpeedUpdateTime > 500) {
                  const timeDiff = (now - lastSpeedUpdateTime) / 1000 // seconds
                  const bytesDiff = receivedBytes - lastSpeedUpdateBytes
                  const speed = bytesDiff / timeDiff // bytes per second

                  lastSpeedUpdateTime = now
                  lastSpeedUpdateBytes = receivedBytes

                  // Show tip if download is slow (< 50 KB/s) and has been downloading for more than 10 seconds
                  const elapsedTime = (now - startTime) / 1000
                  if (speed < 50 * 1024 && elapsedTime > 10) {
                     setShowSlowDownloadTip(true)
                  }

                  // Update progress with speed and ETA
                  if (total > 0) {
                     const percentComplete = (receivedBytes / total) * 100
                     const remainingBytes = total - receivedBytes
                     const eta = speed > 0 ? remainingBytes / speed : 0

                     setUploadProgress(Math.min(percentComplete, 99))
                     setDriveStatus(
                        `${Math.round(percentComplete)}% • ${formatBytes(speed)}/s • ${formatTime(eta)} ${t('upload.remaining')}`
                     )
                  } else {
                     // If no total size, show MB downloaded and speed
                     setDriveStatus(
                        `${formatBytes(receivedBytes)} • ${formatBytes(speed)}/s`
                     )
                  }
               }
            }

            // Combine all chunks into a single blob
            setDriveStatus(t('upload.processing'))
            const combinedBlob = new Blob(chunks as BlobPart[])
            setUploadProgress(100)
            resolve(combinedBlob)

         } catch (error) {
            reject(error)
         }
      })

      // Convert to File object
      return new File([blob], driveFile.name, { type: 'application/gzip' })
  }

  // Download a single Drive file and import it (used by per-file download buttons)
  const processDriveFile = async (driveFile: any) => {
    if (!googleAccessToken) {
      googleLogin?.()
      return
    }

    setDriveLoading(true)
    setDriveStatus(t('upload.downloading_from_drive'))
    setUploadProgress(-1)
    setError(null)
    setShowSlowDownloadTip(false)

    try {
      const file = await downloadDriveFileAsFile(driveFile)

      setDriveStatus(t('upload.processing'))
      setUploadProgress(-1) // Hide progress bar
      await handleFile(file)
    } catch (err) {
      console.error('Drive Import Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown Drive error')
    } finally {
      setDriveLoading(false)
      setDriveStatus('')
      setUploadProgress(-1)
    }
  }

  // Download all archives in Drive and import them sequentially
  const handleDownloadAll = async () => {
    if (!googleAccessToken) {
      googleLogin?.()
      return
    }

    let files = driveFiles
    setDriveLoading(true)
    setDriveStatus(t('upload.downloading_from_drive'))
    setUploadProgress(-1)
    setError(null)
    setShowSlowDownloadTip(false)

    try {
      if (files.length === 0) {
        setDriveStatus(t('upload.searching_archives'))
        files = await fetchDriveFiles()
        setDriveFiles(files)
      }

      if (files.length === 0) {
        throw new Error(t('upload.no_archive_in_drive'))
      }

      for (let i = 0; i < files.length; i++) {
        setDriveStatus(t('upload.restoring_progress', { current: i + 1, total: files.length }))
        const file = await downloadDriveFileAsFile(files[i])
        await handleFile(file)
      }
    } catch (err) {
      console.error('Drive Import Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown Drive error')
    } finally {
      setDriveLoading(false)
      setDriveStatus('')
      setUploadProgress(-1)
    }
  }

  // Handle account conflict callback
  const handleAccountConflict = useCallback((conflict: AccountConflict): Promise<ImportStrategy> => {
    return new Promise((resolve) => {
      setCurrentConflict(conflict)
      setShowStrategyDialog(true)
      setStrategyResolver(() => resolve)
    })
  }, [])

  // Handle strategy selection
  const handleStrategySelect = useCallback((strategy: ImportStrategy) => {
    setShowStrategyDialog(false)
    if (strategyResolver) {
      strategyResolver(strategy)
      setStrategyResolver(null)
    }
    setCurrentConflict(null)
  }, [strategyResolver])

  const handleFile = useCallback(async (file: File) => {
    const fileName = file.name.toLowerCase()
    const isValidFormat = fileName.endsWith('.zip') || fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz')

    if (!isValidFormat) {
      setError(t('upload.invalid_format'))
      return
    }

    // 检查文件大小
    if (file.size === 0) {
      setError(t('upload.empty_file'))
      return
    }

    // 检查文件是否可读
    try {
      // 尝试读取文件的前几个字节来验证文件可访问性
      const testChunk = file.slice(0, 4)
      await testChunk.arrayBuffer()
    } catch (err) {
      console.error('文件访问测试失败:', err)
      setError(t('upload.cannot_read'))
      return
    }

    setUploading(true)
    setError(null)
    setProgress(null)

    try {
      const parser = new ArchiveParser(setProgress, handleAccountConflict)
      await parser.parseArchive(file)

      // 解析完成
      onUploadComplete()
    } catch (err) {
      console.error('解析失败:', err)
      const errorMessage = err instanceof Error ? err.message : t('upload.parse_failed')

      // 检查是否是文件读取权限错误
      if (errorMessage.includes('permission') || errorMessage.includes('could not be read')) {
        setError(t('upload.permission_error'))
      } else {
        setError(errorMessage)
      }
    } finally {
      setUploading(false)
    }
  }, [onUploadComplete, handleAccountConflict, t])

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

  // Build a stable, filesystem-safe Drive file name per account, so each account
  // keeps a single file in Drive that gets overwritten on re-upload.
  const getArchiveExt = (name: string) => {
    const n = name.toLowerCase()
    if (n.endsWith('.tar.gz')) return '.tar.gz'
    if (n.endsWith('.tgz')) return '.tgz'
    return '.zip'
  }

  const buildDriveName = (accountId: string, originalName: string) => {
    const safeId = accountId
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    return `archive-${safeId}${getArchiveExt(originalName)}`
  }

  // Upload a file to Drive using a per-account stable name: overwrite the existing
  // file's content if one already exists, otherwise create a new file.
  const uploadFileToDrive = async (file: File, accountId: string) => {
    if (!googleAccessToken) throw new Error('Not authenticated')

    const driveName = buildDriveName(accountId, file.name)

    // Look for an existing file with the same stable name
    const files = await fetchDriveFiles()
    const existing = files.find((f: any) => f.name === driveName)

    const onProgress = (event: ProgressEvent) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100
        setUploadProgress(percentComplete)
        setDriveStatus(`${t('upload.uploading')} ${Math.round(percentComplete)}%`)
      }
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      if (existing) {
        // Update the content of the existing file (keeps same id/name)
        xhr.open('PATCH', `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`)
        xhr.setRequestHeader('Authorization', `Bearer ${googleAccessToken}`)
        xhr.setRequestHeader('Content-Type', file.type || 'application/gzip')
        xhr.upload.onprogress = onProgress
        xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error('Update failed')))
        xhr.onerror = () => reject(new Error('Update failed'))
        xhr.send(file)
      } else {
        // Create a new file
        const metadata = { name: driveName, mimeType: file.type || 'application/x-gzip' }
        const form = new FormData()
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
        form.append('file', file)
        xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart')
        xhr.setRequestHeader('Authorization', `Bearer ${googleAccessToken}`)
        xhr.upload.onprogress = onProgress
        xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error('Upload failed')))
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.send(form)
      }
    })
  }

  // Parse+import a picked file locally, then upload it to Drive under a per-account
  // stable name (overwriting the previous version for that account).
  const handleDriveUpload = async (file: File) => {
    if (!googleAccessToken) {
      googleLogin?.()
      return
    }

    const fileName = file.name.toLowerCase()
    const isValidFormat = fileName.endsWith('.zip') || fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz')
    if (!isValidFormat) {
      setError(t('upload.invalid_format'))
      return
    }

    setDriveLoading(true)
    setError(null)
    setUploadProgress(-1)

    try {
      // 1. Parse + import locally to obtain the accountId
      setDriveStatus(t('upload.processing'))
      const parser = new ArchiveParser(setProgress, handleAccountConflict)
      const metadata = await parser.parseArchive(file)
      onUploadComplete()

      // 2. Upload to Drive under a stable per-account name (overwrite if exists)
      setUploadProgress(0)
      setDriveStatus(t('upload.uploading'))
      await uploadFileToDrive(file, metadata.accountId)

      // 3. Refresh the Drive file list
      const refreshed = await fetchDriveFiles()
      setDriveFiles(refreshed)
      setHasCheckedFiles(true)
    } catch (err) {
      console.error('Drive Upload Error:', err)
      setError(err instanceof Error ? err.message : t('upload.upload_failed'))
    } finally {
      setDriveLoading(false)
      setDriveStatus('')
      setUploadProgress(-1)
    }
  }

  const handleLoadSample = useCallback(async () => {
    setLoadingSample(true)
    setError(null)

    try {
      await loadSampleData()
      onUploadComplete()
    } catch (err) {
      console.error('Failed to load sample data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load sample data')
    } finally {
      setLoadingSample(false)
    }
  }, [onUploadComplete])

  const renderCentralContent = () => {
    if (uploading || loadingSample) {
        return (
          <div className="space-y-6">
            <Loader2 className="w-20 h-20 mx-auto animate-spin text-mastodon-primary" />
            <div>
              <p className="text-xl font-medium text-white mb-3">
                {loadingSample ? t('upload.loading_sample') : (progress?.stage || t('upload.processing'))}
              </p>
              {!loadingSample && progress && progress.total > 0 && (
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
        )
    }

    if (error) {
        return (
          <div className="space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-mastodon-error/20 flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <div>
              <p className="text-xl font-semibold text-mastodon-error mb-2">
                {t('upload.upload_failed')}
              </p>
              <div className="text-sm text-mastodon-text-secondary mt-3 max-w-md mx-auto whitespace-pre-line text-left">
                {error}
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="px-8 py-4 bg-mastodon-primary text-white rounded-lg hover:bg-mastodon-primary-hover transition-colors font-medium text-base cursor-pointer"
            >
              {t('upload.retry')}
            </button>
          </div>
        )
    }

    if (mode === 'local') {
        return (
          <div className="space-y-5 px-4"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <FileArchive className="w-12 h-12 mx-auto text-mastodon-text-secondary/60" />
            <div>
              <p className="text-lg font-medium text-white/90 mb-1">
                {t('upload.drag_drop')}
              </p>
              <p className="text-sm text-mastodon-text-secondary">
                {t('upload.or_click')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <label className="inline-flex items-center gap-2.5 px-6 py-3 bg-mastodon-primary text-white rounded-xl cursor-pointer hover:bg-mastodon-primary-hover transition-colors font-semibold text-sm">
                <Upload className="w-4 h-4" />
                {t('upload.select_file')}
                <input
                  type="file"
                  accept=".zip,application/zip,.tar.gz,application/gzip,application/x-gzip,.tgz"
                  className="hidden"
                  onChange={handleChange}
                />
              </label>
              <button
                onClick={handleLoadSample}
                className="inline-flex items-center gap-2.5 px-6 py-3 border border-white/10 text-mastodon-text-secondary rounded-xl cursor-pointer hover:border-mastodon-primary hover:text-mastodon-primary transition-all font-medium text-sm"
              >
                <Eye className="w-4 h-4" />
                {t('upload.preview_sample')}
              </button>
            </div>
            <p className="text-xs text-mastodon-text-secondary/50">
              {t('upload.supports')}
            </p>
          </div>
        )
    } 
    
    // Drive Mode
    return (
        <div className="space-y-5 px-4">
             <div className="text-center">
                 <Cloud className="w-12 h-12 mx-auto text-[#34a853]/60 mb-3" />
                 <h2 className="text-lg font-medium text-white/90 mb-1">{t('upload.sync_drive')}</h2>
                 <p className="text-sm text-mastodon-text-secondary max-w-md mx-auto">
                    {t('upload.sync_desc')}
                 </p>
             </div>

             <div className="max-w-xs mx-auto space-y-3">
              {!googleUser ? (
                 <button
                    onClick={() => googleLogin?.()}
                    className="w-full py-3 bg-[#34a853] hover:bg-[#34a853]/90 text-white rounded-xl transition-colors flex items-center justify-center gap-2 font-semibold text-sm cursor-pointer"
                 >
                    <Cloud className="w-4 h-4" />
                    <span>{t('nav.login')}</span>
                 </button>
              ) : driveLoading ? (
                 <div className="w-full border border-white/[0.08] rounded-xl p-5 flex flex-col items-center justify-center space-y-3 bg-white/[0.02]">
                    {uploadProgress >= 0 && uploadProgress < 100 ? (
                       <div className="w-full space-y-3">
                          <div className="text-xs text-mastodon-text-secondary text-center">
                             <div>{driveStatus}</div>
                          </div>
                          <div className="w-full bg-mastodon-bg rounded-full h-2 overflow-hidden">
                             <div
                                className="bg-[#34a853] h-full transition-all duration-300 ease-out"
                                style={{ width: `${uploadProgress}%` }}
                             />
                          </div>
                          {showSlowDownloadTip && (
                             <div className="text-xs text-yellow-400/80 text-center px-4 py-2 bg-yellow-400/10 rounded border border-yellow-400/20">
                                Slow connection detected. Consider using local upload or connect to WiFi for faster speed.
                             </div>
                          )}
                       </div>
                    ) : (
                       <>
                          <Loader2 className="w-8 h-8 animate-spin text-[#34a853]" />
                          <span className="text-sm text-mastodon-text-secondary">{driveStatus}</span>
                       </>
                    )}
                 </div>
              ) : driveFiles.length === 0 ? (
                 // No files found - show only upload
                 <div className="space-y-3">
                    <p className="text-mastodon-text-secondary text-center text-xs mb-1">
                       {t('upload.no_archive_in_drive')}
                    </p>
                    <label className="w-full py-3 bg-[#34a853] hover:bg-[#34a853]/90 text-white rounded-xl transition-colors flex items-center justify-center gap-2.5 font-semibold text-sm cursor-pointer">
                       <Upload className="w-4 h-4" />
                       <span>{t('upload.upload_new')}</span>
                       <input
                          type="file"
                          accept=".tar.gz,.tgz,.zip"
                          className="hidden"
                          onChange={(e) => {
                             const file = e.target.files?.[0]
                             if (file) handleDriveUpload(file)
                             e.target.value = ''
                          }}
                       />
                    </label>

                    {googleUser && (
                        <div className="text-center pt-2">
                            <p className="text-xs text-mastodon-text-secondary">
                                {t('nav.logged_in_as', { name: googleUser.name })}
                            </p>
                        </div>
                    )}
                 </div>
              ) : (
                 // Files found - show upload, download all, and a per-archive list
                 <div className="space-y-3">
                    <label className="w-full py-3 bg-[#34a853] hover:bg-[#34a853]/90 text-white rounded-xl transition-colors flex items-center justify-center gap-2.5 font-semibold text-sm cursor-pointer">
                       <Upload className="w-4 h-4" />
                       <span>{t('upload.upload_new')}</span>
                       <input
                          type="file"
                          accept=".tar.gz,.tgz,.zip"
                          className="hidden"
                          onChange={(e) => {
                             const file = e.target.files?.[0]
                             if (file) handleDriveUpload(file)
                             e.target.value = ''
                          }}
                       />
                    </label>

                    {driveFiles.length > 1 && (
                       <button
                          onClick={handleDownloadAll}
                          className="w-full py-3 bg-[#34a853]/10 hover:bg-[#34a853]/20 text-[#34a853] rounded-xl transition-all flex items-center justify-center gap-2.5 font-semibold text-sm cursor-pointer"
                       >
                          <Download className="w-4 h-4" />
                          <span>{t('upload.download_all', { count: driveFiles.length })}</span>
                       </button>
                    )}

                    <div className="border border-white/[0.08] rounded-xl divide-y divide-white/[0.06] overflow-hidden bg-white/[0.02]">
                       {driveFiles.map((f: any) => (
                          <div key={f.id} className="flex items-center gap-2 p-2.5">
                             <FileArchive className="w-4 h-4 text-mastodon-text-secondary shrink-0" />
                             <div className="min-w-0 flex-1">
                                <p className="text-xs text-white font-medium truncate">{f.name}</p>
                                {f.size && (
                                   <p className="text-[10px] text-mastodon-text-secondary">
                                      {(parseInt(f.size, 10) / 1024 / 1024).toFixed(1)} MB
                                   </p>
                                )}
                             </div>
                             <button
                                onClick={() => processDriveFile(f)}
                                title={t('upload.download_cloud')}
                                className="shrink-0 p-1.5 rounded-lg text-[#34a853] hover:bg-[#34a853]/10 transition-colors cursor-pointer"
                             >
                                <ArrowRight className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>

                    {googleUser && (
                        <div className="text-center pt-2">
                            <p className="text-xs text-mastodon-text-secondary">
                                {t('nav.logged_in_as', { name: googleUser.name })}
                            </p>
                        </div>
                    )}
                 </div>
              )}
             </div>
        </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-2">
      <div
        className={`border border-dashed ${mode === 'local' ? 'border-white/[0.08] hover:border-mastodon-primary/50 cursor-pointer' : 'border-white/[0.08]'} rounded-2xl py-8 text-center bg-white/[0.02] transition-all duration-300 flex items-center justify-center`}
        onDrop={mode === 'local' ? handleDrop : undefined}
        onDragOver={mode === 'local' ? handleDragOver : undefined}
      >
        {renderCentralContent()}
      </div>

      {!uploading && !error && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Left Card */}
           <div
              className={`p-5 border border-white/[0.06] rounded-xl group hover:border-white/10 transition-colors bg-white/[0.02] ${mode === 'local' ? 'cursor-pointer' : ''}`}
              onClick={mode === 'local' ? () => setShowGuide(true) : undefined}
           >
              {mode === 'local' ? (
                  <>
                    <h3 className="text-sm font-semibold text-mastodon-primary mb-3 flex items-center gap-2">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{t('upload.how_to_get')}</span>
                    </h3>
                    <ol className="text-xs text-mastodon-text-secondary space-y-1.5 list-decimal list-inside">
                        <li>{t('upload.step_1')}</li>
                        <li>{t('upload.step_2')}</li>
                        <li>{t('upload.step_3')}</li>
                        <li>{t('upload.step_4')}</li>
                    </ol>
                    <div className="flex items-center text-mastodon-primary text-xs font-medium mt-3 group-hover:gap-1.5 transition-all">
                        <span>{t('upload.click_to_see_guide')}</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </div>
                  </>
              ) : (
                  <>
                    <h3 className="text-sm font-semibold text-[#34a853] mb-3 flex items-center gap-2">
                        <Cloud className="w-3.5 h-3.5" />
                        <span>{t('upload.how_sync_works')}</span>
                    </h3>
                    <div className="text-xs text-mastodon-text-secondary space-y-2">
                        <p>
                            <strong className="text-white">{t('upload.sync_sync_title')}</strong> {t('upload.sync_sync_desc')}
                        </p>
                        <p>
                            <strong className="text-white">{t('upload.sync_local_title')}</strong> {t('upload.sync_local_desc')}
                        </p>
                    </div>
                  </>
              )}
           </div>

           {/* Right Card / Toggle */}
           <div
                className="p-5 border border-white/[0.06] rounded-xl cursor-pointer hover:border-[#34a853]/40 transition-all group relative overflow-hidden bg-white/[0.02]"
                onClick={() => setMode(mode === 'local' ? 'drive' : 'local')}
           >
              {mode === 'local' ? (
                 <>
                    <div className="relative z-10">
                        <h3 className="text-base font-semibold text-[#34a853] mb-2 flex items-center gap-2">
                            <Cloud className="w-4 h-4" />
                            <span>{t('upload.sync_drive')}</span>
                        </h3>
                        <p className="text-sm text-mastodon-text-secondary mb-4">
                            {t('upload.sync_desc')}
                        </p>
                        <div className="flex items-center text-[#34a853] text-sm font-medium group-hover:gap-2 transition-all">
                            <span>{t('upload.switch_sync')}</span>
                            <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                    </div>
                    {/* Background decoration */}
                    <Cloud className="absolute -bottom-4 -right-4 w-24 h-24 text-[#34a853]/5 group-hover:text-[#34a853]/10 transition-colors transform rotate-12" />
                 </>
              ) : (
                 <>
                    <div className="relative z-10">
                        <h3 className="text-base font-semibold text-mastodon-primary mb-2 flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            <span>{t('upload.local_upload')}</span>
                        </h3>
                        <p className="text-sm text-mastodon-text-secondary mb-4">
                            {t('upload.local_desc')}
                        </p>
                        <div className="flex items-center text-mastodon-primary text-sm font-medium group-hover:gap-2 transition-all">
                            <span>{t('upload.switch_local')}</span>
                            <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                    </div>
                    <Upload className="absolute -bottom-4 -right-4 w-24 h-24 text-mastodon-primary/5 group-hover:text-mastodon-primary/10 transition-colors transform -rotate-12" />
                 </>
              )}
           </div>
        </div>
      )}

      {/* Import Strategy Dialog */}
      {showStrategyDialog && currentConflict && (
        <ImportStrategyDialog
          conflict={currentConflict}
          onSelect={handleStrategySelect}
        />
      )}

      {/* Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowGuide(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative bg-mastodon-surface border border-white/10 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-mastodon-surface/95 backdrop-blur-sm border-b border-white/[0.06] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-white">{t('upload.guide_title')}</h2>
              <button
                onClick={() => setShowGuide(false)}
                className="text-mastodon-text-secondary hover:text-white transition-colors cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1 */}
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-mastodon-primary/20 text-mastodon-primary text-xs font-bold flex items-center justify-center">1</span>
                <h3 className="text-sm font-semibold text-white">{t('upload.guide_step1_title')}</h3>
              </div>
              <p className="text-xs text-mastodon-text-secondary mb-3 ml-8">{t('upload.guide_step1_desc')}</p>
              <img src={step1Img} alt="Step 1" className="w-full rounded-lg border border-white/[0.06]" />
            </div>

            {/* Step 2 */}
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-mastodon-primary/20 text-mastodon-primary text-xs font-bold flex items-center justify-center">2</span>
                <h3 className="text-sm font-semibold text-white">{t('upload.guide_step2_title')}</h3>
              </div>
              <p className="text-xs text-mastodon-text-secondary mb-3 ml-8">{t('upload.guide_step2_desc')}</p>
              <img src={step2Img} alt="Step 2" className="w-full rounded-lg border border-white/[0.06]" />
            </div>

            {/* Close button */}
            <div className="sticky bottom-0 bg-mastodon-surface/95 backdrop-blur-sm border-t border-white/[0.06] px-6 py-4 rounded-b-2xl">
              <button
                onClick={() => setShowGuide(false)}
                className="w-full py-2.5 bg-mastodon-primary text-white rounded-xl hover:bg-mastodon-primary-hover transition-colors font-medium text-sm cursor-pointer"
              >
                {t('upload.guide_close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

}
