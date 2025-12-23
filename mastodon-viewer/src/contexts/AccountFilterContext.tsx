import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

interface AccountFilterContextType {
  selectedAccountId: string | undefined
  setSelectedAccountId: (accountId: string | undefined) => void
}

const AccountFilterContext = createContext<AccountFilterContextType | undefined>(undefined)

export function AccountFilterProvider({ children }: { children: ReactNode }) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(() => {
    // 从 localStorage 读取保存的筛选
    const saved = localStorage.getItem('global_account_filter')
    return saved || undefined
  })

  // 当筛选变化时保存到 localStorage
  useEffect(() => {
    if (selectedAccountId) {
      localStorage.setItem('global_account_filter', selectedAccountId)
    } else {
      localStorage.removeItem('global_account_filter')
    }
  }, [selectedAccountId])

  return (
    <AccountFilterContext.Provider value={{ selectedAccountId, setSelectedAccountId }}>
      {children}
    </AccountFilterContext.Provider>
  )
}

export function useAccountFilter() {
  const context = useContext(AccountFilterContext)
  if (context === undefined) {
    throw new Error('useAccountFilter must be used within AccountFilterProvider')
  }
  return context
}
