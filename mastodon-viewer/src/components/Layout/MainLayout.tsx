import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'

interface MainLayoutProps {
  children: ReactNode
  leftSidebar?: ReactNode
  rightSidebar?: ReactNode
  onMobileMenuToggle?: () => void
}

export function MainLayout({ children, leftSidebar, rightSidebar, onMobileMenuToggle }: MainLayoutProps) {
  return (
    <div className="h-screen bg-mastodon-bg text-mastodon-text-primary overflow-hidden">
      <div className="container mx-auto max-w-[1600px] px-0 md:px-4 h-full">
        <div className="flex h-full gap-0 md:gap-6">
          {/* Left Sidebar - Navigation & User Info */}
          <aside className="hidden md:flex flex-[1] flex-col py-4 sticky top-0 h-full overflow-y-auto min-w-[240px] max-w-[320px]">
            <div className="w-full h-full flex flex-col">
              {leftSidebar}
            </div>
          </aside>

          {/* Main Content - Timeline */}
          <main className={`w-full md:border-x border-mastodon-border bg-mastodon-bg h-full overflow-y-auto min-w-0 ${rightSidebar ? 'md:flex-[2]' : 'md:flex-[4]'}`}>
            {children}
          </main>

          {/* Right Sidebar - Thread View */}
          {rightSidebar && (
            <aside className="hidden lg:flex flex-[2] flex-col sticky top-0 h-full overflow-y-auto min-w-0">
              {rightSidebar}
            </aside>
          )}
        </div>
      </div>

       {/* Global Mobile Menu Button (Floating) - Only shown if provided and usually for non-timeline pages where local search bar button isn't present
           But to be safe and consistent, we can show it or rely on page specific buttons. 
           User requested "add menu button to all pages". 
           Timeline has its own. We can check if `onMobileMenuToggle` is passed. 
           Let's make it fixed at bottom right or top left. Top left might conflict with back buttons or logos.
           Bottom right is standard for FAB.
       */}
      {onMobileMenuToggle && (
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden fixed bottom-6 right-6 p-4 bg-mastodon-primary text-white rounded-full shadow-lg z-50 hover:bg-mastodon-primary/90 transition-colors"
          aria-label="Toggle Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}
