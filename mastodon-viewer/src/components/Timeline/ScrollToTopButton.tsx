import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'

interface ScrollToTopButtonProps {
  /** Element to scroll (if not provided, uses window) */
  scrollElement?: HTMLElement | null
  /** Minimum scroll distance before showing button */
  showAfter?: number
}

export function ScrollToTopButton({ scrollElement, showAfter = 400 }: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const target = scrollElement || window

    const handleScroll = () => {
      if (scrollElement) {
        setIsVisible(scrollElement.scrollTop > showAfter)
      } else {
        setIsVisible(window.scrollY > showAfter)
      }
    }

    target.addEventListener('scroll', handleScroll)
    handleScroll() // Check initial state

    return () => target.removeEventListener('scroll', handleScroll)
  }, [scrollElement, showAfter])

  const scrollToTop = () => {
    if (scrollElement) {
      scrollElement.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (!isVisible) return null

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-50 p-4 bg-mastodon-primary hover:bg-mastodon-primary-hover text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 cursor-pointer"
      aria-label="Scroll to top"
    >
      <ArrowUp className="w-6 h-6" />
    </button>
  )
}
