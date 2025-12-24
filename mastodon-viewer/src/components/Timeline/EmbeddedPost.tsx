import { useState, useEffect } from 'react'
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react'

interface EmbeddedPostProps {
  url: string
  timestamp?: Date
}

interface OEmbedData {
  html: string
  author_name?: string
  author_url?: string
  provider_name?: string
}

export function EmbeddedPost({ url, timestamp }: EmbeddedPostProps) {
  const [data, setData] = useState<OEmbedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchOEmbed = async () => {
      try {
        setLoading(true)
        setError(false)
        
        // 1. Try to guess the oEmbed endpoint based on Mastodon conventions
        // Convention: https://<instance>/api/oembed?url=<post_url>
        
        const urlObj = new URL(url)
        const instance = urlObj.origin
        const oembedEndpoint = `${instance}/api/oembed?url=${encodeURIComponent(url)}`
        
        // 2. Use a CORS proxy to bypass browser restrictions
        // We use corsproxy.io as a reliable public proxy
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(oembedEndpoint)}`
        
        const response = await fetch(proxyUrl)

        if (!response.ok) {
          // Silently fail for 404s - many instances don't support oEmbed or posts are private
          if (response.status === 404) {
            setError(true)
            setLoading(false)
            return
          }
          throw new Error(`Failed to fetch oEmbed: ${response.status}`)
        }

        const json = await response.json()
        setData(json)
      } catch (err) {
        // Silently handle errors - many external posts don't support oEmbed
        // No logging needed as this is expected behavior
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    if (url) {
      fetchOEmbed()
    }
  }, [url])

  // Helper to safely format timestamp
  const formatDate = (date?: Date) => {
    if (!date) return ''
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  // Fallback view (link only)
  const fallbackView = (
    <div className="bg-mastodon-surface p-4 rounded-lg border border-mastodon-border flex flex-col gap-2">
      <div className="flex items-center justify-between text-mastodon-text-secondary text-sm">
         <span>Bookmarked Post</span>
         {timestamp && <time>{formatDate(timestamp)}</time>}
      </div>
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-mastodon-primary hover:underline break-all flex items-center gap-2"
      >
        <ExternalLink className="w-4 h-4 shrink-0" />
        {url}
      </a>
      {error && (
        <div className="text-xs text-mastodon-text-secondary flex items-center gap-1 mt-1">
          <AlertCircle className="w-3 h-3" />
          <span>Preview unavailable (CORS or private post)</span>
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="bg-mastodon-surface p-6 rounded-lg border border-mastodon-border animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-white/10 rounded" />
            <div className="h-3 w-24 bg-white/10 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-white/10 rounded" />
          <div className="h-4 w-3/4 bg-white/10 rounded" />
        </div>
        <div className="flex items-center justify-center mt-4">
           <Loader2 className="w-5 h-5 text-mastodon-text-secondary animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !data || !data.html) {
    return fallbackView
  }

  return (
    <div className="bg-mastodon-surface rounded-lg border border-mastodon-border overflow-hidden">
        {timestamp && (
            <div className="px-4 py-2 border-b border-mastodon-border bg-black/20 text-xs text-mastodon-text-secondary flex justify-between items-center">
                <span>Bookmarked on {formatDate(timestamp)}</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    <ExternalLink className="w-3 h-3" />
                </a>
            </div>
        )}
        
        {/* Render the embedded HTML provided by the Mastodon instance */}
        {/* We wrap it to style standard iframe/blockquote provided by Mastodon */}
        <div 
          className="p-4 [&_iframe]:w-full [&_iframe]:rounded-lg [&_iframe]:border-none"
          dangerouslySetInnerHTML={{ __html: data.html }} 
        />
    </div>
  )
}
