import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

export interface TimelineMonth {
  month: number // 0-11 (Date.getMonth())
  monthLabel: string // "11月"
  count: number
  latestPostTimestamp: number // 该月最新的帖子时间戳（用于跳转）
  monthKey: string // "2023-11" for matching
}

export interface TimelineYear {
  year: number
  yearLabel: string // "2021年"
  months: TimelineMonth[]
}

export function useTimelineIndex(): TimelineYear[] {
  // 查询所有帖子
  const allPosts = useLiveQuery(() => db.posts.toArray(), [])

  // 按年月分组
  const timelineIndex = useMemo(() => {
    if (!allPosts || allPosts.length === 0) {
      return []
    }

    // 使用 Map 来组织数据: year -> month -> { count, latestTimestamp }
    const yearMonthMap = new Map<number, Map<number, { count: number; latestTimestamp: number }>>()

    // 遍历所有帖子
    allPosts.forEach(post => {
      const date = new Date(post.publishedAt)
      const year = date.getFullYear()
      const month = date.getMonth() // 0-11

      // 初始化年份
      if (!yearMonthMap.has(year)) {
        yearMonthMap.set(year, new Map())
      }

      const monthMap = yearMonthMap.get(year)!

      // 初始化月份
      if (!monthMap.has(month)) {
        monthMap.set(month, {
          count: 0,
          latestTimestamp: post.timestamp
        })
      }

      const monthData = monthMap.get(month)!
      monthData.count++

      // 保持最新的帖子时间戳（最大的时间戳）
      if (post.timestamp > monthData.latestTimestamp) {
        monthData.latestTimestamp = post.timestamp
      }
    })

    // 转换为数组结构并排序
    const result: TimelineYear[] = Array.from(yearMonthMap.entries())
      .map(([year, monthMap]) => {
        const months: TimelineMonth[] = Array.from(monthMap.entries())
          .map(([month, data]) => ({
            month,
            monthLabel: `${month + 1}月`, // 1月, 2月, ..., 12月
            count: data.count,
            latestPostTimestamp: data.latestTimestamp,
            monthKey: `${year}-${String(month + 1).padStart(2, '0')}` // "2023-01"
          }))
          .sort((a, b) => b.month - a.month) // 月份降序（12月在前）

        return {
          year,
          yearLabel: `${year}年`,
          months
        }
      })
      .sort((a, b) => b.year - a.year) // 年份降序（最新年份在前）

    return result
  }, [allPosts])

  return timelineIndex
}
