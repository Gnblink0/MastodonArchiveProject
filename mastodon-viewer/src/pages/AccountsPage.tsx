import { useState } from 'react'
import { useAccounts } from '../hooks/usePosts'
import { AccountCard } from '../components/Accounts/AccountCard'
import { UploadModal } from '../components/Upload/UploadModal'
import { Users, Upload, Menu } from 'lucide-react'
import { useAccountFilter } from '../contexts/AccountFilterContext'
import { useTranslation } from 'react-i18next'
import type { Account } from '../types'

interface AccountsPageProps {
  googleUser?: any
  googleLogin?: () => void
  googleAccessToken?: string | null
  onMobileMenuToggle?: () => void
}

export function AccountsPage({ googleUser, googleLogin, googleAccessToken, onMobileMenuToggle }: AccountsPageProps) {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const [showUploadModal, setShowUploadModal] = useState(false)
  const { selectedAccountId, setSelectedAccountId } = useAccountFilter()

  // Extract instance domain from account ID
  const getInstanceDomain = (accountId: string): string => {
    try {
      const url = new URL(accountId)
      return url.hostname
    } catch {
      return ''
    }
  }

  const getFullHandle = (account: Account): string => {
    const instanceDomain = getInstanceDomain(account.id)
    return instanceDomain ? `@${account.preferredUsername}@${instanceDomain}` : `@${account.preferredUsername}`
  }

  const handleAddAccount = () => {
    setShowUploadModal(true)
  }

  const handleUploadComplete = () => {
    // 上传完成后，数据会自动刷新（因为使用了 useLiveQuery）
    setShowUploadModal(false)
  }

  const handleAccountSelect = (accountId: string | undefined) => {
    setSelectedAccountId(accountId)
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-mastodon-text-secondary">
        <p>{t('accounts.no_accounts')}</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          {onMobileMenuToggle && (
            <button
              onClick={onMobileMenuToggle}
              className="md:hidden bg-mastodon-surface p-3 rounded-full text-white cursor-pointer"
              aria-label="Toggle Menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-mastodon-primary" />
              <h1 className="text-3xl font-bold text-white">{t('nav.accounts')}</h1>
            </div>
            <p className="text-mastodon-text-secondary">
              {accounts.length > 1 
                ? t('accounts.manage_x_accounts_plural', { count: accounts.length })
                : t('accounts.manage_x_accounts', { count: accounts.length })}
            </p>
          </div>
        </div>

        {/* Global Account Filter */}
        {accounts && accounts.length > 1 && (
          <div className="mb-6 p-4 bg-mastodon-surface rounded-xl border border-mastodon-border">
            <h3 className="text-sm font-medium text-mastodon-text-secondary mb-3">
              {t('accounts.global_filter')}
            </h3>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleAccountSelect(undefined)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  !selectedAccountId
                    ? 'bg-mastodon-primary text-white'
                    : 'bg-mastodon-bg text-mastodon-text-secondary hover:text-white hover:bg-mastodon-bg/80'
                }`}
              >
                <Users className="w-4 h-4" />
                {t('accounts.all_accounts')}
              </button>
              {accounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => handleAccountSelect(account.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                    selectedAccountId === account.id
                      ? 'bg-mastodon-primary text-white'
                      : 'bg-mastodon-bg text-mastodon-text-secondary hover:text-white hover:bg-mastodon-bg/80'
                  }`}
                >
                  {account.avatarUrl && (
                    <img
                      src={account.avatarUrl}
                      alt={account.displayName}
                      className="w-5 h-5 rounded-full"
                    />
                  )}
                  {getFullHandle(account)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Account Cards List (vertical stack) */}
        <div className="space-y-4">
          {accounts.map(account => (
            <AccountCard key={account.id} account={account} />
          ))}

          {/* Add Account Card */}
          <div
            onClick={handleAddAccount}
            className="border-2 border-dashed border-mastodon-border rounded-xl p-6 flex items-center justify-center hover:border-mastodon-primary transition-colors cursor-pointer group"
          >
            <Upload className="w-8 h-8 text-mastodon-text-secondary group-hover:text-mastodon-primary transition-colors mr-3" />
            <p className="text-mastodon-text-secondary group-hover:text-mastodon-primary transition-colors text-lg">
              {t('accounts.import_another')}
            </p>
          </div>
        </div>

        {/* Upload Modal */}
        <UploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={handleUploadComplete}
          googleUser={googleUser}
          googleLogin={googleLogin}
          googleAccessToken={googleAccessToken}
        />
      </div>
    </div>
  )
}
