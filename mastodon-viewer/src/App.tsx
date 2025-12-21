import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { UploadZone } from './components/Upload/UploadZone'
import { Timeline } from './components/Timeline/Timeline'
import { ThreadView } from './components/Thread/ThreadView'
import { DebugDashboard } from './components/Debug/DebugDashboard'
import { MainLayout } from './components/Layout/MainLayout'
import { StatsPage } from './pages/StatsPage'
import { ProfilePage } from './pages/ProfilePage'
import { InteractionsPage } from './pages/InteractionsPage'
import { db } from './lib/db'
import { Home, User, Trash2, BarChart3, X, Star, Bookmark, LogIn, LogOut, Cloud } from 'lucide-react'
import { useGoogleLogin } from '@react-oauth/google'

function App() {
  const [hasData, setHasData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedPostId, setSelectedPostId] = useState<string | undefined>(undefined)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Google OAuth states
  const [googleUser, setGoogleUser] = useState<any>(null)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null)

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log('Google Login Success:', tokenResponse)
      setGoogleAccessToken(tokenResponse.access_token)
      
      // Fetch user profile
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const userInfo = await res.json()
        setGoogleUser(userInfo)
      } catch (err) {
        console.error('Failed to fetch Google user info', err)
      }
    },
    onError: error => console.error('Google Login Failed:', error),
    scope: 'https://www.googleapis.com/auth/drive.file'
  });

  const handleLogout = () => {
    setGoogleUser(null)
    setGoogleAccessToken(null)
  }

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
         <UploadZone 
            onUploadComplete={handleUploadComplete} 
            googleUser={googleUser}
            googleLogin={googleLogin}
            googleAccessToken={googleAccessToken}
         />
      </div>
    )
  }

  const handlePostClick = (postId: string) => {
    // On mobile, navigate to thread page; on desktop, show in right sidebar
    if (window.innerWidth < 1024) { // lg breakpoint
      navigate(`/post/${postId}`)
    } else {
      setSelectedPostId(postId)
    }
  }

  const leftSidebarContent = (
    <div className="space-y-6 flex flex-col h-full">
      <div className="px-6 py-4 cursor-pointer" onClick={() => { navigate('/'); setMobileMenuOpen(false) }}>
         <h1 className="text-xl font-bold text-white">Mastodon</h1>
         <p className="text-sm text-mastodon-text-secondary">Archive Viewer</p>
      </div>

      <nav className="flex flex-col space-y-2 px-4 flex-1">
         <button
           onClick={() => { navigate('/'); setSelectedPostId(undefined); setMobileMenuOpen(false) }}
           className="flex items-center gap-4 px-4 py-3 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
         >
           <Home className="w-6 h-6" />
           <span className="text-lg">Home</span>
         </button>

         <button 
            onClick={() => { navigate('/stats'); setMobileMenuOpen(false) }}
            className="flex items-center gap-4 px-4 py-3 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
         >
            <BarChart3 className="w-6 h-6" />
            <span className="text-lg">Statistics</span>
         </button>

         <button 
            onClick={() => { navigate('/profile'); setMobileMenuOpen(false) }}
            className="flex items-center gap-4 px-4 py-3 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
         >
            <User className="w-6 h-6" />
            <span className="text-lg">Profile</span>
         </button>


         <button 
            onClick={() => { navigate('/favourites'); setMobileMenuOpen(false) }}
            className="flex items-center gap-4 px-4 py-3 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
         >
            <Star className="w-6 h-6" />
            <span className="text-lg">Favourites</span>
         </button>

         <button 
            onClick={() => { navigate('/bookmarks'); setMobileMenuOpen(false) }}
            className="flex items-center gap-4 px-4 py-3 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
         >
            <Bookmark className="w-6 h-6" />
            <span className="text-lg">Bookmarks</span>
         </button>

      </nav>

      <div className="px-6 py-4 mt-auto border-t border-mastodon-border/50">
        {googleAccessToken ? (
          <>
            <div className="flex items-center justify-between py-2 text-mastodon-text-secondary text-xs mb-2">
              <span className="truncate">Logged in as {googleUser?.name || 'User'}</span>
              <button
                onClick={handleLogout}
                className="text-red-400 hover:text-red-300 flex items-center gap-1.5 cursor-pointer ml-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-xs">Logout</span>
              </button>
            </div>
            <button
              onClick={() => console.log('Upload to Drive')} // TODO: Implement upload
              className="flex items-center justify-center gap-2 w-full py-2.5 mb-2 text-mastodon-primary hover:text-mastodon-primary/80 hover:bg-white/5 rounded-lg text-sm transition-colors cursor-pointer"
            >
              <Cloud className="w-4 h-4" />
              <span>Sync to Drive</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => googleLogin()}
            className="flex items-center justify-center gap-2 w-full py-2.5 mb-2 text-mastodon-primary hover:text-mastodon-primary/80 hover:bg-white/5 rounded-lg text-sm transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Login with Google</span>
          </button>
        )}

        <button
           onClick={async () => {
             if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
               await db.clearAll()
               setHasData(false)
               navigate('/')
               setMobileMenuOpen(false)
             }
           }}
           className="flex items-center justify-center gap-2 w-full py-2.5 text-mastodon-text-tertiary hover:text-red-400 hover:bg-white/5 rounded-lg text-sm transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Data</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div className={`fixed top-0 left-0 h-full w-[280px] bg-mastodon-bg z-50 transform transition-transform duration-300 md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-end p-4">
          <button onClick={() => setMobileMenuOpen(false)} className="text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        {leftSidebarContent}
      </div>



      <MainLayout
        leftSidebar={leftSidebarContent}
        onMobileMenuToggle={location.pathname !== '/' ? () => setMobileMenuOpen(true) : undefined}
        rightSidebar={
           ['/stats', '/profile', '/favourites', '/bookmarks'].includes(location.pathname) ? undefined : (
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
        )
      }
      >
        <Routes>
           <Route path="/" element={<Timeline onPostClick={handlePostClick} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />} />
           <Route path="/post/:id" element={<ThreadView />} />
           <Route path="/stats" element={<StatsPage />} />
           <Route path="/profile" element={<ProfilePage />} />
           <Route path="/favourites" element={<InteractionsPage type="likes" />} />
           <Route path="/bookmarks" element={<InteractionsPage type="bookmarks" />} />
           <Route path="/debug" element={<DebugDashboard />} />
        </Routes>
      </MainLayout>
    </>
  )
}

export default App
