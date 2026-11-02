// Originate top-level tabs — underline style, URL-synced.
// [ Applications Across Channels ]  [ Decision Record ]
// Active tab: 2px bottom border in primary (var(--teal)), 200ms ease-out

import { useCallback } from 'react'
import { UNDERLINE_TABS, FADE_IN } from './lib/classes'
import { useOriginateUrlState } from './hooks/useUrlState'

const TABS = [
  { key: 'applications', label: 'Applications Across Channels' },
  { key: 'decisions', label: 'Decision Record' },
]

export function OriginateTabs({ children }) {
  const [url, setUrl] = useOriginateUrlState()
  const activeTab = url.tab || 'applications'

  const handleTabChange = useCallback((tabKey) => {
    setUrl({ tab: tabKey })
  }, [setUrl])

  return (
    <div>
      <div className={UNDERLINE_TABS} role="tablist" aria-label="Originate sections">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => handleTabChange(tab.key)}
            className="px-4 py-2 text-sm font-medium transition-all duration-200 ease-out"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={`mt-8 ${FADE_IN}`} role="tabpanel">
        {children(activeTab)}
      </div>
    </div>
  )
}