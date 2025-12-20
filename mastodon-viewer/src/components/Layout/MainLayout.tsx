import type { ReactNode } from 'react'

interface MainLayoutProps {
  children: ReactNode
  leftSidebar?: ReactNode
  rightSidebar?: ReactNode
}

export function MainLayout({ children, leftSidebar, rightSidebar }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-mastodon-bg text-mastodon-text-primary">
      <div className="container mx-auto max-w-[1280px] px-0 md:px-4">
        <div className="flex justify-center min-h-screen gap-6">
          {/* Left Sidebar - Navigation & User Info */}
          <aside className="hidden md:flex w-[280px] flex-col shrink-0 py-4 sticky top-0 h-screen overflow-y-auto items-end">
            <div className="w-full">
              {leftSidebar}
            </div>
          </aside>

          {/* Main Content - Timeline */}
          <main className="w-full max-w-[600px] shrink-0 border-x border-mastodon-border bg-mastodon-bg min-h-screen">
            {children}
          </main>

          {/* Right Sidebar - Stats */}
          <aside className="hidden lg:flex flex-1 flex-col shrink-0 py-4 sticky top-0 h-screen overflow-y-auto max-w-[350px]">
            {rightSidebar}
          </aside>
        </div>
      </div>
    </div>
  )
}
