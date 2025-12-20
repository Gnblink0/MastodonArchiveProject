import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid
} from 'recharts'
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react'

export function StatsPage() {
  const [interactionsOpen, setInteractionsOpen] = useState(true)

  const stats = useLiveQuery(async () => {
    const allPosts = await db.posts.toArray()
    const allLikes = await db.likes.toArray()
    const allBookmarks = await db.bookmarks.toArray()
    const metadata = await db.metadata.get('current')

    // --- Toots Overview Table Data ---
    const overview = {
      public: { original: 0, reply: 0, total: 0 },
      unlisted: { original: 0, reply: 0, total: 0 },
      private: { original: 0, reply: 0, total: 0 },
      direct: { original: 0, reply: 0, total: 0 },
      total: { original: 0, reply: 0, total: 0 }
    }

    let totalBoosts = 0
    let totalNoDMs = 0

    // --- Interaction Stats Counters ---
    const replyInteractions: Record<string, number> = {}
    const boostInteractions: Record<string, number> = {}
    
    // --- Trend Chart Data ---
    // Key: YYYY-MM-DD
    const dailyActivity: Record<string, { original: number, reply: number, boost: number }> = {}

    let minDate = new Date().getTime()
    let maxDate = 0

    allPosts.forEach(post => {
      // Date Range
      if (post.timestamp < minDate) minDate = post.timestamp
      if (post.timestamp > maxDate) maxDate = post.timestamp

      const dateStr = new Date(post.timestamp).toISOString().split('T')[0]
      if (!dailyActivity[dateStr]) {
        dailyActivity[dateStr] = { original: 0, reply: 0, boost: 0 }
      }

      if (post.type === 'boost') {
        totalBoosts++
        dailyActivity[dateStr].boost++
        
        // Extract boosted user (heuristics from originalUrl or content if available)
        // Since we don't have explicit boostedAccount in schema yet, we might rely on parsing
        // But for now, let's skip extracting username from boost as it requires more complex parsing not fully in schema
        // Or if we assume originalUrl contains the user?
        if (post.originalUrl) {
           // Try to extract username from URL (e.g., https://instance.com/@user/123 or https://instance.com/users/user/statuses/123)
           // This is rough estimation
           try {
             const urlObj = new URL(post.originalUrl)
             const pathParts = urlObj.pathname.split('/')
             // find part starting with @ or 'users'
             const userPart = pathParts.find(p => p.startsWith('@')) || pathParts[pathParts.indexOf('users') + 1]
             if (userPart) {
               boostInteractions[userPart] = (boostInteractions[userPart] || 0) + 1
             }
           } catch (e) {}
        }

      } else {
        // Post or Reply
        const isReply = !!post.inReplyTo
        const vis = post.visibility || 'public' // Default to public if migration hasn't run fully or data missing
        
        // Update Table Counts
        if (overview[vis]) {
          if (isReply) {
             overview[vis].reply++
             overview[vis].total++
             overview.total.reply++
          } else {
             overview[vis].original++
             overview[vis].total++
             overview.total.original++
          }
           overview.total.total++
        }

        if (vis !== 'direct') {
          totalNoDMs++
        }
        
        // Chart Data
        if (isReply) {
          dailyActivity[dateStr].reply++

          // Interaction: Reply To
          // We look at mentions to see who we replied to
          // Usually the first mention in a reply is the person replied to, plus others
          if (post.mentions && post.mentions.length > 0) {
            post.mentions.forEach(mention => {
              // We could filter out self-mentions if we knew our own username
              replyInteractions[mention.name] = (replyInteractions[mention.name] || 0) + 1
            })
          }
        } else {
          dailyActivity[dateStr].original++
        }
      }
    })

    // --- Like & Bookmark Interactions ---
    const likeInteractions: Record<string, number> = {}
    allLikes.forEach(like => {
       if (like.targetUrl) {
         try {
           const urlObj = new URL(like.targetUrl)
           // Attempt to extract username
             const pathParts = urlObj.pathname.split('/')
             const userPart = pathParts.find(p => p.startsWith('@')) || pathParts[pathParts.indexOf('users') + 1]
             if (userPart) likeInteractions[userPart] = (likeInteractions[userPart] || 0) + 1
         } catch(e) {}
       }
    })

    const bookmarkInteractions: Record<string, number> = {}
    allBookmarks.forEach(bm => {
       if (bm.targetUrl) {
         try {
           const urlObj = new URL(bm.targetUrl)
           // Attempt to extract username
             const pathParts = urlObj.pathname.split('/')
             const userPart = pathParts.find(p => p.startsWith('@')) || pathParts[pathParts.indexOf('users') + 1]
             if (userPart) bookmarkInteractions[userPart] = (bookmarkInteractions[userPart] || 0) + 1
         } catch(e) {}
       }
    })


    // --- Process Chart Data ---
    const trendData = Object.entries(dailyActivity).map(([date, counts]) => ({
      date,
      ...counts
    })).sort((a, b) => a.date.localeCompare(b.date))

    // --- Process Interaction Lists ---
    const sortInteractions = (record: Record<string, number>) => 
      Object.entries(record)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100) // Top 100
        .map(([name, count]) => ({ name, count }))

    return {
      overview,
      totalBoosts,
      totalNoDMs,
      dateRange: { min: minDate, max: maxDate },
      trendData,
      interactions: {
        reply: sortInteractions(replyInteractions),
        boost: sortInteractions(boostInteractions),
        like: sortInteractions(likeInteractions),
        bookmark: sortInteractions(bookmarkInteractions)
      },
      metadata
    }
  })

  if (!stats) {
    return (
       <div className="flex items-center justify-center min-h-screen text-mastodon-text-secondary">
         <p>Loading statistics...</p>
       </div>
    )
  }

  const { overview, totalBoosts, totalNoDMs, dateRange, trendData, interactions, metadata } = stats

  const formatDate = (ts: number) => {
    if (!ts) return '-'
    return new Date(ts).toLocaleDateString()
  }

  const daysDiff = (start: number, end: number) => {
      if (!start || !end) return 0
      const diff = end - start
      return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const totalDays = daysDiff(dateRange.min, dateRange.max)
  const archiveDays = metadata ? daysDiff(new Date('2020-01-01').getTime(), new Date().getTime()) : 0 // Rough fallback

  return (
    <div className="min-h-screen bg-[#191b22] text-[#d9e1e8] p-4 md:p-8 font-sans">
      
      {/* Date Warning / Archive Info Header */}
      <div className="bg-[#282c37] rounded-lg p-6 mb-8 text-center shadow-lg border border-[#393f4f]">
         <h1 className="text-xl md:text-2xl text-white font-medium mb-4">
            Statistics Overview
         </h1>
         <div className="inline-flex flex-wrap justify-center gap-4 text-sm">
            <span className="bg-[#313543] px-3 py-1 rounded text-[#9baec8]">Archive: {metadata?.originalFilename || 'Unknown'}</span>
            <span className="bg-[#313543] px-3 py-1 rounded text-[#9baec8]">
               From {formatDate(dateRange.min)} To {formatDate(dateRange.max)}
            </span>
         </div>
      </div>

      {/* Main Grid: Overview Table + Summary Counts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        
        {/* Toots Overview Table (Left ~8 cols) */}
        <div className="lg:col-span-8 bg-[#282c37] rounded-lg overflow-hidden border border-[#393f4f]">
            <table className="w-full text-left text-sm md:text-base">
                <thead>
                    <tr className="bg-[#1f232b] text-[#8c8dff] font-bold border-b border-[#393f4f]">
                        <th className="p-4">Toots Overview</th>
                        <th className="p-4 text-center">Original</th>
                        <th className="p-4 text-center">Reply</th>
                        <th className="p-4 text-center">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#393f4f]">
                    {['public', 'unlisted', 'private', 'direct'].map((vis) => (
                        <tr key={vis} className="hover:bg-[#313543] transition-colors">
                            <td className="p-4 font-medium capitalize text-white">
                                {vis === 'private' ? 'Followers-only' : vis}
                            </td>
                            <td className="p-4 text-center text-[#e5c500] font-bold">{overview[vis as keyof typeof overview].original}</td>
                            <td className="p-4 text-center text-[#8c8dff]">{overview[vis as keyof typeof overview].reply}</td>
                            <td className="p-4 text-center text-white">{overview[vis as keyof typeof overview].total}</td>
                        </tr>
                    ))}
                    <tr className="bg-[#313543] font-bold">
                        <td className="p-4 text-white">Total</td>
                        <td className="p-4 text-center text-[#e5c500]">{overview.total.original}</td>
                        <td className="p-4 text-center text-[#8c8dff]">{overview.total.reply}</td>
                        <td className="p-4 text-center text-[#00d97e]">{overview.total.total}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        {/* Summary Metrics (Right ~4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-[#282c37] rounded-lg p-6 border border-[#393f4f] text-center flex-1 flex flex-col justify-center">
                <h3 className="text-[#9baec8] text-sm uppercase tracking-wider mb-2">Total (no DMs)</h3>
                <div className="text-4xl font-bold text-white mb-2">{totalNoDMs}</div>
                <div className="text-[#9baec8] text-sm">Average {(totalNoDMs / (totalDays || 1)).toFixed(2)} per day</div>
            </div>

            <div className="bg-[#282c37] rounded-lg p-6 border border-[#393f4f] text-center flex-1 flex flex-col justify-center">
                 <h3 className="text-[#9baec8] text-sm uppercase tracking-wider mb-2">Total of <span className="text-[#ff5050]">Boosts</span></h3>
                 <div className="text-4xl font-bold text-[#ff5050] mb-2">{totalBoosts}</div>
                 <div className="text-[#9baec8] text-sm">Average {(totalBoosts / (totalDays || 1)).toFixed(2)} per day</div>
            </div>
        </div>
      </div>

      {/* Date & Totals Footer */}
      <div className="bg-[#282c37] rounded-lg border border-[#393f4f] mb-8 overflow-hidden">
         <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#393f4f]">
            <div className="p-4 flex justify-between items-center hover:bg-[#313543]">
                <span className="text-[#9baec8]">Date Range Selected</span>
                <span className="text-white font-medium">{formatDate(dateRange.min)} To {formatDate(dateRange.max)} ({totalDays} days)</span>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-[#313543]">
                <span className="text-[#9baec8]">Total Displayed</span>
                <span className="text-white font-medium">{overview.total.total + totalBoosts}</span>
            </div>
         </div>
      </div>

      {/* Interactions Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg md:text-xl text-white font-medium">I have interacted with users in these site:</h2>
             <button 
               onClick={() => setInteractionsOpen(!interactionsOpen)}
               className="bg-[#2b90d9] hover:bg-[#2b90d9]/80 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
             >
                {interactionsOpen ? 'Fold' : 'Unfold'}
                {interactionsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
             </button>
        </div>

        {interactionsOpen && (
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-1 bg-[#282c37] border border-[#393f4f] rounded-lg overflow-hidden">
              {/* Interaction List Helper */}
              {([
                { title: 'Reply', data: interactions.reply, color: 'text-white' },
                { title: 'Boost', data: interactions.boost, color: 'text-[#ff5050]' },
                { title: 'Favourite', data: interactions.like, color: 'text-[#e5c500]' },
                { title: 'Bookmark', data: interactions.bookmark, color: 'text-[#2b90d9]' }
              ]).map((section, idx) => (
                  <div key={section.title} className={`p-0 ${idx !== 3 ? 'md:border-r border-[#393f4f]' : ''}`}>
                      <div className="bg-[#1f232b] p-3 text-center font-bold text-[#9baec8] border-b border-[#393f4f]">
                          {section.title}
                      </div>
                      <div className="h-[300px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-[#393f4f] scrollbar-track-transparent">
                          {section.data.length === 0 ? (
                             <div className="text-center text-sm text-gray-500 mt-10">No data available</div>
                          ) : (
                             <ul className="space-y-1">
                                {section.data.map(item => (
                                   <li key={item.name} className="flex justify-between text-sm hover:bg-[#313543] px-2 py-1 rounded">
                                      <span className="text-[#9baec8] truncate max-w-[70%]" title={item.name}>{item.name.replace(/^@/, '')}</span>
                                      <span className={`${section.color} font-mono`}>({item.count})</span>
                                   </li>
                                ))}
                             </ul>
                          )}
                      </div>
                  </div>
              ))}
           </div>
        )}
      </div>

      {/* Trend Chart */}
      <div className="bg-[#282c37] p-6 rounded-lg border border-[#393f4f]">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            The trend of your toot:
          </h3>
          <div className="flex flex-wrap gap-6 mb-4 text-sm justify-center">
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#e5c500]"></div> <span className="text-[#9baec8]">Original (no DMs)</span></div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#8c8dff]"></div> <span className="text-[#9baec8]">Replies (no DMs)</span></div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#ff5050]"></div> <span className="text-[#9baec8]">Boosts</span></div>
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#393f4f" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#9baec8" 
                  fontSize={12} 
                  tickMargin={10}
                  tickFormatter={(val) => val.slice(5)} // Show MM-DD
                />
                <YAxis stroke="#9baec8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#393f4f', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#9baec8' }}
                />
                <Line type="monotone" dataKey="original" stroke="#e5c500" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="reply" stroke="#8c8dff" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="boost" stroke="#ff5050" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
      </div>

    </div>
  )
}
