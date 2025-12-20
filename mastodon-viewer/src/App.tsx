import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { UploadZone } from './components/Upload/UploadZone'
import { Timeline } from './components/Timeline/Timeline'
import { ThreadView } from './components/Thread/ThreadView'
import { DebugDashboard } from './components/Debug/DebugDashboard'
import { MainLayout } from './components/Layout/MainLayout'
import { db } from './lib/db'
import { Home, User, Trash2, BarChart3 } from 'lucide-react'

function App() {
  const [hasData, setHasData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedPostId, setSelectedPostId] = useState<string | undefined>(undefined)
  const navigate = useNavigate()

  useEffect(() => {
    // 检查是否已有数据
    db.hasData().then(result => {
      setHasData(result)
      setLoading(false)
    })
  }, [])

  const handleUploadComplete = () => {
    setHasData(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mastodon-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mastodon-primary mx-auto"></div>
          <p className="mt-4 text-mastodon-text-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="min-h-screen bg-mastodon-bg text-mastodon-text-primary">
         <header className="pt-12 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Mastodon Archive Viewer</h1>
            <p className="text-mastodon-text-secondary">Upload your archive to browse your history</p>
         </header>
         <UploadZone onUploadComplete={handleUploadComplete} />
      </div>
    )
  }

  return (
    <MainLayout
      leftSidebar={
        <div className="space-y-6 flex flex-col h-full">
          <div className="px-6 py-4 cursor-pointer" onClick={() => navigate('/')}>
             <h1 className="text-xl font-bold text-white">Mastodon</h1>
             <p className="text-sm text-mastodon-text-secondary">Archive Viewer</p>
          </div>

          <nav className="flex flex-col space-y-2 px-4 flex-1">
             <button
               onClick={() => { navigate('/'); setSelectedPostId(undefined) }}
               className="flex items-center gap-4 px-4 py-3 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
             >
               <Home className="w-6 h-6" />
               <span className="text-lg">Home</span>
             </button>

             <button className="flex items-center gap-4 px-4 py-3 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer">
                <BarChart3 className="w-6 h-6" />
                <span className="text-lg">Statistics</span>
             </button>

             <button className="flex items-center gap-4 px-4 py-3 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer">
                <User className="w-6 h-6" />
                <span className="text-lg">Profile</span>
             </button>

             <button
               onClick={() => navigate('/debug')}
               className="flex items-center gap-4 px-4 py-3 text-gray-500 font-medium hover:bg-mastodon-surface hover:text-gray-300 transition-colors rounded-full mt-auto cursor-pointer"
             >
                <span className="text-lg">🛠️</span>
                <span>Debug</span>
             </button>
          </nav>

          <div className="px-6 pb-6">
            <button
               onClick={async () => {
                 if (confirm('Are you sure you want to clear all data?')) {
                   await db.clearAll()
                   setHasData(false)
                   navigate('/')
                 }
               }}
               className="flex items-center justify-center gap-2 w-full py-3 text-red-500 hover:bg-red-500/10 rounded-full font-medium transition-colors cursor-pointer"
            >
              <Trash2 className="w-5 h-5" />
              <span>Clear Data</span>
            </button>
          </div>
        </div>
      }
      rightSidebar={
         selectedPostId ? (
            <ThreadView 
                postId={selectedPostId} 
                onClose={() => setSelectedPostId(undefined)} 
            />
         ) : (
            <div className="flex items-center justify-center h-full text-mastodon-text-secondary">
               <div className="text-center p-8">
                  <p className="mb-2">Select a post to view details</p>
               </div>
            </div>
         )
      }
    >
      <Routes>
         <Route path="/" element={<Timeline onPostClick={(id) => setSelectedPostId(id)} />} />
         <Route path="/debug" element={<DebugDashboard />} />
      </Routes>
    </MainLayout>
  )
}

export default App
