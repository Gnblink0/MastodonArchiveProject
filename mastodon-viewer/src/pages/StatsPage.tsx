import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  Brush
} from 'recharts'
import { BarChart3, TrendingUp, Calendar } from 'lucide-react'
import { format, startOfYear, endOfYear, getYear, eachWeekOfInterval } from 'date-fns'

export function StatsPage() {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipContent, setTooltipContent] = useState<{ date: string; original: number; reply: number; boost: number; total: number } | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

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
    let totalReplies = 0
    let totalNoDMs = 0

    // --- Interaction Stats Counters ---
    // Store as { count: number, url: string }
    const replyInteractions: Record<string, { count: number, url: string }> = {}
    const boostInteractions: Record<string, { count: number, url: string }> = {}
    const likeInteractions: Record<string, { count: number, url: string }> = {}
    const bookmarkInteractions: Record<string, { count: number, url: string }> = {}
    
    // --- Trend Chart Data ---
    // Key: YYYY-MM-DD
    const dailyActivity: Record<string, { original: number, reply: number, boost: number }> = {}
    const dailyTotal: Map<string, number> = new Map() // Key: YYYY-MM-DD, Value: total count
    const yearSet = new Set<number>()

    let minDate = new Date().getTime()
    let maxDate = 0

    allPosts.forEach(post => {
      const year = getYear(post.publishedAt)
      yearSet.add(year)
      
      // Date Range
      if (post.timestamp < minDate) minDate = post.timestamp
      if (post.timestamp > maxDate) maxDate = post.timestamp

      const dateStr = new Date(post.timestamp).toISOString().split('T')[0]
      if (!dailyActivity[dateStr]) {
        dailyActivity[dateStr] = { original: 0, reply: 0, boost: 0 }
      }
      
      // Update daily total for heatmap
      dailyTotal.set(dateStr, (dailyTotal.get(dateStr) || 0) + 1)

      if (post.type === 'boost') {
        totalBoosts++
        dailyActivity[dateStr].boost++
        
        // Extract boosted user (heuristics from originalUrl or content if available)
        if (post.boostedPostId) {
           const url = post.boostedPostId
           try {
             if (!url.startsWith('http')) {
               // console.warn('[Stats] Invalid boost URL:', url)
             } else {
                 const urlObj = new URL(url)
                 const path = urlObj.pathname
                 const atMatch = path.match(/\/(@[\w\-\.]+)/)
                 if (atMatch) {
                    const username = atMatch[1]
                    const existing = boostInteractions[username] || { count: 0, url: '' }
                    // Try to construct a profile URL if we only have username, but best to use the ActivityPub ID if possible.
                    // For boosts, the 'url' variable IS the post URL, not profile. Profile is usually url origin + /@user
                    const profileUrl = urlObj.origin + '/' + username
                    boostInteractions[username] = { count: existing.count + 1, url: profileUrl }
                 } else {
                     const usersMatch = path.match(/\/users\/([\w\-\.]+)/)
                     if (usersMatch) {
                        const username = '@' + usersMatch[1] 
                        const existing = boostInteractions[username] || { count: 0, url: '' }
                        // Construct profile URL from /users/ endpoint conventions
                        // https://instance.com/users/user -> https://instance.com/@user
                        const profileUrl = urlObj.origin + '/@' + usersMatch[1]
                        boostInteractions[username] = { count: existing.count + 1, url: profileUrl }
                     }
                 }
             }
           } catch (e) {
             // console.error('[Stats] Error parsing boost URL:', url, e)
           }
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
             totalReplies++
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
          if (post.mentions && post.mentions.length > 0) {
            post.mentions.forEach(mention => {
              const existing = replyInteractions[mention.name] || { count: 0, url: '' }
              replyInteractions[mention.name] = { count: existing.count + 1, url: mention.url }
            })
          }
        } else {
          dailyActivity[dateStr].original++
        }
      }
    })

    // --- Like & Bookmark Interactions ---
    // Note: likeInteractions and bookmarkInteractions were already initialized above with the new type
    allLikes.forEach(like => {
       if (like.targetUrl) {
         try {
           const urlObj = new URL(like.targetUrl)
           const path = urlObj.pathname
             const atMatch = path.match(/\/(@[\w\-\.]+)/)
             if (atMatch) {
                const username = atMatch[1]
                const existing = likeInteractions[username] || { count: 0, url: '' }
                likeInteractions[username] = { count: existing.count + 1, url: urlObj.origin + '/' + username }
             } else {
                 const usersMatch = path.match(/\/users\/([\w\-\.]+)/)
                 if (usersMatch) {
                    const username = '@' + usersMatch[1]
                    const existing = likeInteractions[username] || { count: 0, url: '' }
                    likeInteractions[username] = { count: existing.count + 1, url: urlObj.origin + '/@' + usersMatch[1] }
                 }
             }
         } catch(e) {}
       }
    })

    allBookmarks.forEach(bm => {
       if (bm.targetUrl) {
         try {
           const urlObj = new URL(bm.targetUrl)
           const path = urlObj.pathname
             const atMatch = path.match(/\/(@[\w\-\.]+)/)
             if (atMatch) {
                const username = atMatch[1]
                const existing = bookmarkInteractions[username] || { count: 0, url: '' }
                bookmarkInteractions[username] = { count: existing.count + 1, url: urlObj.origin + '/' + username }
             } else {
                 const usersMatch = path.match(/\/users\/([\w\-\.]+)/)
                 if (usersMatch) {
                    const username = '@' + usersMatch[1]
                    const existing = bookmarkInteractions[username] || { count: 0, url: '' }
                    bookmarkInteractions[username] = { count: existing.count + 1, url: urlObj.origin + '/@' + usersMatch[1] }
                 }
             }
         } catch(e) {}
       }
    })


    // --- Process Chart Data ---
    const trendData = Object.entries(dailyActivity).map(([date, counts]) => ({
      date,
      ...counts
    })).sort((a, b) => a.date.localeCompare(b.date))

    // --- Process Interaction Lists ---
    const sortInteractions = (record: Record<string, { count: number, url: string }>) => 
      Object.entries(record)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 100) // Top 100
        .map(([name, data]) => ({ name, count: data.count, url: data.url }))

    return {
      overview,
      totalBoosts,
      totalReplies,
      totalFavourites: allLikes.length,
      totalBookmarks: allBookmarks.length,
      dateRange: { min: minDate, max: maxDate },
      trendData,
      dailyTotal,
      dailyActivity, // Expose this
      years: Array.from(yearSet).sort((a, b) => b - a),
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

  const { 
    overview, 
    totalBoosts, 
    totalReplies, 
    totalFavourites, 
    totalBookmarks, 
    dateRange, 
    trendData, 
    interactions, 
    metadata 
  } = stats

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

  return (
    <div className="h-full overflow-auto bg-[#191b22] text-[#d9e1e8] p-4 md:p-8 font-sans">
      
      {/* Header & Meta */}
      <div className="bg-[#282c37] rounded-lg p-6 mb-8 text-center shadow-lg border border-[#393f4f]">
         <h1 className="text-xl md:text-2xl text-white font-medium mb-4">
            Statistics Overview
         </h1>
         <div className="inline-flex flex-wrap justify-center gap-4 text-sm">
            <span className="bg-[#313543] px-3 py-1 rounded text-[#9baec8]">Archive: {metadata?.originalFilename || 'Unknown'}</span>
            <span className="bg-[#313543] px-3 py-1 rounded text-[#9baec8]">
               From {formatDate(dateRange.min)} To {formatDate(dateRange.max)} ({totalDays} days)
            </span>
         </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Replies', count: totalReplies, color: 'text-[#8c8dff]', bg: 'bg-[#8c8dff]/10' },
          { label: 'Boosts', count: totalBoosts, color: 'text-[#ff5050]', bg: 'bg-[#ff5050]/10' },
          { label: 'Favourites', count: totalFavourites, color: 'text-[#e5c500]', bg: 'bg-[#e5c500]/10' },
          { label: 'Bookmarks', count: totalBookmarks, color: 'text-[#2b90d9]', bg: 'bg-[#2b90d9]/10' }
        ].map(card => (
          <div key={card.label} className={`rounded-lg p-6 border border-[#393f4f] bg-[#282c37] flex flex-col items-center justify-center transition-transform hover:scale-105`}>
             <h3 className="text-[#9baec8] text-xs md:text-sm uppercase tracking-wider mb-2">{card.label}</h3>
             <div className={`text-2xl md:text-4xl font-bold ${card.color} mb-1`}>{card.count.toLocaleString()}</div>
             <div className="text-xs text-[#606984]">All time</div>
          </div>
        ))}
      </div>

      {/* Heatmap Section */}
      <div className="mb-8 bg-[#282c37] rounded-lg p-6 border border-[#393f4f] overflow-x-auto">
         <div className="flex items-center justify-between mb-6 min-w-[600px]">
            <h2 className="text-lg md:text-xl text-white font-medium flex items-center gap-2">
               <Calendar className="w-5 h-5 text-[#00d97e]" />
               <span>Activity Heatmap</span>
            </h2>
            {stats.years.length > 0 && (
               <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-[#1f232b] border border-[#393f4f] text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#2b90d9]"
               >
                  {stats.years.map(y => (
                     <option key={y} value={y}>{y}</option>
                  ))}
               </select>
            )}
         </div>
         
         <div className="min-w-[800px]">
             {/* Generate days for selected year in vertical weeks layout */}
             {(() => {
                const start = startOfYear(new Date(selectedYear, 0, 1))
                const end = endOfYear(new Date(selectedYear, 0, 1))
                // Get all weeks in the year
                const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 0 })
                
                return (
                  <div className="flex gap-1">
                    {/* Render each week as a column */}
                    {weeks.map((weekStart: Date, weekIdx: number) => {
                       // Generate 7 days for this week
                       const weekDays = Array.from({ length: 7 }).map((_, i) => {
                          const d = new Date(weekStart)
                          d.setDate(d.getDate() + i)
                          return d
                       })

                       return (
                          <div key={weekIdx} className="flex flex-col gap-1">
                             {weekDays.map((day) => {
                                // Check if day is within the selected year (handle edge cases of first/last week)
                                if (getYear(day) !== selectedYear) {
                                   return <div key={day.toISOString()} className="w-3 h-3 md:w-3.5 md:h-3.5 opacity-0" />
                                }

                                const dayKey = format(day, 'yyyy-MM-dd')
                                const count = stats.dailyTotal.get(dayKey) || 0
                                const activity = stats.dailyActivity[dayKey] || { original: 0, reply: 0, boost: 0 }
                                
                                // Determine color intensity
                                let bgColor = 'rgba(57, 63, 79, 0.3)' // default empty
                                if (count > 0) bgColor = '#0e4429'
                                if (count > 2) bgColor = '#006d32'
                                if (count > 5) bgColor = '#26a641'
                                if (count > 10) bgColor = '#39d353'

                                return (
                                   <div 
                                      key={dayKey}
                                      onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top + window.scrollY })
                                        setTooltipContent({ date: dayKey, total: count, original: activity.original, reply: activity.reply, boost: activity.boost })
                                        setTooltipVisible(true)
                                      }}
                                      className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm cursor-pointer transition-opacity hover:opacity-80 relative"
                                      style={{ backgroundColor: bgColor }}
                                   />
                                )
                             })}
                          </div>
                       )
                    })}
                  </div>
                )
             })()}
         </div>
         
         <div className="flex items-center gap-2 mt-4 text-xs text-[#9baec8] justify-end min-w-[600px]">
             <span>Less</span>
             <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(57, 63, 79, 0.3)' }} />
             <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#0e4429' }} />
             <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#006d32' }} />
             <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#26a641' }} />
             <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#39d353}' }} />
             <span>More</span>
         </div>
      </div>

      {/* Custom Heatmap Tooltip */}
      {tooltipVisible && tooltipContent && (
        <div
          className="absolute z-50 bg-[#1f232b] border border-[#393f4f] rounded-lg p-3 text-sm shadow-xl animate-in fade-in"
          style={{ 
            left: tooltipPosition.x, 
            top: tooltipPosition.y,
            transform: 'translate(-50%, -100%)', // Position above the cursor
            pointerEvents: 'none' 
          }}
        >
          <p className="font-bold text-white mb-1">{tooltipContent.date}</p>
          <p className="text-[#9baec8]">Total: <span className="text-white">{tooltipContent.total}</span></p>
          <p className="text-[#e5c500]">Original: <span className="text-white">{tooltipContent.original}</span></p>
          <p className="text-[#8c8dff]">Replies: <span className="text-white">{tooltipContent.reply}</span></p>
          <p className="text-[#ff5050]">Boosts: <span className="text-white">{tooltipContent.boost}</span></p>
        </div>
      )}

      {/* Toots Overview Table (Main Content) */}
      <div className="mb-8 bg-[#282c37] rounded-lg overflow-hidden border border-[#393f4f]">
            <div className="p-4 bg-[#1f232b] border-b border-[#393f4f] font-bold text-white">
              Toots Distribution
            </div>
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-[#1f232b] text-[#8c8dff] font-bold border-b border-[#393f4f]">
                        <th className="p-3">Visibility</th>
                        <th className="p-3 text-center">Original</th>
                        <th className="p-3 text-center">Reply</th>
                        <th className="p-3 text-center">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#393f4f]">
                    {['public', 'unlisted', 'private', 'direct'].map((vis) => (
                        <tr key={vis} className="hover:bg-[#313543] transition-colors">
                            <td className="p-3 font-medium capitalize text-white">
                                {vis === 'private' ? 'Followers-only' : vis}
                            </td>
                            <td className="p-3 text-center text-[#e5c500] font-bold">{overview[vis as keyof typeof overview].original}</td>
                            <td className="p-3 text-center text-[#8c8dff]">{overview[vis as keyof typeof overview].reply}</td>
                            <td className="p-3 text-center text-white">{overview[vis as keyof typeof overview].total}</td>
                        </tr>
                    ))}
                    <tr className="bg-[#313543] font-bold">
                        <td className="p-3 text-white">Total</td>
                        <td className="p-3 text-center text-[#e5c500]">{overview.total.original}</td>
                        <td className="p-3 text-center text-[#8c8dff]">{overview.total.reply}</td>
                        <td className="p-3 text-center text-[#00d97e]">{overview.total.total}</td>
                    </tr>
                </tbody>
            </table>
      </div>

      {/* Interactions Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg md:text-xl text-white font-medium">Most Interacted Users</h2>
        </div>

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
                                   <li key={item.name} className="flex justify-between text-sm hover:bg-[#313543] px-2 py-1 rounded group items-center">
                                      <a 
                                        href={item.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-[#9baec8] truncate max-w-[70%] group-hover:text-white group-hover:underline transition-colors" 
                                        title={item.name}
                                      >
                                        {item.name.replace(/^@/, '')}
                                      </a>
                                      <span className={`${section.color} font-mono`}>{item.count}</span>
                                   </li>
                                ))}
                             </ul>
                          )}
                      </div>
                  </div>
              ))}
           </div>
      </div>

      {/* Trend Chart (Moved to bottom) */}
      <div className="bg-[#282c37] p-6 rounded-lg border border-[#393f4f] flex flex-col mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                Activity Trend
              </h3>
              
              <div className="flex bg-[#1f232b] p-1 rounded-lg border border-[#393f4f]">
                 <button 
                    onClick={() => setChartType('line')}
                    className={`p-2 rounded flex items-center gap-2 text-sm font-medium transition-colors ${chartType === 'line' ? 'bg-[#2b90d9] text-white' : 'text-[#9baec8] hover:text-white'}`}
                    title="Line Chart"
                 >
                    <TrendingUp className="w-4 h-4" />
                    <span className="hidden sm:inline">Line</span>
                 </button>
                 <button 
                    onClick={() => setChartType('bar')}
                    className={`p-2 rounded flex items-center gap-2 text-sm font-medium transition-colors ${chartType === 'bar' ? 'bg-[#2b90d9] text-white' : 'text-[#9baec8] hover:text-white'}`}
                    title="Bar Chart"
                 >
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden sm:inline">Bar</span>
                 </button>
              </div>
          </div>
          
          <div className="w-full min-h-[400px]">
             {/* Using Brush for zooming/scrolling */}
            <ResponsiveContainer width="100%" height={400}>
              {chartType === 'line' ? (
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#393f4f" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9baec8" 
                    fontSize={12} 
                    tickMargin={10}
                    tickFormatter={(val) => val.slice(5)}
                    minTickGap={30}
                  />
                  <YAxis stroke="#9baec8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#393f4f', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#9baec8' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  {/* Brush adds the scroll/zoom bar at the bottom */}
                  <Brush 
                     dataKey="date" 
                     height={30} 
                     stroke="#2b90d9" 
                     fill="#1f232b" 
                     tickFormatter={(val) => val.slice(5)}
                  />
                  <Line name="Original" type="monotone" dataKey="original" stroke="#e5c500" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                  <Line name="Replies" type="monotone" dataKey="reply" stroke="#8c8dff" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                  <Line name="Boosts" type="monotone" dataKey="boost" stroke="#ff5050" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              ) : (
                <BarChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#393f4f" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9baec8" 
                    fontSize={12} 
                    tickMargin={10}
                    tickFormatter={(val) => val.slice(5)}
                    minTickGap={30}
                  />
                  <YAxis stroke="#9baec8" fontSize={12} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#393f4f', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#9baec8' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Brush 
                     dataKey="date" 
                     height={30} 
                     stroke="#2b90d9" 
                     fill="#1f232b" 
                     tickFormatter={(val) => val.slice(5)}
                  />
                  <Bar name="Original" dataKey="original" stackId="a" fill="#e5c500" />
                  <Bar name="Replies" dataKey="reply" stackId="a" fill="#8c8dff" />
                  <Bar name="Boosts" dataKey="boost" stackId="b" fill="#ff5050" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
      </div>

    </div>
  )
}