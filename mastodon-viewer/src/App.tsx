import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import { UploadZone } from './components/Upload/UploadZone'
import { Timeline } from './components/Timeline/Timeline'
import { ThreadView } from './components/Thread/ThreadView'
import { DebugDashboard } from './components/Debug/DebugDashboard'
import { MainLayout } from './components/Layout/MainLayout'
import { StatsPage } from './pages/StatsPage'
import { ProfilePage } from './pages/ProfilePage'
import { AccountsPage } from './pages/AccountsPage'
import { AccountDetailPage } from './pages/AccountDetailPage'
import { InteractionsPage } from './pages/InteractionsPage'
import { MemoriesPage } from './pages/MemoriesPage'
import { AccountFilterProvider } from './contexts/AccountFilterContext'
import { db } from './lib/db'
import headerLogo from './assets/header-logo.png'
import bannerImg from './assets/banner.png'
// ↓ 在下面这行里加上 History
import { Home, Users, Trash2, BarChart3, X, Star, Bookmark, LogIn, LogOut, Loader2, History, Languages } from 'lucide-react'
import { useGoogleLogin } from '@react-oauth/google'
import { useTranslation } from 'react-i18next'

// Wrapper component to handle desktop redirect for /post/:id
function PostRouteHandler() {
  const { id } = useParams<{ id: string }>()
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // On desktop, redirect to home with the post ID as state
  if (isDesktop) {
    return <Navigate to="/" state={{ openPostId: id }} replace />
  }

  // On mobile, render ThreadView normally
  return <ThreadView />
}

