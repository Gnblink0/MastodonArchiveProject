import { X } from 'lucide-react'
import { useTimelineIndex, type TimelineYear } from '../../hooks/useTimelineIndex'

interface TimelineDrawerProps {
  isOpen: boolean
  onClose: () => void
  onMonthSelect: (year: number, month: number) => void
  currentMonth?: string // "2023-11" 格式
}

export function TimelineDrawer({ isOpen, onClose, onMonthSelect, currentMonth }: TimelineDrawerProps) {
  const timelineIndex = useTimelineIndex()

  const handleMonthClick = (year: number, month: number) => {
    onMonthSelect(year, month)

    // Auto-close on mobile (300ms delay to show scroll animation)
    if (window.innerWidth < 768) {
      setTimeout(() => {
        onClose()
      }, 300)
    }
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 cursor-pointer"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[280px] sm:w-[320px] bg-mastodon-bg z-50 transform transition-transform duration-300 shadow-2xl ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header - Title and close button */}
        <div className="flex items-center justify-between p-4 border-b border-mastodon-border">
          <h2 className="text-xl font-semibold text-white">Timeline</h2>
          <button
            onClick={onClose}
            className="text-mastodon-text-secondary hover:text-white transition-colors cursor-pointer"
            aria-label="Close timeline"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body - Year and month list */}
        <div className="overflow-y-auto h-[calc(100%-73px)]">
          {timelineIndex.length === 0 ? (
            <div className="flex items-center justify-center h-full text-mastodon-text-secondary">
              No posts yet
            </div>
          ) : (
            timelineIndex.map((yearData: TimelineYear) => (
              <div key={yearData.year} className="mb-6">
                {/* Year header */}
                <div className="sticky top-0 bg-mastodon-surface px-4 py-2 text-sm font-medium text-mastodon-primary z-10">
                  {yearData.yearLabel}
                </div>

                {/* Month list */}
                <div className="mt-2">
                  {yearData.months.map(month => {
                    const isCurrentMonth = currentMonth === month.monthKey

                    return (
                      <button
                        key={month.monthKey}
                        onClick={() => handleMonthClick(yearData.year, month.month)}
                        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-mastodon-surface/50 transition-colors cursor-pointer ${
                          isCurrentMonth
                            ? 'bg-mastodon-primary/10 border-l-4 border-mastodon-primary'
                            : 'border-l-4 border-transparent'
                        }`}
                      >
                        <span
                          className={`text-2xl font-semibold ${
                            isCurrentMonth ? 'text-mastodon-primary' : 'text-white'
                          }`}
                        >
                          {month.monthLabel}
                        </span>
                        <span className="text-sm text-mastodon-text-secondary">
                          {month.count} {month.count === 1 ? 'post' : 'posts'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
