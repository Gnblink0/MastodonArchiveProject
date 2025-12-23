import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

export interface TimelineMonth {
  month: number // 0-11 (Date.getMonth())
  monthLabel: string // "Nov"
  count: number
  latestPostTimestamp: number // Latest post timestamp in this month (for jumping)
  monthKey: string // "2023-11" for matching
}

export interface TimelineYear {
  year: number
  yearLabel: string // "2021"
  months: TimelineMonth[]
}

export function useTimelineIndex(accountId?: string): TimelineYear[] {
  // Query all posts (filtered by account if specified)
  const allPosts = useLiveQuery(async () => {
    if (accountId) {
      return await db.posts.where('accountId').equals(accountId).toArray()
    }
    return await db.posts.toArray()
  }, [accountId])

  // Group by year and month
  const timelineIndex = useMemo(() => {
    if (!allPosts || allPosts.length === 0) {
      return []
    }

    // Month names in English
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Use Map to organize data: year -> month -> { count, latestTimestamp }
    const yearMonthMap = new Map<number, Map<number, { count: number; latestTimestamp: number }>>()

    // Iterate through all posts
    allPosts.forEach(post => {
      const date = new Date(post.publishedAt)
      const year = date.getFullYear()
      const month = date.getMonth() // 0-11

      // Initialize year
      if (!yearMonthMap.has(year)) {
        yearMonthMap.set(year, new Map())
      }

      const monthMap = yearMonthMap.get(year)!

      // Initialize month
      if (!monthMap.has(month)) {
        monthMap.set(month, {
          count: 0,
          latestTimestamp: post.timestamp
        })
      }

      const monthData = monthMap.get(month)!
      monthData.count++

      // Keep the latest post timestamp (maximum timestamp)
      if (post.timestamp > monthData.latestTimestamp) {
        monthData.latestTimestamp = post.timestamp
      }
    })

    // Convert to array structure and sort
    const result: TimelineYear[] = Array.from(yearMonthMap.entries())
      .map(([year, monthMap]) => {
        const months: TimelineMonth[] = Array.from(monthMap.entries())
          .map(([month, data]) => ({
            month,
            monthLabel: monthNames[month], // Jan, Feb, ..., Dec
            count: data.count,
            latestPostTimestamp: data.latestTimestamp,
            monthKey: `${year}-${String(month + 1).padStart(2, '0')}` // "2023-01"
          }))
          .sort((a, b) => b.month - a.month) // Sort months descending (Dec first)

        return {
          year,
          yearLabel: `${year}`,
          months
        }
      })
      .sort((a, b) => b.year - a.year) // Sort years descending (most recent first)

    return result
  }, [allPosts])

  return timelineIndex
}
