// Applications tab — toolbar, table, pagination.
// Phase 4: Applications table.
// Channel navigation moved to NavRail.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, ChevronUp, Filter, X, Loader2, Plus, AlertCircle, FileText } from 'lucide-react'
import { Skeleton } from '../../components/ui/skeleton'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '../../components/ui/empty'
import { Badge } from '../../components/ui/badge'
import { SlidePanel } from './components/SlidePanel'
import { Tooltip } from './components/Tooltip'
import { ViewApplicationContent } from './components/ViewApplicationContent'
import { useDebounce } from './hooks/useDebounce'
import { formatDate, formatCurrency } from '../../lib/format'
import { ROW_STAGGER, FADE_IN, BUTTON_HOVER_LIFT, ROW_FLASH_SUCCESS } from './lib/classes'
import { api } from '../../lib/api'
import { decisionStore } from './lib/decisionStore'
import { toast } from 'sonner'

const SORT_OPTIONS = [
  { value: '-created_at', label: 'Application Date (newest)' },
  { value: 'created_at', label: 'Application Date (oldest)' },
  { value: '-amount_requested', label: 'Amount (highest)' },
  { value: 'amount_requested', label: 'Amount (lowest)' },
  { value: '-name', label: 'Name (Z–A)' },
  { value: 'name', label: 'Name (A–Z)' },
]

const PAGE_SIZE = 20

