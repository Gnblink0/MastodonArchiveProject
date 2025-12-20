import { useCallback, useState } from 'react'
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
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleDriveImport = async () => {
    if (!googleAccessToken) {
      googleLogin?.()
      return
    }

    setDriveLoading(true)
    setDriveStatus('Searching for archives in Drive...')
    setError(null)

    try {
      // 1. Search for archive files
      // Relaxed query: search by name, filter by extension in JS
      const query = "name contains 'archive' and trashed = false"
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,createdTime,mimeType)`
      
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      })
      
      if (!searchRes.ok) throw new Error('Failed to search Drive')
      
      const data = await searchRes.json()
      let files = data.files || []

      // Filter in client-side for extensions
      files = files.filter((f: any) => 
         f.name.endsWith('.tar.gz') || 
         f.name.endsWith('.tgz') || 
         f.name.endsWith('.zip')
      )
      
      if (files.length === 0) {
        throw new Error('No Mastodon archive (.tar.gz/.zip) found in your Drive.\nPlease upload your archive file to Drive first.')
      }

      // Sort by createdTime desc (newest first)
      files.sort((a: any, b: any) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
      
      const latestFile = files[0]
      setDriveStatus(`Found: ${latestFile.name}. Downloading...`)

      // 2. Download the file
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media`
      const downloadRes = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      })

      if (!downloadRes.ok) throw new Error('Failed to download file from Drive')

      const blob = await downloadRes.blob()
      // Convert to File object
      const file = new File([blob], latestFile.name, { type: 'application/gzip' })

      // 3. Parse
      setDriveStatus('Processing archive...')
      await handleFile(file)

    } catch (err) {
      console.error('Drive Import Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown Drive error')
    } finally {
      setDriveLoading(false)
      setDriveStatus('')
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
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Guide */}
           <div className="p-6 bg-mastodon-surface border border-mastodon-border rounded-lg">
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
           </div>

           {/* Cloud Import */}
           <div className="p-6 bg-mastodon-surface border border-mastodon-border rounded-lg flex flex-col">
              <div className="mb-4">
                 <h3 className="text-base font-semibold text-[#34a853] mb-2 flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    <span>Sync with Google Drive</span>
                 </h3>
                 <p className="text-sm text-mastodon-text-secondary">
                    Upload archive to Drive to access from other devices.
                 </p>
              </div>
              
              {!googleUser ? (
                 <button
                    onClick={() => googleLogin?.()}
                    className="w-full mt-auto py-3 bg-[#34a853]/10 hover:bg-[#34a853]/20 text-[#34a853] rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                 >
                    <Cloud className="w-4 h-4" />
                    <span>Login to Sync</span>
                 </button>
              ) : driveLoading ? (
                 <div className="flex flex-col items-center justify-center py-4 text-sm text-mastodon-text-secondary mt-auto w-full">
                    {uploadProgress > 0 && uploadProgress < 100 ? (
                       <div className="w-full space-y-2">
                          <div className="flex justify-between text-xs">
                             <span>Uploading...</span>
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
                          <Loader2 className="w-6 h-6 animate-spin mb-2" />
                          <span>{driveStatus}</span>
                       </>
                    )}
                 </div>
              ) : (
                 <div className="space-y-3 mt-auto">
                    <label className="w-full py-3 bg-[#34a853] hover:bg-[#34a853]/90 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium cursor-pointer">
                       <Upload className="w-4 h-4" />
                       <span>Upload Local Archive</span>
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
                                   setUploadProgress(100)
                                   try {
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
                                setUploadProgress(0)
                             }

                             xhr.onerror = () => {
                                setError('Upload failed')
                                setDriveLoading(false)
                                setUploadProgress(0)
                             }

                             xhr.send(form)
                          }}
                       />
                    </label>

                    <button
                       onClick={handleDriveImport}
                       className="w-full py-3 bg-[#34a853]/10 hover:bg-[#34a853]/20 text-[#34a853] rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                       <ArrowRight className="w-4 h-4" />
                       <span>Download from Cloud</span>
                    </button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  )
}
