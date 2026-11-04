// Originate page shell — fixed left nav rail, header, stat strip, content area.
// Nav rail replaces the old horizontal tab bar and channel sub-tabs.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOriginateUrlState } from './hooks/useUrlState'
import { useApplications } from './hooks/useApplications'
import { useStats } from './hooks/useStats'
import { useProducts } from './hooks/useProducts'
import { StatStrip } from './StatStrip'
import { ApplicationsTab } from './ApplicationsTab'
import { DecisionRecordTab } from './components/DecisionRecordTab'
import NewApplicationDialog from './components/NewApplicationDialog'
import { NavRail } from './components/NavRail'
import { FADE_IN } from './lib/classes'

export function OriginatePage() {
  const [url, setUrl] = useOriginateUrlState()

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

  // Handlers passed to NavRail (same semantics as old tabs)
  const handleTabChange = useCallback((tab) => {
    setUrl({ tab })
  }, [setUrl])

  const handleChannelChange = useCallback((channel) => {
    setUrl({ channel })
  }, [setUrl])

  // Fetch applications with current URL filters
  const {
    applications,
    loading: appsLoading,
    error: appsError,
    pagination,
    filters,
    setFilter,
    clearFilters,
    loadPage: goToPage,
    refetch,
    lastRawResponse,
  } = useApplications({
    channel: url.channel,
    search: url.search,
    dateFrom: url.from,
    dateTo: url.to,
    product: url.product,
    sort: url.sort,
  })

  // Dialog state for the New Application dialog
  const [dialogOpen, setDialogOpen] = useState(false)

  // Switch to the Decision Record tab after a successful run decision
  const handleDecisionComplete = useCallback(() => {
    setUrl({ tab: 'decisions' })
  }, [setUrl])

  // Track programmatic URL updates to avoid sync loops
  const isSyncingUrlRef = useRef(false)

  // Sync URL filters to the hook when URL changes (e.g., browser back/forward, initial load)
  // Only call setFilter when the URL value actually differs from the current filter,
  // which breaks the loop with the hook→URL effect below.
  useEffect(() => {
    if (isSyncingUrlRef.current) return
    const nextChannel = url.channel || ''
    const nextSearch = url.search || ''
    const nextDateFrom = url.from || ''
    const nextDateTo = url.to || ''
    const nextProduct = url.product || ''
    const nextSort = url.sort || '-created_at'
    if (filters.channel !== nextChannel) setFilter('channel', nextChannel)
    if (filters.search !== nextSearch) setFilter('search', nextSearch)
    if (filters.dateFrom !== nextDateFrom) setFilter('dateFrom', nextDateFrom)
    if (filters.dateTo !== nextDateTo) setFilter('dateTo', nextDateTo)
    if (filters.product !== nextProduct) setFilter('product', nextProduct)
    if (filters.sort !== nextSort) setFilter('sort', nextSort)
  }, [url, filters, setFilter])

  // Sync hook filters to URL when they change
  // Mark as programmatic update to prevent the above effect from re-syncing
  useEffect(() => {
    const params = {}
    if (filters.channel) params.channel = filters.channel
    if (filters.search) params.search = filters.search
    if (filters.dateFrom) params.from = filters.dateFrom
    if (filters.dateTo) params.to = filters.dateTo
    if (filters.product) params.product = filters.product
    if (filters.sort && filters.sort !== '-created_at') params.sort = filters.sort
    if (pagination.page && pagination.page > 1) params.page = pagination.page
    isSyncingUrlRef.current = true
    setUrl(params, { replace: true })
    // Reset flag after the URL update propagates through the event loop
    setTimeout(() => { isSyncingUrlRef.current = false }, 0)
  }, [filters, pagination.page, setUrl])

  const stats = useStats(applications)
  const products = useProducts(applications)

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
      style={{ overflowY: 'auto',backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255, 255, 255, 0.92)' }}>
        {/* Page header — directly on content background */}
        <header className="space-y-1 mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground font-sans">
            Originatation 
          </h1>
          {/* <p className="text-sm text-muted-foreground font-sans">
            All applications across channels
          </p> */}
        </header>

        {/* Stat strip */}
        <StatStrip stats={stats} loading={appsLoading} />

        {/* Tab content — fade in on change */}
        <div className={FADE_IN}>
          {activeTab === 'applications' && (
            <ApplicationsTab
              applications={applications}
              loading={appsLoading}
              error={appsError}
              pagination={pagination}
              filters={filters}
              setFilter={setFilter}
              clearFilters={clearFilters}
              goToPage={goToPage}
              refetch={refetch}
              products={products}
              onNewApplication={() => setDialogOpen(true)}
              onDecisionComplete={handleDecisionComplete}
            />
          )}

          {activeTab === 'decisions' && (
            <DecisionRecordTab />
          )}
        </div>

        {/* New Application dialog */}
        <NewApplicationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          channel={filters.channel || 'APP'}
          onCreated={() => {
            goToPage(1)
          }}
        />
      </div>
    </div>
  )
}
