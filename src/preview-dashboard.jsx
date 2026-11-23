import { createRoot } from 'react-dom/client'
import './index.css'
import Dashboard from './views/Dashboard'

const MONTHS = ['Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026']
const trend = [
  [255, 20, 10, 5], [250, 22, 12, 6], [245, 25, 15, 8],
  [248, 28, 14, 7], [250, 26, 16, 9], [242, 32, 16, 10],
].map(([g, a, o, r], i) => ({ month: MONTHS[i], green: g, amber: a, orange: o, red: r }))

const MOCK = {
  snapshot_month: '2026-09-01',
  available_months: ['2026-09-01', '2026-08-01', '2026-07-01', '2026-06-01'],
  filter_options: {
    segment: ['Retail', 'SME', 'Corporate'],
    product: ['Term Loan', 'Overdraft'],
    region: ['Nairobi', 'Coast'],
    industry: ['Trade', 'Manufacturing'],
    risk_band: ['GREEN', 'AMBER', 'ORANGE', 'RED'],
  },
  kpis: {
    total_monitored: { value: 300, delta_pct: 0 },
    external_credit: { value: 111, delta_pct: 0 },
    total_kcb_exposure: { value: 3760163135, delta_pct: 5.3 },
    total_external_exposure: { value: 4459556140, delta_pct: -3.6 },
    new_applications: { value: 12, delta_pct: -29.4 },
    new_facilities: { value: 8, delta_pct: -42.9 },
    delinquency: { value: 58, delta_pct: -3.3 },
    worsening_dpd: { value: 10, delta_pct: -28.6 },
    flagged_by_ewi: { value: 297, delta_pct: -0.7 },
    band_counts: { GREEN: 242, AMBER: 32, ORANGE: 16, RED: 10 },
    band_delta_pct: { GREEN: 0.8, AMBER: -3.0, ORANGE: -23.8, RED: 66.7 },
  },
  risk_band_trend: trend,
  risk_movement: [
    { label: 'Starting', value: 310 },
    { label: 'GREEN → AMBER', value: 8, color: '#9e2b2b' },
    { label: 'AMBER → ORANGE', value: 4, color: '#9e2b2b' },
    { label: 'AMBER → GREEN', value: -45, color: '#176b63' },
    { label: 'ORANGE → RED', value: 60, color: '#9e2b2b' },
    { label: 'RED → AMBER', value: -8, color: '#176b63' },
    { label: 'ORANGE → GREEN', value: -25, color: '#176b63' },
    { label: 'Ending', value: 300 },
  ],
  severity_distribution: [
    { label: 'Severe', range: '850-1000', count: 10, share: 3.4 },
    { label: 'High', range: '700-849', count: 16, share: 5.4 },
    { label: 'Medium', range: '500-699', count: 32, share: 10.8 },
    { label: 'Low', range: '0-499', count: 242, share: 81.5 },
  ],
  alert_counts: { critical: 12, high: 34, medium: 78, low: 142 },
  top_flagged_borrowers: [
    { customer_id: 'C-4012', segment: 'Retail', ewi_score: 942, risk_band: 'RED', top_ewi: 'DPD spike' },
    { customer_id: 'C-4089', segment: 'SME', ewi_score: 881, risk_band: 'RED', top_ewi: 'External enquiry' },
    { customer_id: 'C-4153', segment: 'Retail', ewi_score: 817, risk_band: 'ORANGE', top_ewi: 'New facility' },
    { customer_id: 'C-4201', segment: 'SME', ewi_score: 763, risk_band: 'AMBER', top_ewi: 'Limit utilised' },
    { customer_id: 'C-4267', segment: 'Retail', ewi_score: 728, risk_band: 'AMBER', top_ewi: 'Payment missed' },
  ],
  flagged_queue: [
    { customer_id: 'C-4012', segment: 'Retail', kcb_exposure: 1240000, external_exposure: 620000, current_dpd: 14, ewi_count: 3, ewi_score: 942, risk_band: 'RED', recommended_action: 'Review facility' },
    { customer_id: 'C-4089', segment: 'SME', kcb_exposure: 980000, external_exposure: 410000, current_dpd: 21, ewi_count: 2, ewi_score: 881, risk_band: 'RED', recommended_action: 'Restructure' },
    { customer_id: 'C-4153', segment: 'Retail', kcb_exposure: 610000, external_exposure: 190000, current_dpd: 9, ewi_count: 2, ewi_score: 817, risk_band: 'ORANGE', recommended_action: 'Monitor' },
    { customer_id: 'C-4201', segment: 'SME', kcb_exposure: 430000, external_exposure: 210000, current_dpd: 5, ewi_count: 1, ewi_score: 763, risk_band: 'AMBER', recommended_action: 'Verify income' },
    { customer_id: 'C-4267', segment: 'Retail', kcb_exposure: 310000, external_exposure: 80000, current_dpd: 3, ewi_count: 1, ewi_score: 728, risk_band: 'AMBER', recommended_action: 'Monitor' },
  ],
}

const originalFetch = window.fetch
window.fetch = async (url, opts) => {
  if (String(url).includes('/api/dashboard')) {
    return new Response(JSON.stringify(MOCK), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return originalFetch(url, opts)
}

createRoot(document.getElementById('root')).render(
  <main>
    <Dashboard userProfile={{ accessible_modules: ['dashboard'] }} />
  </main>,
)
