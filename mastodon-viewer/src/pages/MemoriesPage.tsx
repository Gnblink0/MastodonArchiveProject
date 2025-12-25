import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Loader2, ChevronLeft, ChevronRight, X, Undo2 } from 'lucide-react'
import { db } from '../lib/db'
import type { Post } from '../types'
import { PostCard } from '../components/Timeline/PostCard'
import { useAccountFilter } from '../contexts/AccountFilterContext'

// --- 日历辅助逻辑 ---

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

// ★ 新增：定义组件接收的参数类型
interface MemoriesPageProps {
  onPostClick?: (postId: string) => void
}

// ★ 修改：接收 onPostClick 参数
export function MemoriesPage({ onPostClick }: MemoriesPageProps) {
  const navigate = useNavigate()
  const { selectedAccountId } = useAccountFilter()
  
  // ★ 新增：滚动的容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // 核心状态
  const [targetDate, setTargetDate] = useState(new Date())
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  
  // 数据状态
  const [loading, setLoading] = useState(true)
  const [memories, setMemories] = useState<Record<number, Post[]>>({})
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  
  // 派生状态
  const currentYear = new Date().getFullYear(); 
  const currentMonth = targetDate.getMonth()
  const currentDate = targetDate.getDate()
  
  const isToday = useMemo(() => {
    const today = new Date();
    return today.getMonth() === currentMonth && today.getDate() === currentDate;
  }, [currentMonth, currentDate]);

  const dateTitle = targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  // ★ 修复 Bug 1：监听 selectedYear 变化，强制滚动容器回到顶部
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [selectedYear]);

  // --- 加载数据 ---
  useEffect(() => {
    const loadMemories = async () => {
      setLoading(true)
      try {
        // 优化：不再使用 toArray() 一次性加载所有数据
        // 而是使用 each() 逐条扫描，大大降低内存占用
        const matchedPosts: Post[] = []
        
        // 定义筛选逻辑函数
        const filterPost = (post: Post) => {
          const d = new Date(post.publishedAt)
          // 核心逻辑：只匹配月和日
          if (d.getMonth() === currentMonth && d.getDate() === currentDate) {
            matchedPosts.push(post)
          }
        }

        if (selectedAccountId) {
          // 如果选了账号，就在该账号范围内遍历
          await db.posts.where('accountId').equals(selectedAccountId).each(filterPost)
        } else {
          // 否则遍历全表
          await db.posts.each(filterPost)
        }

        // --- 以下逻辑保持不变 ---
        
        const grouped: Record<number, Post[]> = {}
        matchedPosts.forEach(post => {
          const year = new Date(post.publishedAt).getFullYear()
          if (!grouped[year]) grouped[year] = []
          grouped[year].push(post)
        })

        Object.keys(grouped).forEach(yearKey => {
          grouped[parseInt(yearKey)].sort((a, b) => b.timestamp - a.timestamp)
        })

        const years = Object.keys(grouped)
          .map(y => parseInt(y))
          .sort((a, b) => b - a)

        setMemories(grouped)
        setAvailableYears(years)
        
        if (years.length > 0) {
          if (!selectedYear || !years.includes(selectedYear)) {
            setSelectedYear(years[0])
          }
        } else {
          setSelectedYear(null)
        }

      } catch (error) {
        console.error('Failed to load memories:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMemories()
  }, [selectedAccountId, currentMonth, currentDate])

  // --- 交互操作 ---

  const shiftDate = (days: number) => {
    const newDate = new Date(targetDate)
    newDate.setDate(newDate.getDate() + days)
    setTargetDate(newDate)
  }

  const jumpToDate = (monthIndex: number, day: number) => {
    const newDate = new Date(targetDate)
    newDate.setFullYear(currentYear)
    newDate.setMonth(monthIndex)
    newDate.setDate(day)
    setTargetDate(newDate)
    setIsPickerOpen(false)
  }
  
  const jumpToToday = () => {
    setTargetDate(new Date())
    setIsPickerOpen(false)
  }

  const calendarGrid = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    return [...blanks, ...days];
  }, [currentYear, currentMonth]);

  // ★ 布局重构：
  // 1. 外层使用 h-full 和 overflow-y-auto，让它成为真正的滚动容器
  // 2. 绑定 ref={scrollContainerRef}
  return (
    <div 
      ref={scrollContainerRef}
      className="h-full overflow-y-auto max-w-2xl mx-auto relative scroll-smooth"
    >
      
      {/* 日历弹窗 (Modal) */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsPickerOpen(false)}>
          <div className="bg-mastodon-surface border border-mastodon-border rounded-2xl w-full max-w-[340px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-mastodon-border bg-mastodon-bg/50">
              <div>
                <h3 className="text-white font-bold text-lg">Select Date</h3>
                <p className="text-xs text-mastodon-text-tertiary">Based on year {currentYear}</p>
              </div>
              <button onClick={() => setIsPickerOpen(false)} className="p-1 rounded-full hover:bg-white/10 text-mastodon-text-secondary hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto">
              <div className="grid grid-cols-4 gap-2 mb-6">
                {MONTHS.map((m, idx) => (
                  <button
                    key={m}
                    onClick={() => {
                      const newDate = new Date(targetDate);
                      newDate.setMonth(idx);
                      if (newDate.getDate() > 28) newDate.setDate(1); 
                      setTargetDate(newDate);
                    }}
                    className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                      currentMonth === idx 
                      ? 'bg-mastodon-primary text-white shadow-md' 
                      : 'bg-mastodon-bg text-mastodon-text-secondary hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                {WEEKDAYS.map(d => (
                  <span key={d} className="text-[10px] font-bold text-mastodon-text-tertiary uppercase tracking-wider">
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarGrid.map((d, i) => (
                  <div key={i} className="aspect-square">
                    {d !== null ? (
                      <button
                        onClick={() => jumpToDate(currentMonth, d)}
                        className={`w-full h-full flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                          currentDate === d 
                          ? 'bg-mastodon-primary text-white shadow-lg shadow-mastodon-primary/30 scale-105 font-bold' 
                          : 'bg-mastodon-bg text-mastodon-text-secondary hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {d}
                      </button>
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Header Container */}
      {/* 注意：因为外层现在是滚动容器，这里的 sticky 会相对于外层生效，完美保留吸顶效果 */}
      <div className="sticky top-0 z-20 bg-mastodon-bg/95 backdrop-blur-md border-b border-mastodon-border">
        
        <header className="px-4 py-3 border-b border-mastodon-border/50">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate(-1)} 
                  className="md:hidden text-mastodon-text-secondary hover:text-white p-1"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-3">
                    <div>
                      <span className="block text-[10px] text-mastodon-text-tertiary font-bold tracking-widest uppercase leading-none mb-0.5">
                        On This Day
                      </span>
                      <h1 className="text-xl font-bold text-white leading-none">
                        {dateTitle}
                      </h1>
                    </div>

                    {!isToday && (
                      <button 
                        onClick={jumpToToday}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-mastodon-primary/10 hover:bg-mastodon-primary/20 text-mastodon-primary text-xs font-bold rounded-full transition-colors group ml-1"
                        title="Back to Today"
                      >
                        <Undo2 className="w-3.5 h-3.5 group-hover:-rotate-45 transition-transform duration-300" />
                        TODAY
                      </button>
                    )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                    onClick={() => setIsPickerOpen(true)}
                    className={`p-2 rounded-lg transition-colors border border-transparent ${isPickerOpen ? 'bg-mastodon-primary text-white' : 'bg-mastodon-surface text-mastodon-text-secondary hover:text-white hover:bg-white/10 hover:border-mastodon-border'}`}
                    title="Pick a Date"
                  >
                    <Calendar className="w-5 h-5" />
                </button>

                <div className="flex items-center bg-mastodon-surface rounded-lg p-0.5 border border-mastodon-border">
                  <button 
                    onClick={() => shiftDate(-1)}
                    className="p-1.5 text-mastodon-text-secondary hover:text-white hover:bg-white/10 rounded-md transition-colors"
                    title="Previous Day"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="w-px h-4 bg-mastodon-border/50 mx-0.5"></div>
                  <button 
                    onClick={() => shiftDate(1)}
                    className="p-1.5 text-mastodon-text-secondary hover:text-white hover:bg-white/10 rounded-md transition-colors"
                    title="Next Day"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
          </div>
        </header>

        {!loading && availableYears.length > 0 && (
          <div className="overflow-x-auto hide-scrollbar">
            <div className="flex px-4 gap-2 py-3">
              {availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`
                    px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap
                    ${selectedYear === year 
                      ? 'bg-mastodon-primary text-white shadow-md shadow-mastodon-primary/20 scale-105' 
                      : 'bg-mastodon-surface text-mastodon-text-secondary hover:bg-mastodon-surface/80 hover:text-white'}
                  `}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-mastodon-primary" />
          </div>
        ) : availableYears.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div className="w-20 h-20 bg-mastodon-surface rounded-full flex items-center justify-center mb-6 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-mastodon-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Calendar className="w-10 h-10 text-mastodon-text-secondary/50 group-hover:text-mastodon-primary transition-colors" />
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">No memories found</h3>
            <p className="text-mastodon-text-secondary max-w-sm mb-8 leading-relaxed">
              Nothing in your archive for <span className="text-mastodon-primary font-medium">{dateTitle}</span>.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => shiftDate(-1)}
                className="px-5 py-2.5 bg-mastodon-surface border border-mastodon-border rounded-full text-sm font-medium text-white hover:border-mastodon-primary transition-all hover:shadow-lg hover:shadow-mastodon-primary/10"
              >
                Check Yesterday
              </button>
              <button 
                onClick={() => setIsPickerOpen(true)}
                className="px-5 py-2.5 bg-mastodon-primary text-white rounded-full text-sm font-medium hover:bg-mastodon-primary-hover transition-colors shadow-lg shadow-mastodon-primary/20"
              >
                Pick a Date
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-4 space-y-4">
               {/* ★ 修复 Bug 2：将 onPostClick 绑定到 PostCard 上 */}
               {selectedYear && memories[selectedYear]?.map(post => (
                 <PostCard 
                    key={post.id} 
                    post={post} 
                    onClick={() => onPostClick && onPostClick(post.id)}
                 />
               ))}
               
               <div className="text-center py-12">
                  <p className="text-mastodon-text-tertiary text-xs uppercase tracking-widest">
                    End of {selectedYear}
                  </p>
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}