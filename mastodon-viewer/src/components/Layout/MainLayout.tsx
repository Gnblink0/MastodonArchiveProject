import type { ReactNode } from 'react'

interface MainLayoutProps {
  children: ReactNode
  leftSidebar?: ReactNode
  rightSidebar?: ReactNode
}

export function MainLayout({ children, leftSidebar, rightSidebar }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-mastodon-bg text-mastodon-text-primary overflow-x-hidden">
      <div className="container mx-auto max-w-[1600px] px-0 md:px-4">
        <div className="flex min-h-screen gap-0 md:gap-6">
          {/* Left Sidebar - Navigation & User Info */}
          <aside className="hidden md:flex flex-[1] flex-col py-4 sticky top-0 h-screen overflow-y-auto items-end min-w-[240px] max-w-[320px]">
            <div className="w-full">
              {leftSidebar}
            </div>
          </aside>

          {/* Main Content - Timeline */}
          <main className={`w-full md:border-x border-mastodon-border bg-mastodon-bg min-h-screen min-w-0 ${rightSidebar ? 'md:flex-[2]' : 'md:flex-[4]'}`}>
            {children}
          </main>

          {/* Right Sidebar - Thread View */}
          {rightSidebar && (
            <aside className="hidden lg:flex flex-[2] flex-col sticky top-0 h-screen overflow-y-auto min-w-0">
              {rightSidebar}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
