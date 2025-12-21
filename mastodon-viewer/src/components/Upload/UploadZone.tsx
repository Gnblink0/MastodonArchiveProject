import { useCallback, useState, useEffect } from 'react'
import { Upload, FileArchive, Loader2, Cloud, ArrowRight } from 'lucide-react'
import { ArchiveParser } from '../../lib/parser'
import type { ParseProgress } from '../../types'

interface UploadZoneProps {
  onUploadComplete: () => void
  googleUser?: any
  googleLogin?: () => void
  googleAccessToken?: string | null
}

export function UploadZone({ onUploadComplete, googleUser, googleLogin, googleAccessToken }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [driveLoading, setDriveLoading] = useState(false)
  const [progress, setProgress] = useState<ParseProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [driveStatus, setDriveStatus] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState(-1)
  const [mode, setMode] = useState<'local' | 'drive'>('local')
  const [driveFiles, setDriveFiles] = useState<any[]>([])
  const [hasCheckedFiles, setHasCheckedFiles] = useState(false)

  // Search for existing files in Drive
  const searchDriveFiles = useCallback(async () => {
    if (!googleAccessToken || hasCheckedFiles) return

    try {
      const query = "name contains 'archive' and trashed = false"
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,createdTime,mimeType)`

      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      })

      if (!searchRes.ok) return

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

      setDriveFiles(files)
      setHasCheckedFiles(true)
    } catch (err) {
      console.error('Error searching Drive files:', err)
      setHasCheckedFiles(true)
    }
  }, [googleAccessToken, hasCheckedFiles])

  // Check for files when user logs in
  useEffect(() => {
    if (googleAccessToken && mode === 'drive' && !hasCheckedFiles) {
      searchDriveFiles()
    }
  }, [googleAccessToken, mode, hasCheckedFiles, searchDriveFiles])

  const handleDriveImport = async () => {
    if (!googleAccessToken) {
      googleLogin?.()
      return
    }

    setDriveLoading(true)
    setDriveStatus('Downloading from Drive...')
    setUploadProgress(-1)
    setError(null)

    try {
      // Use cached files if available, otherwise search
      let files = driveFiles

      if (files.length === 0) {
        setDriveStatus('Searching for archives in Drive...')
        const query = "name contains 'archive' and trashed = false"
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,createdTime,mimeType)`

        const searchRes = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${googleAccessToken}` }
        })

        if (!searchRes.ok) throw new Error('Failed to search Drive')

        const data = await searchRes.json()
        files = data.files || []

        // Filter in client-side for extensions
        files = files.filter((f: any) =>
           f.name.endsWith('.tar.gz') ||
           f.name.endsWith('.tgz') ||
           f.name.endsWith('.zip')
        )

        if (files.length === 0) {
          throw new Error('No Mastodon archive (.tar.gz/.zip) found in your Drive.\nPlease upload your archive file first.')
        }

        // Sort by createdTime desc (newest first)
        files.sort((a: any, b: any) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
      }

      const latestFile = files[0]
      const totalBytes = parseInt(latestFile.size, 10) || 0
      setDriveStatus(`Downloading ${latestFile.name}...`)

      // 2. Download the file with chunked approach for mobile compatibility
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media`

      setUploadProgress(0) // Start progress bar at 0%

      // Use chunked download for better mobile compatibility
      const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks for mobile
      const chunks: Uint8Array[] = []
      let downloadedBytes = 0

      const blob = await new Promise<Blob>(async (resolve, reject) => {
         try {
            // For small files (< 10MB), use single request
            if (totalBytes > 0 && totalBytes < 10 * 1024 * 1024) {
               const xhr = new XMLHttpRequest()
               xhr.open('GET', downloadUrl)
               xhr.setRequestHeader('Authorization', `Bearer ${googleAccessToken}`)
               xhr.responseType = 'blob'
               xhr.timeout = 300000 // 5 minutes for small files

               xhr.onprogress = (event) => {
                  if (event.lengthComputable) {
                     const percentComplete = (event.loaded / event.total) * 100
                     setUploadProgress(Math.min(percentComplete, 99))
                     setDriveStatus(`Downloading... ${Math.round(percentComplete)}%`)
                  }
               }

               xhr.onload = () => {
                  if (xhr.status === 200) {
                     setUploadProgress(100)
                     resolve(xhr.response)
                  } else {
                     reject(new Error(`Download failed with status: ${xhr.status}`))
                  }
               }

               xhr.onerror = () => reject(new Error('Network error during download'))
               xhr.ontimeout = () => reject(new Error('Download timed out'))
               xhr.send()
               return
            }

            // For larger files, use chunked download
            while (downloadedBytes < totalBytes) {
               const start = downloadedBytes
               const end = Math.min(start + CHUNK_SIZE - 1, totalBytes - 1)

               const chunkBlob = await new Promise<Blob>((resolveChunk, rejectChunk) => {
                  const xhr = new XMLHttpRequest()
                  xhr.open('GET', downloadUrl)
                  xhr.setRequestHeader('Authorization', `Bearer ${googleAccessToken}`)
                  xhr.setRequestHeader('Range', `bytes=${start}-${end}`)
                  xhr.responseType = 'blob'
                  xhr.timeout = 120000 // 2 minutes per chunk

                  xhr.onload = () => {
                     if (xhr.status === 206 || xhr.status === 200) {
                        resolveChunk(xhr.response)
                     } else {
                        rejectChunk(new Error(`Chunk download failed: ${xhr.status}`))
                     }
                  }

                  xhr.onerror = () => rejectChunk(new Error('Network error'))
                  xhr.ontimeout = () => rejectChunk(new Error('Chunk timed out'))
                  xhr.send()
               })

               // Convert blob chunk to Uint8Array and store
               const arrayBuffer = await chunkBlob.arrayBuffer()
               chunks.push(new Uint8Array(arrayBuffer))

               downloadedBytes += chunkBlob.size

               // Update progress
               const percentComplete = (downloadedBytes / totalBytes) * 100
               setUploadProgress(Math.min(percentComplete, 99))
               setDriveStatus(`Downloading... ${Math.round(percentComplete)}%`)
            }

            // Combine all chunks into a single blob
            setDriveStatus('Combining chunks...')
            const combinedBlob = new Blob(chunks)
            setUploadProgress(100)
            resolve(combinedBlob)

         } catch (error) {
            reject(error)
         }
      })

      // Convert to File object
      const file = new File([blob], latestFile.name, { type: 'application/gzip' })

      // 3. Parse
      setDriveStatus('Processing archive...')
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

  const renderCentralContent = () => {
    if (uploading) {
        return (
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
                Upload Failed
              </p>
              <div className="text-sm text-mastodon-text-secondary mt-3 max-w-md mx-auto whitespace-pre-line text-left">
                {error}
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="px-8 py-4 bg-mastodon-primary text-white rounded-lg hover:bg-mastodon-primary-hover transition-colors font-medium text-base cursor-pointer"
            >
              Retry
            </button>
          </div>
        )
    }

    if (mode === 'local') {
        return (
          <div className="space-y-6"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
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
        )
    } 
    
    // Drive Mode
    return (
        <div className="space-y-8 py-4">
             <div className="text-center mb-8">
                 <Cloud className="w-16 h-16 mx-auto text-[#34a853] mb-4" />
                 <h2 className="text-2xl font-bold text-white mb-2">Sync with Google Drive</h2>
                 <p className="text-mastodon-text-secondary max-w-md mx-auto">
                    Upload your archive to your personal Drive to access it from any device, anywhere.
                 </p>
             </div>

             <div className="max-w-xs mx-auto space-y-4">
              {!googleUser ? (
                 <button
                    onClick={() => googleLogin?.()}
                    className="w-full py-4 bg-[#34a853] hover:bg-[#34a853]/90 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium text-lg shadow-lg shadow-[#34a853]/20 cursor-pointer"
                 >
                    <Cloud className="w-5 h-5" />
                    <span>Login with Google</span>
                 </button>
              ) : driveLoading ? (
                 <div className="w-full bg-mastodon-surface border border-mastodon-border rounded-lg p-6 flex flex-col items-center justify-center space-y-4">
                    {uploadProgress >= 0 && uploadProgress < 100 ? (
                       <div className="w-full space-y-2">
                          <div className="flex justify-between text-xs text-mastodon-text-secondary">
                             <span>{driveStatus.startsWith('Downloading') ? 'Downloading...' : 'Uploading...'}</span>
                             <span>{Math.round(uploadProgress)}%</span>
                          </div>
                          <div className="w-full bg-mastodon-bg rounded-full h-2 overflow-hidden">
                             <div 
                                className="bg-[#34a853] h-full transition-all duration-300 ease-out"
                                style={{ width: `${uploadProgress}%` }}
                             />
                          </div>
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
                 <div className="space-y-4">
                    <p className="text-mastodon-text-secondary text-center text-sm mb-2">
                       No archive found in your Drive. Please upload your Mastodon archive.
                    </p>
                    <label className="w-full py-4 bg-[#34a853] hover:bg-[#34a853]/90 text-white rounded-lg transition-colors flex items-center justify-center gap-3 font-medium cursor-pointer shadow-lg shadow-[#34a853]/20">
                       <Upload className="w-5 h-5" />
                       <span className="text-lg">Upload Archive</span>
                       <input
                          type="file"
                          accept=".tar.gz,.tgz,.zip"
                          className="hidden"
                          onChange={(e) => {
                             const file = e.target.files?.[0]
                             if (!file) return

                             setDriveLoading(true)
                             setDriveStatus('Starting upload...')
                             setUploadProgress(0)

                             const metadata = {
                                name: file.name,
                                mimeType: file.type || 'application/x-gzip'
                             }

                             const form = new FormData()
                             form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
                             form.append('file', file)

                             const xhr = new XMLHttpRequest()
                             xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart')
                             xhr.setRequestHeader('Authorization', `Bearer ${googleAccessToken}`)

                             xhr.upload.onprogress = (event) => {
                                if (event.lengthComputable) {
                                   const percentComplete = (event.loaded / event.total) * 100
                                   setUploadProgress(percentComplete)
                                   setDriveStatus(`Uploading... ${Math.round(percentComplete)}%`)
                                }
                             }

                             xhr.onload = async () => {
                                if (xhr.status === 200) {
                                   setDriveStatus('Upload complete! Processing...')
                                   setUploadProgress(-1)
                                   try {
                                      // Refresh file list
                                      setHasCheckedFiles(false)
                                      await handleFile(file)
                                   } catch (err) {
                                      console.error(err)
                                      setError('Failed to process file')
                                   }
                                } else {
                                   setError('Upload failed')
                                   console.error('Upload failed:', xhr.response)
                                }
                                setDriveLoading(false)
                                setUploadProgress(-1)
                             }

                             xhr.onerror = () => {
                                setError('Upload failed')
                                setDriveLoading(false)
                                setUploadProgress(-1)
                             }

                             xhr.send(form)
                          }}
                       />
                    </label>

                    {googleUser && (
                        <div className="text-center pt-2">
                            <p className="text-xs text-mastodon-text-secondary">
                                Logged in as <span className="text-white">{googleUser.name}</span>
                            </p>
                        </div>
                    )}
                 </div>
              ) : (
                 // Files found - show file info and both upload/download options
                 <div className="space-y-4">
                    <div className="bg-mastodon-surface border border-mastodon-border rounded-lg p-4 mb-2">
                       <p className="text-xs text-mastodon-text-secondary mb-1">Archive in Drive:</p>
                       <p className="text-sm text-white font-medium truncate">{driveFiles[0].name}</p>
                       {driveFiles.length > 1 && (
                          <p className="text-xs text-mastodon-text-secondary mt-1">
                             +{driveFiles.length - 1} more archive{driveFiles.length > 2 ? 's' : ''}
                          </p>
                       )}
                    </div>

                    <label className="w-full py-4 bg-[#34a853] hover:bg-[#34a853]/90 text-white rounded-lg transition-colors flex items-center justify-center gap-3 font-medium cursor-pointer shadow-lg shadow-[#34a853]/20">
                       <Upload className="w-5 h-5" />
                       <span className="text-lg">Upload New Archive</span>
                       <input
                          type="file"
                          accept=".tar.gz,.tgz,.zip"
                          className="hidden"
                          onChange={(e) => {
                             const file = e.target.files?.[0]
                             if (!file) return

                             setDriveLoading(true)
                             setDriveStatus('Starting upload...')
                             setUploadProgress(0)

                             const metadata = {
                                name: file.name,
                                mimeType: file.type || 'application/x-gzip'
                             }

                             const form = new FormData()
                             form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
                             form.append('file', file)

                             const xhr = new XMLHttpRequest()
                             xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart')
                             xhr.setRequestHeader('Authorization', `Bearer ${googleAccessToken}`)

                             xhr.upload.onprogress = (event) => {
                                if (event.lengthComputable) {
                                   const percentComplete = (event.loaded / event.total) * 100
                                   setUploadProgress(percentComplete)
                                   setDriveStatus(`Uploading... ${Math.round(percentComplete)}%`)
                                }
                             }

                             xhr.onload = async () => {
                                if (xhr.status === 200) {
                                   setDriveStatus('Upload complete! Processing...')
                                   setUploadProgress(-1)
                                   try {
                                      // Refresh file list
                                      setHasCheckedFiles(false)
                                      await handleFile(file)
                                   } catch (err) {
                                      console.error(err)
                                      setError('Failed to process file')
                                   }
                                } else {
                                   setError('Upload failed')
                                   console.error('Upload failed:', xhr.response)
                                }
                                setDriveLoading(false)
                                setUploadProgress(-1)
                             }

                             xhr.onerror = () => {
                                setError('Upload failed')
                                setDriveLoading(false)
                                setUploadProgress(-1)
                             }

                             xhr.send(form)
                          }}
                       />
                    </label>

                    <button
                       onClick={handleDriveImport}
                       className="w-full py-4 bg-mastodon-surface border-2 border-[#34a853]/30 hover:border-[#34a853] text-[#34a853] rounded-lg transition-all flex items-center justify-center gap-3 font-medium cursor-pointer"
                    >
                       <ArrowRight className="w-5 h-5" />
                       <span className="text-lg">Download from Cloud</span>
                    </button>

                    {googleUser && (
                        <div className="text-center pt-2">
                            <p className="text-xs text-mastodon-text-secondary">
                                Logged in as <span className="text-white">{googleUser.name}</span>
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
    <div className="w-full max-w-4xl mx-auto px-6 py-12">
      <div
        className={`border-2 border-dashed ${mode === 'local' ? 'border-mastodon-border hover:border-mastodon-primary cursor-pointer' : 'border-mastodon-border/50'} rounded-lg py-12 text-center bg-mastodon-surface transition-all duration-300 min-h-[400px] flex items-center justify-center`}
        onDrop={mode === 'local' ? handleDrop : undefined}
        onDragOver={mode === 'local' ? handleDragOver : undefined}
      >
        {renderCentralContent()}
      </div>

      {!uploading && !error && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Left Card */}
           <div className="p-6 bg-mastodon-surface border border-mastodon-border rounded-lg group hover:border-mastodon-border/80 transition-colors">
              {mode === 'local' ? (
                  <>
                    <h3 className="text-base font-semibold text-mastodon-primary mb-4 flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        <span>How to get your archive?</span>
                    </h3>
                    <ol className="text-sm text-mastodon-text-secondary space-y-2 list-decimal list-inside">
                        <li>Log in to your Mastodon account</li>
                        <li>Go to Settings → Import and Export</li>
                        <li>Request Archive & wait for email</li>
                        <li>Download .tar.gz file</li>
                    </ol>
                  </>
              ) : (
                  <>
                    <h3 className="text-base font-semibold text-[#34a853] mb-4 flex items-center gap-2">
                        <Cloud className="w-4 h-4" />
                        <span>How does sync work?</span>
                    </h3>
                    <div className="text-sm text-mastodon-text-secondary space-y-3">
                        <p>
                            <strong className="text-white">Archive Sync:</strong> Log in to Google and enable Google Drive. Your Mastodon archive will be stored in your own Google Drive for remote sync. This website does not store or access any of your Mastodon data.
                        </p>
                        <p>
                            <strong className="text-white">Local Parsing:</strong> Each archive is parsed locally in your browser but will be persistently saved and won't disappear on refresh.
                        </p>
                    </div>
                  </>
              )}
           </div>

           {/* Right Card / Toggle */}
           <div 
                className="p-6 bg-mastodon-surface border border-mastodon-border rounded-lg cursor-pointer hover:border-[#34a853] transition-all group relative overflow-hidden"
                onClick={() => setMode(mode === 'local' ? 'drive' : 'local')}
           >
              {mode === 'local' ? (
                 <>
                    <div className="relative z-10">
                        <h3 className="text-base font-semibold text-[#34a853] mb-2 flex items-center gap-2">
                            <Cloud className="w-4 h-4" />
                            <span>Sync with Google Drive</span>
                        </h3>
                        <p className="text-sm text-mastodon-text-secondary mb-4">
                            Upload archive to Drive to access from other devices.
                        </p>
                        <div className="flex items-center text-[#34a853] text-sm font-medium group-hover:gap-2 transition-all">
                            <span>Switch to Sync Mode</span>
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
                            <span>Local Upload</span>
                        </h3>
                        <p className="text-sm text-mastodon-text-secondary mb-4">
                            Upload directly from your computer without syncing.
                        </p>
                        <div className="flex items-center text-mastodon-primary text-sm font-medium group-hover:gap-2 transition-all">
                            <span>Switch to Local Mode</span>
                            <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                    </div>
                    <Upload className="absolute -bottom-4 -right-4 w-24 h-24 text-mastodon-primary/5 group-hover:text-mastodon-primary/10 transition-colors transform -rotate-12" />
                 </>
              )}
           </div>
        </div>
      )}
    </div>
  )

}
