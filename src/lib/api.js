// Extract the readable message from a DRF error body: {"field": ["msg"]} for
// validation errors, {"detail": "msg"} for auth/permission/not-found.
const messageFrom = async (r) => {
  try {
    const body = await r.json()
    if (typeof body.detail === 'string') return body.detail
    if (body && typeof body === 'object') {
      return Object.entries(body)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(' ') : msgs}`)
        .join('; ')
    }
  } catch { /* non-JSON body — fall through */ }
  return `${r.status} ${r.statusText}`
}

const json = async (r) => { if (!r.ok) throw new Error(await messageFrom(r)); return r.json() }

const getToken = () => localStorage.getItem('accessToken')

// Auth header for fetch calls that bypass this module (multipart uploads in views).
export const authHeaders = () => {
  const token = getToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

const get = (u) => {
  const token = getToken()
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {}
  return fetch(u, { headers }).then(json)
}
const post = (u, body) => {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  }
  return fetch(u, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }).then(json)
}
export const api = {
  login: (credentials) => post('/api/auth/login/', credentials),
  refreshToken: (tokenData) => post('/api/auth/token/refresh/', tokenData),
  createApplication: (payload) => post('/api/applications', payload),
  parties: (search) => get(`/api/parties${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  decide: (id) => post(`/api/applications/${id}/decision`),
  book: (id) => post(`/api/applications/${id}/book`),
  advanceMonth: () => post('/api/servicing/advance'),
  seed: () => post('/api/seed'),
  seedDashboard: () => post('/api/demo/dashboard/seed'),
  portfolio: () => get('/api/portfolio'),
  dashboard: () => get('/api/dashboard'),
  dashboardOverview: (params) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, val)
        }
      })
    }
    const query = searchParams.toString()
    return get(`/api/dashboard${query ? `?${query}` : ''}`)
  },
  accounts: () => get('/api/accounts'),
  watchlist: () => get('/api/ews/watchlist'),
  collections: () => get('/api/collections/queue'),
  policy: () => get('/api/policy'),
  // Metrics endpoints
  originationMetrics: () => get('/api/origination/metrics'),
  partiesMetrics: () => get('/api/parties/metrics'),
  decisioningMetrics: () => get('/api/decisioning/metrics'),
  servicingMetrics: () => get('/api/servicing/metrics'),
  provisioningMetrics: () => get('/api/provisioning/metrics'),
  monitoringMetrics: () => get('/api/monitoring/metrics'),
  // Password reset
  passwordReset: (email) => post('/api/auth/password-reset/', { email }),
  verifyOtp: (email, otp) => post('/api/auth/verify-otp/', { email, otp }),
}