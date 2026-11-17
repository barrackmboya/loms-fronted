// Originate page shell — fixed left nav rail, header, content area.
// Nav rail replaces the old horizontal tab bar and channel sub-tabs.
//
// ApplicationsTab is now self-contained: it loads its own list from
// GET /api/origination/loanapplication/. OriginatePage only owns tab/action/
// channel URL state and the New Application dialog.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOriginateUrlState } from './hooks/useUrlState'
import { ApplicationsTab } from './ApplicationsTab'
import { DecisionRecordTab } from './components/DecisionRecordTab'
import NewApplicationDialog from './components/NewApplicationDialog'
import { NavRail } from './components/NavRail'
import { FADE_IN } from './lib/classes'

export function OriginatePage() {
  const [url, setUrl] = useOriginateUrlState()
  const applicationsTabRef = useRef(null)

  // Collapse state persisted in localStorage
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('originate-rail-collapsed') === 'true'
    }
    return false
  })

  const handleToggleCollapsed = useCallback(() => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('originate-rail-collapsed', String(next))
  }, [collapsed])

  // Active state derived from URL (same as before)
  const activeTab = url.tab || 'applications'
  const activeChannel = url.channel || ''
  const action = url.action

  // Handlers passed to NavRail (same semantics as old tabs)
  const handleTabChange = useCallback((tab) => {
    setUrl({ tab })
  }, [setUrl])

  const handleChannelChange = useCallback((channel) => {
    setUrl({ channel })
  }, [setUrl])

  // Dialog state for the New Application dialog
  const [dialogOpen, setDialogOpen] = useState(false)

  // Sync dialog open state with URL action param
  useEffect(() => {
    setDialogOpen(action === 'apply')
  }, [action])

  // Close dialog and clear the action URL param
  const handleDialogClose = useCallback(() => {
    setDialogOpen(false)
    setUrl({ action: undefined })
  }, [setUrl])

  // Switch to the Decision Record tab after a successful run decision
  const handleDecisionComplete = useCallback(() => {
    setUrl({ tab: 'decisions' })
  }, [setUrl])

  return (
    <div className="originate-shell">
      {/* Fixed left nav rail */}
      <NavRail
        activeTab={activeTab}
        activeChannel={activeChannel}
        onTabChange={handleTabChange}
        onChannelChange={handleChannelChange}
        collapsed={collapsed}
        onToggleCollapsed={handleToggleCollapsed}
      />

      {/* Content area — right of rail, single scroll container */}
      <div className={`originate-content ${collapsed ? 'is-collapsed' : ''}`}
      style={{ overflowY: 'auto', backgroundColor: 'rgba(255, 255, 255, 0.92)' }}>
        {/* Page header — directly on content background */}
        <header className="space-y-1 mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground font-sans">
            Origination
          </h1>
          {/* <p className="text-sm text-muted-foreground font-sans">
            All applications across channels
          </p> */}
        </header>

        {/* Tab content — fade in on change */}
        <div className={FADE_IN}>
          {activeTab === 'applications' && (
            <ApplicationsTab
              ref={applicationsTabRef}
              channel={activeChannel}
              onNewApplication={() => setUrl({ action: 'apply' })}
              onDecisionComplete={handleDecisionComplete}
            />
          )}

          {activeTab === 'decisions' && (
            <DecisionRecordTab />
          )}
        </div>

        {/* New Application slide panel */}
        <NewApplicationDialog
          open={dialogOpen}
          onOpenChange={handleDialogClose}
          channel="APP"
          onCreated={() => {
            setUrl({ action: undefined })
            applicationsTabRef.current?.refetch()
          }}
        />
      </div>
    </div>
  )
}