export function ApplicationsTab({
  applications,
  loading,
  error,
  pagination,
  filters,
  setFilter,
  clearFilters,
  goToPage,
  refetch,
  products,
  onNewApplication,
  onDecisionComplete,
}) {
  const [localError, setLocalError] = useState(null)
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search || '')
  const [showDateFrom, setShowDateFrom] = useState(false)
  const [showDateTo, setShowDateTo] = useState(false)
  const tableBodyRef = useRef(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  // Guard against inconsistent state: API reports count > 0 but returns no data on page 1.
  // Auto-refetch (up to 3 times) with cache bypass to recover from transient empty-data responses.
  const [emptyRefetchAttempts, setEmptyRefetchAttempts] = useState(0)
  // Track in-flight decision requests per application ID (per-row disable)
  const [running, setRunning] = useState(new Set())
  // ID of the application currently being viewed in the detail dialog
  const [viewAppId, setViewAppId] = useState(null)
  
  // Debounce search input (250ms)
  const debouncedSearchValue = useDebounce(debouncedSearch, 250)

  // Sync debounced search to URL filter
  useEffect(() => {
    if (debouncedSearchValue !== filters.search) {
      setFilter('search', debouncedSearchValue || '')
    }
  }, [debouncedSearchValue, filters.search, setFilter])

  // Reset page to 1 when channel changes
  useEffect(() => {
    if (hasLoadedOnce && pagination.page !== 1) {
      goToPage(1)
    }
  }, [filters.channel, hasLoadedOnce, pagination.page, goToPage])

  // Track initial load for staggered animation
  useEffect(() => {
    if (!loading && hasLoadedOnce) {
      setIsInitialLoad(false)
      // Re-enable stagger on next channel/tab switch
      setTimeout(() => setIsInitialLoad(true), 0)
    }
    if (!loading && !hasLoadedOnce) {
      setHasLoadedOnce(true)
    }
  }, [loading, hasLoadedOnce])

  // Auto-refetch when the API reports records exist but page 1 returned no data.
  // Bypasses the cache (forceRefresh) to get a fresh response. Capped at 3 attempts
  // to avoid a loop if the backend consistently returns empty data for page 1.
  useEffect(() => {
    if (
      pagination.count > 0 &&
      applications.length === 0 &&
      !loading &&
      !error &&
      !localError &&
      emptyRefetchAttempts < 3
    ) {
      setEmptyRefetchAttempts((prev) => prev + 1)
      refetch()
    }
  }, [pagination.count, applications.length, loading, error, localError, refetch, emptyRefetchAttempts])

  // Handle search input change (local state, debounced)
  const handleSearchChange = useCallback((e) => {
    setDebouncedSearch(e.target.value)
  }, [])

  // Handle date filter changes
  const handleDateFromChange = useCallback((e) => {
    setFilter('dateFrom', e.target.value)
  }, [setFilter])

  const handleDateToChange = useCallback((e) => {
    setFilter('dateTo', e.target.value)
  }, [setFilter])

  // Handle product filter change
  const handleProductChange = useCallback((e) => {
    setFilter('product', e.target.value)
  }, [setFilter])

  // Handle sort change
  const handleSortChange = useCallback((e) => {
    setFilter('sort', e.target.value)
  }, [setFilter])

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    clearFilters()
    setDebouncedSearch('')
  }, [clearFilters])

  // Handle retry
  const handleRetry = useCallback(() => {
    setLocalError(null)
    refetch()
  }, [refetch])

  // Run decision for a single application — per-row in-flight tracking
  const handleRunDecision = useCallback(async (id, app) => {
    if (running.has(id)) return
    setRunning((prev) => new Set([...prev, id]))
    try {
      const response = await api.decide(id)
      toast.success("Decision completed successfully")
      decisionStore.add({
        id: response.decision_id,
        applicationId: id,
        applicantName: app.name,
        channel: app.channel,
        decision: response.decision,
        grade: response.grade,
        pd_12m: response.pd_12m,
        runDate: response.as_of_ts,
        fullResponse: response,
      })
      // Flash the row on success via DOM manipulation (inline style would
      // override the CSS animation, so toggle the class directly on the node).
      const row = document.querySelector(`tr[data-app-id="${id}"]`)
      if (row) {
        row.classList.add(ROW_FLASH_SUCCESS)
        setTimeout(() => {
          row.classList.remove(ROW_FLASH_SUCCESS)
          onDecisionComplete?.()
        }, 600)
      } else {
        onDecisionComplete?.()
      }
    } catch (e) {
      toast.error("Decision failed", { description: e.message })
    } finally {
      setRunning((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }, [onDecisionComplete])

  // Check if any filters are active (besides channel and default sort)
  const hasActiveFilters = useMemo(() => {
    return !!(
      debouncedSearchValue ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.product ||
      (filters.sort && filters.sort !== '-created_at')
    )
  }, [debouncedSearchValue, filters])

  // Determine current state
  const isEmpty = !loading && !error && !localError && applications.length === 0 && !hasActiveFilters && pagination.count === 0
  const isNoMatch = !loading && !error && !localError && applications.length === 0 && hasActiveFilters
  const isDataMissing = !loading && !error && !localError && applications.length === 0 && !hasActiveFilters && pagination.count > 0
  const isErrorState = !loading && (error || localError)

  // Format application for display
  const formatApplication = useCallback((app) => ({
    ...app,
    formattedDate: app.createdAt ? formatDate(app.createdAt) : '—',
    formattedAmount: formatCurrency(app.amount),
    formattedTenure: app.tenure ? `${app.tenure} mo` : '—',
    applicantName: app.name || '—',
    productName: app.product || '—',
  }), [])

  const formattedApps = useMemo(() => applications.map(formatApplication), [applications, formatApplication])

  // Application currently open in the View Application slide-in panel.
  const selectedApp = useMemo(() => formattedApps.find((app) => app.id === viewAppId), [formattedApps, viewAppId])

  // Render skeleton rows
  const renderSkeletonRows = () => (
    <tbody className="orig-row-stagger">
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="h-11">
          <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-32" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
          <td className="px-3 py-2 text-right font-mono tabular-nums"><Skeleton className="h-4 w-20 mx-auto" /></td>
          <td className="px-3 py-2 text-right font-mono tabular-nums"><Skeleton className="h-4 w-16 mx-auto" /></td>
          <td className="px-3 py-2"><Skeleton className="h-6 w-24 mx-auto" /></td>
        </tr>
      ))}
    </tbody>
  )

  // Render empty state
  const renderEmptyState = () => (
    <tbody>
      <tr>
        <td colSpan={6} className="py-16">
          <Empty className="w-full">
            <EmptyHeader>
              <EmptyMedia icon={FileText} className="size-12 text-muted-foreground/50" />
              <EmptyTitle className="text-base font-medium text-foreground">No applications yet</EmptyTitle>
              <EmptyDescription className="text-sm text-muted-foreground">
                No applications found for this channel.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <button
                onClick={onNewApplication}
                className={`${BUTTON_HOVER_LIFT} btn`}
              >
                <Plus className="h-4 w-4" />
                New Application
              </button>
            </EmptyContent>
          </Empty>
        </td>
      </tr>
    </tbody>
  )

  // Render no match state
  const renderNoMatchState = () => (
    <tbody>
      <tr>
        <td colSpan={6} className="py-16">
          <Empty className="w-full">
            <EmptyHeader>
              <EmptyMedia icon={Filter} className="size-12 text-muted-foreground/50" />
              <EmptyTitle className="text-base font-medium text-foreground">No matching applications</EmptyTitle>
              <EmptyDescription className="text-sm text-muted-foreground">
                Try adjusting your filters or search terms.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <button
                onClick={handleClearFilters}
                className={`${BUTTON_HOVER_LIFT} btn ghost`}
              >
                <X className="h-4 w-4" />
                Clear filters
              </button>
            </EmptyContent>
          </Empty>
        </td>
      </tr>
    </tbody>
  )

  // Render data-missing state — API reports records exist but page returned no data
  const renderDataMissingState = () => (
    <tbody>
      <tr>
        <td colSpan={6} className="py-16">
          <Empty className="w-full">
            <EmptyHeader>
              <EmptyMedia icon={AlertCircle} className="size-12 text-muted-foreground/50" />
              <EmptyTitle className="text-base font-medium text-foreground">No data on this page</EmptyTitle>
              <EmptyDescription className="text-sm text-muted-foreground">
                Applications exist but none were returned for this page. Reload to try again.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <button
                onClick={handleRetry}
                className={`${BUTTON_HOVER_LIFT} btn`}
              >
                <Loader2 className="h-4 w-4 mr-2" />
                Reload
              </button>
            </EmptyContent>
          </Empty>
        </td>
      </tr>
    </tbody>
  )

  // Render error state
  const renderErrorState = () => (
    <tbody>
      <tr>
        <td colSpan={6} className="py-8">
          <div className="flex flex-col items-center gap-3 text-center p-4 rounded-lg border border-destructive/20 bg-destructive/5">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive font-medium">
              {error?.message || localError || 'Failed to load applications'}
            </p>
            <button
              onClick={handleRetry}
              className={`${BUTTON_HOVER_LIFT} btn`}
            >
              <Loader2 className="h-4 w-4 mr-2" />
              Retry
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  )

  // Render data rows
  const renderDataRows = () => (
    <tbody className={`${isInitialLoad ? ROW_STAGGER : ''}`} ref={tableBodyRef}>
      {formattedApps.map((app, index) => {
        const selected = viewAppId === app.id
        return (
          <tr
            key={app.id}
            data-app-id={app.id}
            className={`h-11 cursor-pointer ${index % 2 === 1 ? 'border-b bg-row-zebra' : ''} ${selected ? 'ring-1 ring-teal/50' : ''}`}
            style={{
              borderLeft: '3px solid transparent',
              paddingLeft: 'calc(0.75rem - 3px)',
              transition: 'all 200ms ease-out',
              backgroundColor: selected ? 'rgba(23, 107, 99, 0.06)' : (index % 2 === 1 ? 'rgba(23, 107, 99, 0.035)' : 'transparent'),
              borderBottom: index % 2 === 1 ? '1px solid rgba(211, 218, 212, 0.5)' : 'none',
              borderLeftColor: selected ? 'var(--teal)' : 'transparent',
            }}
            onClick={() => setViewAppId(app.id)}
            onMouseEnter={(e) => {
              if (selected) return
              e.currentTarget.style.backgroundColor = 'rgba(23, 107, 99, 0.08)'
              e.currentTarget.style.borderLeftColor = 'var(--teal)'
            }}
            onMouseLeave={(e) => {
              if (selected) return
              e.currentTarget.style.backgroundColor = index % 2 === 1 ? 'rgba(23, 107, 99, 0.035)' : 'transparent'
              e.currentTarget.style.borderLeftColor = 'transparent'
            }}
          >
          <td className="px-3 py-2 font-mono text-xs text-foreground">
            {app.formattedDate}
          </td>
          <td className="px-3 py-2 text-foreground">
            {app.applicantName}
          </td>
          <td className="px-3 py-2 text-foreground">
            {app.productName}
          </td>
          <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
            {app.formattedAmount}
          </td>
          <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
            {app.formattedTenure}
          </td>
          <td className="px-3 py-2">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setViewAppId(app.id) }}
                className={`${BUTTON_HOVER_LIFT} btn ghost text-xs px-3 py-1.5`}
                disabled={loading}
              >
                View Application
              </button>
              <Tooltip content="Run the credit decision for this application">
                <button
                  onClick={(e) => { e.stopPropagation(); handleRunDecision(app.id, app) }}
                  disabled={loading || running.has(app.id)}
                  className={`${BUTTON_HOVER_LIFT} btn border border-border bg-transparent text-foreground hover:bg-accent text-xs px-3 py-1.5 ${running.has(app.id) ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {running.has(app.id) ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Running…
                    </>
                  ) : (
                    'Run Decision'
                  )}
                </button>
              </Tooltip>
            </div>
          </td>
        </tr>
      )})}
    </tbody>
  )

  // Render pagination
  const renderPagination = () => {
    if (pagination.count === 0) return null

    const start = (pagination.page - 1) * PAGE_SIZE + 1
    const end = Math.min(pagination.page * PAGE_SIZE, pagination.count)

    return (
      <div className="flex items-center justify-end gap-4 mt-6 pt-4 border-t border-border">
        <div className="text-sm text-muted-foreground font-mono">
          {start}–{end} of {pagination.count}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(pagination.page - 1)}
            disabled={!pagination.hasPrevious || loading}
            className={`${BUTTON_HOVER_LIFT} btn ghost text-sm px-3 py-1.5 disabled:opacity-50`}
          >
            Previous
          </button>
          <button
            onClick={() => goToPage(pagination.page + 1)}
            disabled={!pagination.hasNext || loading}
            className={`${BUTTON_HOVER_LIFT} btn ghost text-sm px-3 py-1.5 disabled:opacity-50`}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Floating card — toolbar + table + pagination */}
      <div className="orig-float-card space-y-4">
        {/* Toolbar */}
        <div className="border-b border-border p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          {/* Search input */}
          <div className="relative flex-1 min-w-0 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name…"
              value={debouncedSearch}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-2 text-sm border border-input bg-background rounded-input focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Search applications by name"
            />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={handleDateFromChange}
              className="w-36 px-2 py-1.5 text-sm border border-input bg-background rounded-input focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Filter from date"
            />
            <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={handleDateToChange}
              className="w-36 px-2 py-1.5 text-sm border border-input bg-background rounded-input focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Filter to date"
            />
          </div>

          {/* Product dropdown */}
          <div className="flex-1 min-w-0 max-w-xs">
            <select
              value={filters.product || ''}
              onChange={handleProductChange}
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-input focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Filter by product"
            >
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product} value={product}>{product}</option>
              ))}
            </select>
          </div>

          {/* Sort control */}
          <div className="flex-1 min-w-0 max-w-xs">
            <select
              value={filters.sort || '-created_at'}
              onChange={handleSortChange}
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-input focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Sort applications"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* New Application button */}
          <div className="flex items-center sm:ml-auto">
            <button
              onClick={onNewApplication}
              className={`${BUTTON_HOVER_LIFT} btn whitespace-nowrap`}
              disabled={loading}
            >
              <Plus className="h-4 w-4" />
              New Application
            </button>
          </div>
        </div>

        {/* Active filters indicator */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Active filters:</span>
            {debouncedSearchValue && (
              <Badge variant="secondary" className="gap-1">
                Name: {debouncedSearchValue}
                <button
                  onClick={() => { setDebouncedSearch(''); setFilter('search', '') }}
                  className="ml-1 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.dateFrom && (
              <Badge variant="secondary" className="gap-1">
                From: {filters.dateFrom}
                <button
                  onClick={() => setFilter('dateFrom', '')}
                  className="ml-1 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.dateTo && (
              <Badge variant="secondary" className="gap-1">
                To: {filters.dateTo}
                <button
                  onClick={() => setFilter('dateTo', '')}
                  className="ml-1 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.product && (
              <Badge variant="secondary" className="gap-1">
                Product: {filters.product}
                <button
                  onClick={() => setFilter('product', '')}
                  className="ml-1 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.sort && filters.sort !== '-created_at' && (
              <Badge variant="secondary" className="gap-1">
                Sort: {SORT_OPTIONS.find(o => o.value === filters.sort)?.label || filters.sort}
                <button
                  onClick={() => setFilter('sort', '-created_at')}
                  className="ml-1 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <button
              onClick={handleClearFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
      </div>

      {/* Table */}
      <div className="rounded-card border border-border">
        <table className="w-full border-collapse" role="table">
            <thead>
              <tr style={{ borderBottom: '2px solid var(--teal)' }}>
                <th style={{ backgroundColor: '#f3f8f7' }} className="sticky top-0 z-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                  Application Date
                </th>
                <th style={{ backgroundColor: '#f3f8f7' }} className="sticky top-0 z-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                  Applicant Full Name
                </th>
                <th style={{ backgroundColor: '#f3f8f7' }} className="sticky top-0 z-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                  Product Name
                </th>
                <th style={{ backgroundColor: '#f3f8f7' }} className="sticky top-0 z-10 px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                  Amount Applied
                </th>
                <th style={{ backgroundColor: '#f3f8f7' }} className="sticky top-0 z-10 px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                  Loan Term
                </th>
                <th style={{ backgroundColor: '#f3f8f7' }} className="sticky top-0 z-10 px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                  Actions
                </th>
              </tr>
            </thead>
            {loading ? renderSkeletonRows() : (
              isEmpty ? renderEmptyState() : (
                isDataMissing ? renderDataMissingState() : (
                  isNoMatch ? renderNoMatchState() : (
                    isErrorState ? renderErrorState() : renderDataRows()
                  )
                )
              )
            )}
          </table>

          {/* Pagination */}
          {renderPagination()}
        </div>

      {/* View Application slide-in panel */}
      {viewAppId !== null && (
        <SlidePanel
          open={viewAppId !== null}
          onClose={() => setViewAppId(null)}
          title={selectedApp?.name}
          subtitle={`#${viewAppId}`}
        >
          <ViewApplicationContent applicationId={viewAppId} />
        </SlidePanel>
      )}
    </div>
  )
}