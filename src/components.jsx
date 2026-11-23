import { money, pct } from './lib/format'

/**
 * KPI tile. Defaults to the original flat `.panel` card so existing views
 * (Portfolio, Metrics) keep their look; `variant="neu"` opts into the
 * neumorphic soft-UI tile used by the Dashboard.
 *
 * `tag` renders a small colour-coded chip above the label (risk bands).
 * `noteTone` is a semantic 'good' / 'bad' accent, never colour alone — the
 * note text always carries the direction arrow and the label.
 */
export function Kpi({ label, value, note, noteTone = '', variant = 'panel', tag, tagTone = '' }) {
  return (
    <div className={`${variant === 'neu' ? 'neu' : 'panel'} kpi`}>
      {tag && <span className={`kpi-tag ${tagTone}`}>{tag}</span>}
      <small className="kpi-label">{label}</small>
      <b>{value}</b>
      {note && <small className={`kpi-note ${noteTone}`}>{note}</small>}
    </div>
  )
}

export function Tag({ tone, children }) {
  return <span className={`tag ${tone}`}>{children}</span>
}

export function Meter({ value, tone = '', neu = false }) {
  return (
    <div className={`bar ${tone}${neu ? ' neu-track' : ''}`}>
      <i style={{ width: `${Math.min(Math.max(value * 100, 1), 100)}%` }} />
    </div>
  )
}

export function Rows({ rows }) {
  return (
    <table>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td className="right mono">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>
}

export function Loader({ label = 'Loading...' }) {
  return (
    <div className="loader">
      <div className="loader-spinner" />
      <span className="loader-label">{label}</span>
    </div>
  )
}

export { money, pct }
