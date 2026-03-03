import type { ReactNode } from 'react'

interface MainLayoutProps {
  children: ReactNode
  leftSidebar?: ReactNode
  rightSidebar?: ReactNode
}

export function MainLayout({ children, leftSidebar, rightSidebar }: MainLayoutProps) {
  return (
    <div className="h-screen bg-mastodon-bg text-mastodon-text-primary overflow-hidden flex flex-col">
      <div className="w-full h-full flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* Left Sidebar - Navigation & User Info */}
          <aside className="hidden md:flex w-[280px] lg:w-[320px] flex-col py-4 border-r border-mastodon-border h-full overflow-y-auto shrink-0 bg-mastodon-bg/50">
            <div className="w-full h-full flex flex-col">
              {leftSidebar}
            </div>
          </aside>

          {/* Main Content - Timeline */}
          <main className="flex-1 bg-mastodon-bg h-full overflow-y-auto min-w-0 relative">
            {children}
          </main>

          {/* Right Sidebar - Thread View / Context */}
          {rightSidebar && (
            <aside className="hidden lg:flex w-[400px] xl:w-[500px] border-l border-mastodon-border flex-col h-full overflow-y-auto shrink-0">
              {rightSidebar}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
