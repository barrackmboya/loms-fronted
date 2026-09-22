const json = (r) => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() }

const get = (u) => fetch(u).then(json)
const post = (u, body) =>
  fetch(u, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then(json)

export const api = {
  createApplication: (payload) => post('/api/applications', payload),
  decide: (id) => post(`/api/applications/${id}/decision`),
  book: (id) => post(`/api/applications/${id}/book`),
  advanceMonth: () => post('/api/servicing/advance'),
  seed: () => post('/api/seed'),
  portfolio: () => get('/api/portfolio'),
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
  recoveryMetrics: () => get('/api/recovery/metrics'),
}
