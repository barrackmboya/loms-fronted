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

// Multipart submit. Never set Content-Type — the browser adds the boundary.
// `idempotencyKey` makes a retried submit return the original application.
const postMultipart = (u, formData, { idempotencyKey } = {}) => {
  const headers = authHeaders()
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  return fetch(u, { method: 'POST', headers, body: formData }).then(json)
}

const isFile = (value) => typeof File !== 'undefined' && value instanceof File

// Plain JSON → FormData. File objects ride as uploads; nested objects become
// JSON strings, which is the contract the origination view's `_as_json_list`
// and JSON fields expect from multipart form data.
const toMultipart = (payload = {}) => {
  const form = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (isFile(value)) form.append(key, value)
    else if (typeof value === 'object') form.append(key, JSON.stringify(value))
    else form.append(key, String(value))
  })
  return form
}

// --- Origination application (the only canonical create/decide/book path) ----
const ORIGINATION = '/api/origination/loanapplication/'

const retrieveApplication = async (id) => {
  const response = await get(`${ORIGINATION}?id=${encodeURIComponent(id)}`)
  // The detail endpoint answers with the api envelope { api_code, data }.
  return response?.data ?? response
}

const createApplication = (payload) => {
  const form = toMultipart(payload)
  return postMultipart(ORIGINATION, form, { idempotencyKey: payload?.idempotency_key })
}

export const api = {
  get,
  post,
  postMultipart,
  login: (credentials) => post('/api/auth/login/', credentials),
  refreshToken: (tokenData) => post('/api/auth/token/refresh/', tokenData),
  // POST multipart /api/origination/loanapplication/ — documents are uploaded
  // with the application creation, not afterwards.
  createApplication,
  // --- Application record (OriginateDetail.jsx) ---------------------------
  // GET /api/origination/loanapplication/?id=<id> — the detail record;
  // PersonDocument pack attachments are embedded as `appl_documents`.
  retrieveApplication,
  applicationFiles: (id) =>
    retrieveApplication(id).then((a) => a.appl_documents || a.documents || []),
  // GET /api/applications/<id>/decision — single DecisionRecord, or 409
  // not_decided when none exists. OriginateDetail renders a list, so wrap a
  // lone record; an application with no decision yet is an empty list, not an
  // error (the 409 body is {"error": "No decision has been recorded…"}).
  applicationDecisions: (id) =>
    get(`/api/applications/${id}/decision`)
      .then((r) => (Array.isArray(r) ? r : [r]))
      .catch((e) => {
        if (/no decision has been recorded/i.test(e.message)) return []
        throw e
      }),
  // Fetch a document blob (authenticated) and return an object URL for
  // <img src>. No blob endpoint exists yet; resolve null on failure so the
  // caller can fall back to a file-type placeholder.
  documentObjectUrl: async (file) => {
    const docId = typeof file === 'object' && file !== null ? (file.doc_id ?? file.id) : file
    const token = getToken()
    try {
      const r = await fetch(`/api/applications/documents/${docId}/file`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (!r.ok) return null
      const blob = await r.blob()
      return URL.createObjectURL(blob)
    } catch {
      return null
    }
  },
  // Fetch any media URL as a blob and return an object URL. Used for document
  // previews: blob: URLs are not subject to X-Frame-Options, so PDFs render in
  // an <iframe> even when the file response carries frame-deny headers, and the
  // authenticated fetch keeps working if media ever gets auth-protected.
  // Resolves null on failure so the caller can show a fallback.
  fetchObjectUrl: async (url) => {
    if (!url) return null
    // Defense-in-depth: if the backend ever returns an absolute media URL
    // (http://backend-host/media/...), fetch it as a same-origin path instead.
    // A cross-origin fetch would fail — media responses carry no CORS headers —
    // and the /media proxy already routes same-origin requests to the backend.
    let target = url
    try {
      const parsed = new URL(url, window.location.href)
      if (parsed.origin !== window.location.origin && parsed.pathname.startsWith('/media/')) {
        target = parsed.pathname
      }
    } catch { /* not a parseable URL — fetch as-is */ }
    const token = getToken()
    try {
      const r = await fetch(target, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (!r.ok) return null
      const blob = await r.blob()
      return URL.createObjectURL(blob)
    } catch {
      return null
    }
  },
  parties: (search) => get(`/api/parties${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  // --- KYC report (View Application panel) ---------------------------------
  // GET /api/origination/reports/kyc/?id=<loan_application_id> — full KYC
  // payload: application + product details, personal details, contacts,
  // documents, residential + employment history. Mapped via mapKycReport().
  kycReport: (id) => get(`/api/origination/reports/kyc/?id=${encodeURIComponent(id)}`),
  // GET /api/origination/loan-products/ — the active catalogue. The endpoint
  // may answer as a bare array, {data}, {results} or the api envelope.
  loanProducts: async () => {
    const r = await get('/api/origination/loan-products/?page_size=200')
    if (Array.isArray(r)) return r
    if (Array.isArray(r?.data)) return r.data
    if (Array.isArray(r?.results)) return r.results
    return []
  },
  decide: (id) => post(`${ORIGINATION}${id}/decision/`),
  book: (id) => post(`${ORIGINATION}${id}/book/`),
  // GET /api/origination/loanapplication/<id>/decision/ — persisted decision
  // plus the evidence blocks (income_analysis + document_analysis) the detail
  // panel renders. Scoped to origination so an origination operator can read it.
  decisionDetail: (id) => get(`${ORIGINATION}${id}/decision/`),
  // GET /api/applications/<id>/income-analysis — latest persisted M-Pesa
  // ExtractionRun. The decision response embeds the same block as
  // `income_analysis`, so the panel can render FCF values without re-upload.
  incomeAnalysis: (id) => get(`/api/applications/${id}/income-analysis`),
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
  // Login OTP verification — uses login-specific endpoint
  verifyOtp: (email, otp) => post('/api/auth/verify-otp/', { email, otp }),
  // Contact verification (email + phone) — uses general endpoint, not login-specific
  verifyContactOtp: (contact, otp) => post('/api/auth/verify-contact-otp/', { contact, otp }),
  sendEmailOtp: (email) => post('/api/auth/send-email-otp/', { email }),
  sendSmsOtp: (phone) => post('/api/auth/send-sms-otp/', { phone }),
}