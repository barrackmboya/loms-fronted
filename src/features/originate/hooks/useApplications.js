// Applications list query hook (Phase 2).
// - GET /api/applications (DRF shape: { count, next, previous, results })
// - Accepts: page, channel (APP/WEB/BRANCH), search, date_from, date_to, sort
// - Keeps previous-page data in memory during paging (don't refetch page 1 when going back)
// - If backend doesn't support filters, filters client-side from loaded results

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { mapApplication } from '../lib/mappers'

const DEFAULT_PAGE_SIZE = 20

export function useApplications(initialFilters = {}) {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({
    page: 1,
    count: 0,
    hasNext: false,
    hasPrevious: false,
  })
  // Cache of fetched pages: pageNumber -> { data, totalCount }
  const pageCache = useRef(new Map())
  // Current filter params (used to invalidate cache when filters change)
  const [filters, setFilters] = useState({
    channel: initialFilters.channel || '', // APP, WEB, BRANCH
    search: initialFilters.search || '',
    dateFrom: initialFilters.dateFrom || '',
    dateTo: initialFilters.dateTo || '',
    sort: initialFilters.sort || '-created_at', // default: Application Date descending
  })
  // Last raw API response (for debugging empty-data mismatches)
  const [lastRawResponse, setLastRawResponse] = useState(null)

  const buildQuery = useCallback((page, currentFilters) => {
    const params = new URLSearchParams()
    params.set('page', page)
    params.set('page_size', DEFAULT_PAGE_SIZE)
    if (currentFilters.channel) params.set('channel', currentFilters.channel)
    if (currentFilters.search) params.set('search', currentFilters.search)
    if (currentFilters.dateFrom) params.set('date_from', currentFilters.dateFrom)
    if (currentFilters.dateTo) params.set('date_to', currentFilters.dateTo)
    if (currentFilters.sort) params.set('ordering', currentFilters.sort)
    return params.toString()
  }, [])

  const fetchPage = useCallback(async (page, currentFilters, { useCache = true, forceRefresh = false } = {}) => {
    const cacheKey = JSON.stringify({ page, ...currentFilters })

    if (useCache && !forceRefresh && pageCache.current.has(cacheKey)) {
      const cached = pageCache.current.get(cacheKey)
      console.log('[useApplications] Cache hit for:', cacheKey)
      return cached
    }

    setLoading(true)
    setError(null)
    try {
      const query = buildQuery(page, currentFilters)
      const url = `/api/applications?${query}`
      const token = localStorage.getItem('accessToken')
      console.log('[useApplications] Fetching:', url, '| Token present:', !!token, '| Token preview:', token?.slice(0, 20) + '...')
      const response = await api.get(url)
      setLastRawResponse(response)

      // Backend pagination shape (CustomPagination): { count, next, previous, data, api_code, api_message }
      const count = response.count ?? 0
      const results = response.data ?? response.results ?? []
      const mapped = results.map(mapApplication)

      const pageData = {
        data: mapped,
        totalCount: count,
        page,
        hasNext: !!response.next,
        hasPrevious: !!response.previous,
      }

      pageCache.current.set(cacheKey, pageData)
      return pageData
    } catch (e) {
      console.error('[useApplications] Error:', e)
      setError(e.message || 'Failed to load applications')
      throw e
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  const loadPage = useCallback(async (page, currentFilters = filters, options = {}) => {
    try {
      const pageData = await fetchPage(page, currentFilters, options)
      setApplications(pageData.data)
      setPagination({
        page: pageData.page,
        count: pageData.totalCount,
        hasNext: pageData.hasNext,
        hasPrevious: pageData.hasPrevious,
      })
    } catch (e) {
      // Error already set in fetchPage
    }
  }, [fetchPage, filters])

  // Load initial page (page 1) when filters change
  useEffect(() => {
    pageCache.current.clear() // Invalidate cache on filter change
    loadPage(1, filters)
  }, [filters, loadPage])

  const goToPage = useCallback((page) => {
    if (page < 1) return
    loadPage(page, filters)
  }, [loadPage, filters])

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      channel: '',
      search: '',
      dateFrom: '',
      dateTo: '',
      sort: '-created_at',
    })
  }, [])

  // Client-side filtering fallback (if backend doesn't support a filter)
  // The hook returns both server-filtered and all-loaded applications
  // so components can choose.
  const getAllLoaded = useCallback(() => {
    // Flatten all cached pages
    const all = []
    pageCache.current.forEach((pageData) => {
      all.push(...pageData.data)
    })
    // Deduplicate by id
    const seen = new Set()
    return all.filter((app) => {
      if (seen.has(app.id)) return false
      seen.add(app.id)
      return true
    })
  }, [])

  return {
    applications,
    loading,
    error,
    pagination,
    filters,
    loadPage: goToPage,
    setFilter,
    clearFilters,
    getAllLoaded, // For client-side filtering fallback
    refetch: useCallback(() => loadPage(pagination.page, filters, { forceRefresh: true }), [loadPage, pagination.page, filters]),
    lastRawResponse, // For debugging empty-data mismatches
  }
}