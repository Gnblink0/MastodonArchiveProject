import { useEffect, useState } from 'react'
import { db } from '../../lib/db'
import { MainLayout } from '../Layout/MainLayout'
import { Loader2 } from 'lucide-react'

export function DebugDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const runAnalysis = async () => {
      const posts = await db.posts.toArray()
      const totalPosts = posts.length
      const replies = posts.filter(p => p.inReplyTo)
      
      let orphans = 0
      let samples: any[] = []

      // Check orphans
      for (const p of replies) {
        if (p.inReplyTo) {
           const parent = await db.posts.get(p.inReplyTo)
           if (!parent) orphans++
        }
      }

      // Collect samples (first 10 repliers)
      samples = replies.slice(0, 10).map(p => ({
        id: p.id,
        inReplyTo: p.inReplyTo,
        link: `/post/${p.id}`
      }))

      setStats({
        totalPosts,
        replyCount: replies.length,
        orphans,
        samples
      })
      setLoading(false)
    }

    runAnalysis()
  }, [])

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>

  return (
    <div className="p-4 text-white">
      <h1 className="text-2xl font-bold mb-4">Debug Dashboard</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg text-gray-400">Total Posts</h2>
          <p className="text-3xl font-bold">{stats.totalPosts}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg text-gray-400">Replies</h2>
          <p className="text-3xl font-bold">{stats.replyCount}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg text-red-400">Orphaned Replies</h2>
          <p className="text-3xl font-bold text-red-500">{stats.orphans}</p>
          <p className="text-xs text-gray-500">Replies where parent is missing from DB</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
           <h2 className="text-lg text-gray-400">Orphan Rate</h2>
           <p className="text-3xl font-bold">
             {stats.replyCount ? ((stats.orphans / stats.replyCount) * 100).toFixed(1) : 0}%
           </p>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-2">Sample Replies</h2>
      <div className="bg-gray-900 rounded p-4 font-mono text-xs overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="p-2">Post ID</th>
              <th className="p-2">InReplyTo ID (Stored)</th>
            </tr>
          </thead>
          <tbody>
            {stats.samples.map((s: any) => (
              <tr key={s.id} className="border-b border-gray-800">
                <td className="p-2 text-blue-400 select-all">{s.id}</td>
                <td className="p-2 text-green-400 select-all">{s.inReplyTo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
