// URL-synced state for the Originate module (Phase 1, step 5).
//
// The app has no router — App.jsx branches on window.location.pathname — so
// Originate state (tab, channel, search, dates, product, sort, page) rides on
// URLSearchParams of the CURRENT pathname. Unrelated query params are
// preserved; react-router stays out on purpose.
//
// Usage:
//   const [url, setUrl] = useOriginateUrlState()
//   setUrl({ channel: 'BRANCH', page: null })   // null/'' removes the param
//
// Writing params pushes a history entry, so refresh and Back both restore the
// exact view; popstate and the custom 'originate:url' event keep the hook's
// state in sync with either.

import { useCallback, useEffect, useState } from 'react'

export const ORIGINATE_URL_KEYS = ['tab', 'channel', 'search', 'from', 'to', 'product', 'sort', 'page', 'action']

const readParams = () => new URLSearchParams(window.location.search)

// Snapshot of the Originate-owned params. Keys absent from the URL are absent
// from the object — the component applies its own defaults.
export function getOriginateUrlState() {
  const params = readParams()
  const state = {}
  for (const key of ORIGINATE_URL_KEYS) {
    const value = params.get(key)
    if (value !== null) state[key] = value
  }
  return state
}

// Write Originate params without touching anything else in the query string.
export function setOriginateUrlState(updates, { replace = false } = {}) {
  const params = readParams()
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === '') params.delete(key)
    else params.set(key, String(value))
  }
  const query = params.toString()
  const url = window.location.pathname + (query ? `?${query}` : '') + window.location.hash
  if (replace) window.history.replaceState(window.history.state, '', url)
  else window.history.pushState(window.history.state, '', url)
  window.dispatchEvent(new Event('originate:url'))
}

export function useOriginateUrlState() {
  const [state, setState] = useState(getOriginateUrlState)

  useEffect(() => {
    const sync = () => setState(getOriginateUrlState())
    // popstate covers Back/Forward; the custom event covers our own writes
    // (pushState fires nothing) and any other writer of these params.
    window.addEventListener('popstate', sync)
    window.addEventListener('originate:url', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('originate:url', sync)
    }
  }, [])

  const update = useCallback((updates, options) => {
    setOriginateUrlState(updates, options)
    setState((prev) => {
      const next = { ...prev }
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === '') delete next[key]
        else next[key] = String(value)
      }
      return next
    })
  }, [])

  return [state, update]
}
