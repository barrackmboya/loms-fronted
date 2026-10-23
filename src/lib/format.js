export const money = (n) =>
  n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })
export const pct = (n, d = 1) => (n == null ? '—' : `${(Number(n) * 100).toFixed(d)}%`)
export const bandTone = (b) => ({ GREEN: 'ok', AMBER: 'warn', RED: 'bad' }[b] || 'info')
export const stageTone = (s) => ({ 1: 'info', 2: 'warn', 3: 'bad' }[s] || 'info')
export const decisionTone = (d) =>
  ({ APPROVE: 'ok', CONDITIONAL: 'warn', DECLINE: 'bad' }[d] || 'info')
export const prettify = (s) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
