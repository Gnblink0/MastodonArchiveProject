import { AlertCircle, RefreshCw, Combine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AccountConflict, ImportStrategy } from '../../types'

interface ImportStrategyDialogProps {
  conflict: AccountConflict
  onSelect: (strategy: ImportStrategy) => void
}

export function ImportStrategyDialog({ conflict, onSelect }: ImportStrategyDialogProps) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative bg-mastodon-bg rounded-xl shadow-2xl max-w-2xl w-full mx-4 p-6 border border-mastodon-border">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">
              {t('import_strategy.title')}
            </h2>
            <p className="text-mastodon-text-secondary" dangerouslySetInnerHTML={{ __html: t('import_strategy.desc', { username: conflict.username, displayName: conflict.displayName }) }} />
          </div>
        </div>

        {/* Info */}
        <p className="text-mastodon-text-secondary mb-6">
          {t('import_strategy.question')}
        </p>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Replace Mode */}
          <button
            onClick={() => onSelect('replace')}
            className="group p-6 bg-mastodon-surface border-2 border-mastodon-border hover:border-red-500/50 rounded-lg transition-all text-left cursor-pointer"
          >
            <div className="flex items-start gap-3 mb-3">
              <RefreshCw className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {t('import_strategy.replace_title')}
                </h3>
                <p className="text-sm text-mastodon-text-secondary">
                  {t('import_strategy.replace_desc')}
                </p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300">
              <strong>{t('import_strategy.replace_warning').split(':')[0]}:</strong>{t('import_strategy.replace_warning').split(':')[1]}
            </div>
          </button>

          {/* Merge Mode */}
          <button
            onClick={() => onSelect('merge')}
            className="group p-6 bg-mastodon-surface border-2 border-mastodon-border hover:border-mastodon-primary rounded-lg transition-all text-left cursor-pointer"
          >
            <div className="flex items-start gap-3 mb-3">
              <Combine className="w-6 h-6 text-mastodon-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {t('import_strategy.merge_title')}
                </h3>
                <p className="text-sm text-mastodon-text-secondary">
                  {t('import_strategy.merge_desc')}
                </p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-mastodon-primary/10 border border-mastodon-primary/20 rounded text-xs text-mastodon-text-secondary">
              <strong>{t('import_strategy.merge_smart').split(':')[0]}:</strong>{t('import_strategy.merge_smart').split(':')[1]}
            </div>
          </button>
        </div>

        {/* Additional Info */}
        <div className="text-xs text-mastodon-text-secondary bg-mastodon-surface p-4 rounded-lg">
          <p className="mb-2">
            <strong className="text-white">💡 {t('import_strategy.recommendation')}</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>{t('import_strategy.rec_replace')}</li>
            <li>{t('import_strategy.rec_merge')}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
