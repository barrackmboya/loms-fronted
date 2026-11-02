// Originate page shell — header, stat strip, tabs, content placeholders.
// Phase 3: Page shell and stat strip only.

import { useEffect, useRef } from 'react'
import { useOriginateUrlState } from './hooks/useUrlState'
import { useApplications } from './hooks/useApplications'
import { useStats } from './hooks/useStats'
import { useProducts } from './hooks/useProducts'
import { StatStrip } from './StatStrip'
import { OriginateTabs } from './OriginateTabs'
import { ApplicationsTab } from './ApplicationsTab'

export function OriginatePage() {
  const [url, setUrl] = useOriginateUrlState()

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
    <div className="p-6 space-y-8 max-w-[1200px] mx-auto">
      {/* Page header */}
      <header className="space-y-1">
        {/* <h1 className="text-[28px] font-semibold tracking-tight text-foreground font-sans">
          Originate
        </h1> */}
        <p className="text-sm text-muted-foreground font-sans">
          All applications across channels
        </p>
      </header>

      {/* Stat strip */}
      <StatStrip stats={stats} loading={appsLoading} />

      {/* Top-level tabs */}
      <OriginateTabs>
        {(activeTab) => (
          <>
            {activeTab === 'applications' && (
              <div className="space-y-4">
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
                  setUrlChannel={(channel) => setUrl({ channel }, { replace: false })}
                  products={products}
                  onNewApplication={() => console.log('New Application clicked')}
                />
                {/* Debug info */}
                <details className="text-xs text-muted-foreground">
                  <summary>Debug: URL state</summary>
                  <pre>{JSON.stringify(url, null, 2)}</pre>
                </details>
                <details className="text-xs text-muted-foreground">
                  <summary>Debug: Applications</summary>
                  <pre>{JSON.stringify({ count: applications.length, pagination, filters, lastRawResponse }, null, 2)}</pre>
                </details>
              </div>
            )}
            {activeTab === 'decisions' && (
              <div className="text-center py-12 text-muted-foreground">
                Phase 8: Decision Record table
              </div>
            )}
          </>
        )}
      </OriginateTabs>
    </div>
  )
}