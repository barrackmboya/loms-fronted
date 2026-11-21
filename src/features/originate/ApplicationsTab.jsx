// Applications tab — toolbar, table, pagination.
// Phase 4: Applications table.
// Channel navigation moved to NavRail.
//
// Data loading: this tab is self-contained and fetches its own list from
// GET /api/origination/loanapplication/ (page/page_size only). Search, date,
// product and sort are applied client-side because the loanapplication list
// endpoint only accepts page, page_size, id and id_number.

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react'
import { Search, ChevronDown, ChevronUp, Filter, X, Loader2, Plus, AlertCircle, FileText, Play, Database, CheckCircle2 } from 'lucide-react'
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
import { mapLoanApplication } from './lib/mappers'
import { decisionStore } from './lib/decisionStore'
import {
  STATUS_META,
  canBook,
  canRunDecision,
  statusLabel,
  statusTone,
  isTerminal,
} from './lib/statuses'
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

const DEFAULT_FILTERS = {
  search: '',
  dateFrom: '',
  dateTo: '',
  product: '',
  status: '',
  sort: '-created_at',
}

const STATUS_OPTIONS = Object.entries(STATUS_META)
  .map(([value, meta]) => ({ value, label: meta.label }))
  .sort((a, b) => a.label.localeCompare(b.label))

// Backend sort param -> mapped application field
const SORT_FIELD_MAP = {
  created_at: 'createdAt',
  amount_requested: 'amount',
  name: 'name',
}

