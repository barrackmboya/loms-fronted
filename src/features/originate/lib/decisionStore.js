// Decisions store — in-memory array + localStorage persistence.
// Placeholder for a future backend list endpoint.
// Interface: { list(), add(record), subscribe(cb) }

const STORAGE_KEY = 'originate_decisions'

let decisions = []
let subscribers = []

// Load from localStorage on init
try {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    decisions = JSON.parse(stored)
  }
} catch (e) {
  // Ignore parse errors, start fresh
  decisions = []
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions))
  } catch (e) {
    // Ignore quota errors
  }
}

function notify() {
  subscribers.forEach((cb) => cb(decisions))
}

export const decisionStore = {
  /** Return a copy of all decisions. */
  list() {
    return [...decisions]
  },

  /** Add a decision record, persist, and notify subscribers. */
  add(record) {
    decisions = [record, ...decisions] // newest first
    persist()
    notify()
  },

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(cb) {
    subscribers.push(cb)
    return () => {
      subscribers = subscribers.filter((s) => s !== cb)
    }
  },

  /** Clear all decisions (for testing/reset). */
  clear() {
    decisions = []
    persist()
    notify()
  },
}