function App() {
  const { t, i18n } = useTranslation()
  const [hasData, setHasData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedPostId, setSelectedPostId] = useState<string | undefined>(undefined)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('zh') ? 'en' : 'zh'
    i18n.changeLanguage(nextLang)
  }

  // Google OAuth states
  const [googleUser, setGoogleUser] = useState<any>(null)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null)

  // Helper function to clear Google auth
  const clearGoogleAuth = () => {
    setGoogleUser(null)
    setGoogleAccessToken(null)
    localStorage.removeItem('google_access_token')
    localStorage.removeItem('google_user')
    localStorage.removeItem('google_token_expiry')
  }

  // Restore Google login from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('google_access_token')
    const savedUser = localStorage.getItem('google_user')
    const tokenExpiry = localStorage.getItem('google_token_expiry')

    if (savedToken && savedUser && tokenExpiry) {
      // Check if token is expired
      const expiryTime = parseInt(tokenExpiry, 10)
      if (Date.now() < expiryTime) {
        setGoogleAccessToken(savedToken)
        setGoogleUser(JSON.parse(savedUser))

        // Verify token is still valid AND has the Drive scope. Older tokens
        // (from before Drive support) pass userinfo checks but lack drive.file,
        // which later causes 403 "insufficient scopes" on Drive API calls.
        fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${savedToken}`)
          .then(res => (res.ok ? res.json() : Promise.reject(new Error('invalid'))))
          .then((info: { scope?: string }) => {
            const scopes = info.scope || ''
            if (!scopes.includes('drive.file')) {
              // Token lacks Drive permission — force a fresh login
              console.log('Stored token is missing Drive scope, clearing...')
              clearGoogleAuth()
            }
          })
          .catch(() => {
            // Token invalid/expired at Google — clear it
            console.log('Stored token is invalid, clearing...')
            clearGoogleAuth()
          })
      } else {
        // Token expired, clear storage
        clearGoogleAuth()
      }
    }
  }, [])

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log('Google Login Success:', tokenResponse)
      setGoogleAccessToken(tokenResponse.access_token)

      // Calculate token expiry (Google tokens typically last 1 hour)
      const expiryTime = Date.now() + (tokenResponse.expires_in || 3600) * 1000

      // Save to localStorage
      localStorage.setItem('google_access_token', tokenResponse.access_token)
      localStorage.setItem('google_token_expiry', expiryTime.toString())

      // Fetch user profile
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const userInfo = await res.json()
        setGoogleUser(userInfo)

        // Save user info to localStorage
        localStorage.setItem('google_user', JSON.stringify(userInfo))
      } catch (err) {
        console.error('Failed to fetch Google user info', err)
      }
    },
    onError: error => console.error('Google Login Failed:', error),
    scope: 'https://www.googleapis.com/auth/drive.file',
    // Force the consent screen so the Drive permission is explicitly granted
    // (avoids tokens that silently lack drive.file -> 403 insufficient scopes)
    prompt: 'consent'
  });

  const handleLogout = () => {
    clearGoogleAuth()
  }

  useEffect(() => {
    // 检查是否已有数据
    db.hasData().then(result => {
      console.log('hasData result:', result)
      setHasData(result)
      setLoading(false)
    }).catch(error => {
      console.error('Error checking data:', error)
      // 如果检查失败，假设没有数据
      setHasData(false)
      setLoading(false)
    })
  }, [])

  // Handle opening post from location state (when redirected from /post/:id on desktop)
  useEffect(() => {
    const state = location.state as { openPostId?: string } | null
    if (state?.openPostId && window.innerWidth >= 1024) {
      setSelectedPostId(state.openPostId)
      // Clear the state to prevent reopening on future navigations
      navigate(location.pathname + location.search, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, location.search, navigate])

  const handleUploadComplete = () => {
    setHasData(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mastodon-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-mastodon-primary mx-auto" />
          <p className="mt-4 text-mastodon-text-secondary">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="min-h-screen bg-mastodon-bg text-mastodon-text-primary">
         {/* Language toggle */}
         <div className="absolute top-4 right-4 z-20">
           <button
             onClick={toggleLanguage}
             className="flex items-center gap-1.5 px-3 py-1.5 text-mastodon-text-secondary hover:text-white hover:bg-white/10 rounded-full text-sm transition-colors cursor-pointer"
           >
             <Languages className="w-4 h-4" />
             <span>{i18n.language.startsWith('zh') ? 'English' : '中文'}</span>
           </button>
         </div>

         {/* Hero banner section - full width on mobile, capped on desktop */}
         <div className="relative w-full mb-4 md:max-w-4xl mx-auto overflow-hidden">
           {/* Side gradient fades to blend with background */}
           <div className="absolute inset-y-0 left-0 w-16 md:w-32 z-10" style={{ background: 'linear-gradient(to right, #191b22, transparent)' }} />
           <div className="absolute inset-y-0 right-0 w-16 md:w-32 z-10" style={{ background: 'linear-gradient(to left, #191b22, transparent)' }} />
           {/* Bottom gradient */}
           <div className="absolute inset-x-0 bottom-0 h-2/3 z-10" style={{ background: 'linear-gradient(to top, #191b22 15%, transparent)' }} />

           <img
             src={bannerImg}
             alt="Pastodon Banner"
             className="w-full h-auto opacity-80"
           />

           {/* Branding overlaid on banner */}
           <div className="absolute inset-x-0 bottom-4 md:bottom-8 z-20 text-center flex flex-col items-center">
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">Pastodon</h1>
              <p className="text-sm md:text-xl text-mastodon-text-secondary font-medium mt-1 md:mt-2 drop-shadow-md">{t('common.archive_viewer')}</p>
           </div>
         </div>

         <div className="relative z-30 -mt-4">
            <UploadZone
                onUploadComplete={handleUploadComplete}
                googleUser={googleUser}
                googleLogin={googleLogin}
                googleAccessToken={googleAccessToken}
            />
         </div>

         {/* Footer */}
         <footer className="w-full py-6 border-t border-mastodon-border/10 mt-12">
            <div className="max-w-4xl mx-auto px-4 text-center space-y-2 text-sm text-mastodon-text-secondary/60">
               <p>Made by 🐻‍❄️ with ❤️ for the Fediverse community</p>
               <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-1 text-mastodon-text-tertiary/50">
                  <a href="https://github.com/Gnblink0/MastodonArchiveProject" target="_blank" rel="noopener noreferrer" className="hover:text-mastodon-primary transition-colors underline underline-offset-2">
                    Open Source on GitHub
                  </a>
                  <span className="hidden sm:inline mx-1">•</span>
                  <span>© {new Date().getFullYear()} Pastodon Project</span>
               </div>
            </div>
         </footer>
      </div>
    )
  }

  const handlePostClick = (postId: string) => {
    // On mobile, navigate to thread page; on desktop, show in right sidebar
    if (window.innerWidth < 1024) { // lg breakpoint
      navigate(`/post/${postId}`, {
        state: { from: location.pathname + location.search }
      })
    } else {
      setSelectedPostId(postId)
    }
  }

  const leftSidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-0 pb-6 cursor-pointer flex flex-col items-start" onClick={() => { navigate('/'); setMobileMenuOpen(false) }}>
         <img src={headerLogo} alt="Pastodon Logo" className="w-40 h-40 object-contain" />
         <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white tracking-tight leading-none">Pastodon</h1>
            <p className="text-[10px] text-mastodon-text-secondary uppercase tracking-[0.12em] font-bold">{t('common.archive_viewer')}</p>
         </div>
      </div>

      <nav className="flex flex-col space-y-1 px-3 flex-1 overflow-y-auto hide-scrollbar">
         <button
           onClick={() => { navigate('/'); setSelectedPostId(undefined); setMobileMenuOpen(false) }}
           className="flex items-center gap-4 px-4 py-2.5 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
         >
           <Home className="w-5 h-5" />
           <span className="text-base">{t('nav.home')}</span>
         </button>

         <button 
            onClick={() => { navigate('/stats'); setMobileMenuOpen(false) }}
            className="flex items-center gap-4 px-4 py-2.5 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
         >
            <BarChart3 className="w-5 h-5" />
            <span className="text-base">{t('nav.stats')}</span>
         </button>

         <button
            onClick={() => { navigate('/accounts'); setMobileMenuOpen(false) }}
            className="flex items-center gap-4 px-4 py-2.5 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
         >
            <Users className="w-5 h-5" />
            <span className="text-base">{t('nav.accounts')}</span>
         </button>


         <button 
            onClick={() => { navigate('/favourites'); setMobileMenuOpen(false) }}
            className="flex items-center gap-4 px-4 py-2.5 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
         >
            <Star className="w-5 h-5" />
            <span className="text-base">{t('nav.favourites')}</span>
         </button>

         <button 
            onClick={() => { navigate('/bookmarks'); setMobileMenuOpen(false) }}
            className="flex items-center gap-4 px-4 py-2.5 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
         >
            <Bookmark className="w-5 h-5" />
            <span className="text-base">{t('nav.bookmarks')}</span>
         </button>

         <button
            onClick={() => { navigate('/memories'); setMobileMenuOpen(false) }}
            className="flex items-center gap-4 px-4 py-2.5 text-mastodon-text-primary font-medium hover:bg-mastodon-surface hover:text-mastodon-primary transition-colors rounded-full cursor-pointer"
         >
            <History className="w-5 h-5" />
            <span className="text-base">{t('nav.memories')}</span>
         </button>

      </nav>

      <div className="px-6 pt-4 pb-6 mt-auto border-t border-mastodon-border/50">
        <button
          onClick={toggleLanguage}
          className="flex items-center justify-center gap-2 w-full py-2 mb-2 text-mastodon-text-primary hover:bg-white/5 rounded-lg text-sm transition-colors cursor-pointer"
        >
          <Languages className="w-4 h-4" />
          <span>{i18n.language.startsWith('zh') ? 'English' : '中文'}</span>
        </button>

        {googleAccessToken ? (
          <div className="flex items-center justify-between py-1 text-mastodon-text-secondary text-xs mb-2">
            <span className="truncate">{t('nav.logged_in_as', { name: googleUser?.name || 'User' })}</span>
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 flex items-center gap-1.5 cursor-pointer ml-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-xs">{t('nav.logout')}</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => googleLogin()}
            className="flex items-center justify-center gap-2 w-full py-2 mb-2 text-mastodon-primary hover:text-mastodon-primary/80 hover:bg-white/5 rounded-lg text-sm transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{t('nav.login')}</span>
          </button>
        )}

        <button
           onClick={async () => {
             if (confirm(t('common.confirm_clear_all'))) {
               await db.clearAll()
               setHasData(false)
               navigate('/')
               setMobileMenuOpen(false)
             }
           }}
           className="flex items-center justify-center gap-2 w-full py-2 text-mastodon-text-tertiary hover:text-red-400 hover:bg-white/5 rounded-lg text-sm transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>{t('nav.clear_data')}</span>
        </button>
      </div>
    </div>
  )

  return (
    <AccountFilterProvider>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div className={`fixed top-0 left-0 h-[100dvh] w-[280px] bg-mastodon-bg z-50 transform transition-transform duration-300 md:hidden flex flex-col ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Floating close button - no dedicated bar, so content starts at the top */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
          className="absolute top-3 right-3 z-10 text-mastodon-text-secondary hover:text-white transition-colors cursor-pointer p-1"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Render content with scrolling */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-3 pb-safe">
           {leftSidebarContent}
        </div>
      </div>



      <MainLayout
        leftSidebar={leftSidebarContent}
        rightSidebar={
           ['/stats', '/profile', '/favourites', '/bookmarks', '/accounts'].includes(location.pathname) || location.pathname.startsWith('/account/') ? undefined : (
             selectedPostId ? (
                <ThreadView
                  postId={selectedPostId}
                  onClose={() => setSelectedPostId(undefined)}
              />
           ) : (
              <div className="flex items-center justify-center h-full text-mastodon-text-secondary">
                 <div className="text-center p-8">
                    <p className="mb-2">{t('common.select_post')}</p>
                 </div>
              </div>
           )
        )
      }
      >
        <Routes>
           <Route path="/" element={<Timeline onPostClick={handlePostClick} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />} />
           <Route path="/post/:id" element={<PostRouteHandler />} />
           <Route path="/stats" element={<StatsPage onMobileMenuToggle={() => setMobileMenuOpen(true)} />} />
           <Route path="/accounts" element={<AccountsPage googleUser={googleUser} googleLogin={googleLogin} googleAccessToken={googleAccessToken} onMobileMenuToggle={() => setMobileMenuOpen(true)} />} />
           <Route path="/account/*" element={<AccountDetailPage onMobileMenuToggle={() => setMobileMenuOpen(true)} />} />
           <Route path="/profile" element={<ProfilePage />} />
           <Route path="/favourites" element={<InteractionsPage type="likes" onMobileMenuToggle={() => setMobileMenuOpen(true)} />} />
           <Route path="/bookmarks" element={<InteractionsPage type="bookmarks" onMobileMenuToggle={() => setMobileMenuOpen(true)} />} />
           <Route path="/memories" element={<MemoriesPage onPostClick={handlePostClick} onMobileMenuToggle={() => setMobileMenuOpen(true)} />} />
           <Route path="/debug" element={<DebugDashboard />} />
        </Routes>
      </MainLayout>
    </AccountFilterProvider>
  )
}

export default App