const ApplicationsTab = forwardRef(function ApplicationsTab(
  { channel = '', onNewApplication, onDecisionComplete },
  ref
) {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({
    page: 1,
    count: 0,
    hasNext: false,
    hasPrevious: false,
  })
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS })
  // Cache of fetched pages: pageNumber -> { data, totalCount }
  const pageCache = useRef(new Map())
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
  // Track in-flight booking requests per application ID
  const [booking, setBooking] = useState(new Set())
  // ID of the application currently being viewed in the detail dialog
  const [viewAppId, setViewAppId] = useState(null)

  // Debounce search input (250ms)
  const debouncedSearchValue = useDebounce(debouncedSearch, 250)

  // Sync debounced search into filters
  useEffect(() => {
    setFilters((prev) =>
      prev.search === debouncedSearchValue ? prev : { ...prev, search: debouncedSearchValue || '' }
    )
  }, [debouncedSearchValue])

  const buildQuery = useCallback((page) => {
    const params = new URLSearchParams()
    params.set('page', page)
    params.set('page_size', PAGE_SIZE)
    return params.toString()
  }, [])

  const fetchPage = useCallback(
    async (page, currentFilters, { forceRefresh = false } = {}) => {
      const cacheKey = JSON.stringify({ page, ...currentFilters })

      if (!forceRefresh && pageCache.current.has(cacheKey)) {
        const cached = pageCache.current.get(cacheKey)
        console.log('[ApplicationsTab] Cache hit for:', cacheKey)
        return cached
      }

      setLoading(true)
      setError(null)
      try {
        const url = `/api/origination/loanapplication/?${buildQuery(page)}`
        console.log('[ApplicationsTab] Fetching:', url)
        const response = await api.get(url)
        // Backend shape: { api_code, success, data: [...], meta: { page, page_size, total, total_pages } }
        const raw = response.data ?? []
        const meta = response.meta ?? {}
        const mapped = raw.map(mapLoanApplication)

        const pageData = {
          data: mapped,
          totalCount: meta.total ?? 0,
          page,
          hasNext: page < (meta.total_pages ?? 0),
          hasPrevious: page > 1,
        }

        pageCache.current.set(cacheKey, pageData)
        return pageData
      } catch (e) {
        console.error('[ApplicationsTab] Error:', e)
        setError(e.message || 'Failed to load applications')
        throw e
      } finally {
        setLoading(false)
      }
    },
    [buildQuery]
  )

  // Client-side filtering + sort. The loanapplication endpoint does not support
  // search/date/product/sort server-side, so they are applied to the fetched page.
  const applyFilters = useCallback(
    (apps, currentFilters) => {
      let result = apps
      const { search, dateFrom, dateTo, product, status, sort } = currentFilters

      if (search) {
        const term = search.toLowerCase()
        result = result.filter(
          (app) =>
            (app.name || '').toLowerCase().includes(term) ||
            (app.reference || '').toLowerCase().includes(term)
        )
      }
      if (dateFrom) {
        result = result.filter((app) => app.createdAt && app.createdAt >= dateFrom)
      }
      if (dateTo) {
        result = result.filter((app) => app.createdAt && app.createdAt <= dateTo)
      }
      if (product) {
        result = result.filter((app) => app.product === product)
      }
      if (status) {
        result = result.filter((app) => String(app.status || '').toUpperCase() === status)
      }

      if (sort) {
        const dir = sort.startsWith('-') ? -1 : 1
        const field = SORT_FIELD_MAP[sort.replace(/^-/, '')] || sort.replace(/^-/, '')
        result = [...result].sort((a, b) => {
          let av = a[field]
          let bv = b[field]
          if (av == null || av === '') av = ''
          if (bv == null || bv === '') bv = ''
          if (av < bv) return -dir
          if (av > bv) return dir
          return 0
        })
      }

      return result
    },
    []
  )

  const loadPage = useCallback(
    async (page, currentFilters = filters, options = {}) => {
      try {
        const pageData = await fetchPage(page, currentFilters, options)
        setApplications(applyFilters(pageData.data, currentFilters))
        setPagination({
          page: pageData.page,
          count: pageData.totalCount,
          hasNext: pageData.hasNext,
          hasPrevious: pageData.hasPrevious,
        })
      } catch (e) {
        // Error already set in fetchPage
      }
    },
    [fetchPage, applyFilters, filters]
  )

  // Load page 1 when channel or any filter changes
  useEffect(() => {
    pageCache.current.clear()
    loadPage(1, filters)
  }, [channel, filters, loadPage])

  // Imperative refetch (used by OriginatePage after a new application is created)
  const refetch = useCallback(() => {
    pageCache.current.clear()
    return loadPage(1, filters)
  }, [filters, loadPage])

  useImperativeHandle(
    ref,
    () => ({ refetch }),
    [refetch]
  )

  // Auto-refetch when the API reports records exist but page 1 returned no data.
  // Bypasses the cache (forceRefresh) to get a fresh response. Capped at 3 attempts
  // to avoid a loop if the backend consistently returns empty data for page 1.
  useEffect(() => {
    if (
      pagination.count > 0 &&
      applications.length === 0 &&
      !loading &&
      !error &&
      emptyRefetchAttempts < 3
    ) {
      setEmptyRefetchAttempts((prev) => prev + 1)
      refetch()
    }
  }, [pagination.count, applications.length, loading, error, refetch, emptyRefetchAttempts])

  // Handle search input change (local state, debounced)
  const handleSearchChange = useCallback((e) => {
    setDebouncedSearch(e.target.value)
  }, [])

  // Handle date filter changes
  const handleDateFromChange = useCallback((e) => {
    setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
  }, [])

  const handleDateToChange = useCallback((e) => {
    setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
  }, [])

  // Handle product filter change
  const handleProductChange = useCallback((e) => {
    setFilters((prev) => ({ ...prev, product: e.target.value }))
  }, [])

  // Handle status filter change
  const handleStatusChange = useCallback((e) => {
    setFilters((prev) => ({ ...prev, status: e.target.value }))
  }, [])

  // Handle sort change
  const handleSortChange = useCallback((e) => {
    setFilters((prev) => ({ ...prev, sort: e.target.value }))
  }, [])

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setDebouncedSearch('')
  }, [])

  // Handle retry
  const handleRetry = useCallback(() => {
    setError(null)
    refetch()
  }, [refetch])

  // Run decision for a single application — per-row in-flight tracking.
  // POST /api/origination/loanapplication/{id}/decision/ (via api.decide). The
  // backend completes extraction for any document without an ExtractionRun and
  // refreshes the document pack before scoring, so no separate analysis call is
  // needed here. The response embeds `income_analysis` (FCF values).
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
      refetch()
    } catch (e) {
      toast.error("Decision failed", { description: e.message })
    } finally {
      setRunning((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }, [onDecisionComplete, refetch])

  // Book an approved application — drives the backend booking gate.
  const handleBook = useCallback(async (id) => {
    if (booking.has(id)) return
    setBooking((prev) => new Set([...prev, id]))
    try {
      await api.book(id)
      toast.success('Application booked')
      refetch()
    } catch (e) {
      toast.error('Booking failed', { description: e.message })
    } finally {
      setBooking((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }, [booking, refetch])

  // Check if any filters are active (besides default sort)
  const hasActiveFilters = useMemo(() => {
    return !!(
      debouncedSearchValue ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.product ||
      filters.status ||
      (filters.sort && filters.sort !== '-created_at')
    )
  }, [debouncedSearchValue, filters])

  // Format application for display
  const formatApplication = useCallback((app) => ({
    ...app,
    formattedDate: app.createdAt ? formatDate(app.createdAt) : '—',
    formattedAmount: formatCurrency(app.amount),
    formattedTenure: app.tenure ? `${app.tenure} mo` : '—',
    applicantName: app.name || '—',
    productName: app.product || '—',
    reference: app.reference || '—',
    statusText: statusLabel(app.status),
    statusTone: statusTone(app.status),
    canDecide: canRunDecision(app.status),
    canBeBooked: canBook(app.status),
    statusKey: String(app.status || '').toUpperCase(),
  }), [])

  // Determine the single action button for each status
  const getActionButton = useCallback((app) => {
    const status = app.statusKey
    if (status === 'BOOKED') {
      return { label: 'Booked', variant: 'disabled', onClick: null, loading: false }
    }
    if (status === 'READY_TO_BOOK') {
      return { label: 'Book', variant: 'primary', onClick: handleBook, loading: booking.has(app.id) }
    }
    // CAPTURED (PENDING) and other decidable statuses → Run Decision
    if (app.canDecide) {
      return { label: 'Run Decision', variant: 'secondary', onClick: handleRunDecision, loading: running.has(app.id) }
    }
    // Terminal/closed states with no action
    return null
  }, [booking, running, handleBook, handleRunDecision])

  const formattedApps = useMemo(() => applications.map(formatApplication), [applications, formatApplication])

  // Product names for the toolbar dropdown, derived from loaded applications
  const products = useMemo(() => {
    const set = new Set()
    applications.forEach((app) => { if (app.product) set.add(app.product) })
    return Array.from(set).sort()
  }, [applications])

  // Application currently open in the View Application slide-in panel.
  const selectedApp = useMemo(() => formattedApps.find((app) => app.id === viewAppId), [formattedApps, viewAppId])

  // Determine current state
  const isEmpty = !loading && !error && applications.length === 0 && !hasActiveFilters && pagination.count === 0
  const isNoMatch = !loading && !error && applications.length === 0 && hasActiveFilters
  const isDataMissing = !loading && !error && applications.length === 0 && !hasActiveFilters && pagination.count > 0
  const isErrorState = !loading && error

  // Render skeleton rows
  const renderSkeletonRows = () => (
    <tbody className="orig-row-stagger">
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="h-11">
          <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-32" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
          <td className="px-3 py-2 text-right font-mono tabular-nums"><Skeleton className="h-4 w-20 mx-auto" /></td>
          <td className="px-3 py-2 text-right font-mono tabular-nums"><Skeleton className="h-4 w-16 mx-auto" /></td>
          <td className="px-3 py-2"><Skeleton className="h-6 w-24 mx-auto" /></td>
          <td className="px-3 py-2"><Skeleton className="h-7 w-40 mx-auto" /></td>
        </tr>
      ))}
    </tbody>
  )

  // Render empty state
  const renderEmptyState = () => (
    <tbody>
      <tr>
        <td colSpan={8} className="py-16">
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
        <td colSpan={8} className="py-16">
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
        <td colSpan={8} className="py-16">
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
        <td colSpan={8} className="py-8">
          <div className="flex flex-col items-center gap-3 text-center p-4 rounded-lg border border-destructive/20 bg-destructive/5">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive font-medium">
              {error?.message || 'Failed to load applications'}
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
        const action = getActionButton(app)
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
          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
            {app.reference}
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
          <td className="px-3 py-2 text-center">
            <Badge variant={app.statusTone}>{app.statusText}</Badge>
          </td>
          <td className="px-3 py-2 text-center">
            {action && (
              <Tooltip
                content={
                  action.variant === 'disabled' ? 'Application has been booked' :
                  action.variant === 'primary' ? 'Book the approved application and open the account' :
                  'Run the credit decision for this application'
                }
              >
                <button
                  onClick={(e) => { e.stopPropagation(); action.onClick?.(app.id, app) }}
                  disabled={loading || action.variant === 'disabled' || action.loading}
                  className={`${BUTTON_HOVER_LIFT} btn text-xs px-1 py-1.5 min-w-[90px] 
                  rounded-lg shadow-[4px_4px_8px_#c7cac7,-4px_-4px_8px_#ffffff] ${action.loading ? 'opacity-70 cursor-not-allowed' : ''} 
                  ${action.variant === 'primary' ? 'bg-teal-600 text-white hover:bg-teal-700 active:shadow-[inset_4px_4px_8px_#c7cac7,inset_-4px_-4px_8px_#ffffff]' : action.variant === 'secondary' ? 'border border-border bg-background text-foreground hover:bg-accent active:shadow-[inset_4px_4px_8px_#c7cac7,inset_-4px_-4px_8px_#ffffff]' : 'opacity-50 cursor-not-allowed bg-muted/30 text-muted-foreground'}`}
                >
                  {action.loading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      {action.label}…
                    </>
                  ) : (
                    <>
                      {action.variant === 'secondary' && <Play className="h-3 w-3 " />}
                      {action.variant === 'primary' && <Database className="h-3 w-3 " />}
                      {action.variant === 'disabled' && <CheckCircle2 className="h-3 w-3 " />}
                      {action.label}
                    </>
                  )}
                </button>
              </Tooltip>
            )}
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
            onClick={() => {
              const next = pagination.page - 1
              if (next < 1) return
              loadPage(next, filters)
            }}
            disabled={!pagination.hasPrevious || loading}
            className={`${BUTTON_HOVER_LIFT} btn ghost text-sm px-3 py-1.5 disabled:opacity-50`}
          >
            Previous
          </button>
          <button
            onClick={() => {
              const next = pagination.page + 1
              loadPage(next, filters)
            }}
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
              placeholder="Search by name or reference…"
              value={debouncedSearch}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-2 text-sm border border-input bg-background rounded-input focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Search applications by name or reference"
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

          {/* Status dropdown */}
          <div className="flex-1 min-w-0 max-w-xs">
            <select
              value={filters.status || ''}
              onChange={handleStatusChange}
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-input focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
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
                  onClick={() => { setDebouncedSearch(''); setFilters((prev) => ({ ...prev, search: '' })) }}
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
                  onClick={() => setFilters((prev) => ({ ...prev, dateFrom: '' }))}
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
                  onClick={() => setFilters((prev) => ({ ...prev, dateTo: '' }))}
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
                  onClick={() => setFilters((prev) => ({ ...prev, product: '' }))}
                  className="ml-1 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.status && (
              <Badge variant="secondary" className="gap-1">
                Status: {statusLabel(filters.status)}
                <button
                  onClick={() => setFilters((prev) => ({ ...prev, status: '' }))}
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
                  onClick={() => setFilters((prev) => ({ ...prev, sort: '-created_at' }))}
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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" role="table">
            <thead>
              <tr style={{ borderBottom: '2px solid var(--teal)' }}>
                <th style={{ backgroundColor: '#f3f8f7' }} className="sticky top-0 z-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                  Application Date
                </th>
                <th style={{ backgroundColor: '#f3f8f7' }} className="sticky top-0 z-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                  Reference
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
                  Status
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
        </div>

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
})

export { ApplicationsTab }
