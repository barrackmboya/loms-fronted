import { money, pct } from './lib/format'

export function Kpi({ label, value, note }) {
  return (
    <div className="panel kpi">
      <small>{label}</small>
      <b>{value}</b>
      {note && <small>{note}</small>}
    </div>
  )
}

export function Tag({ tone, children }) {
  return <span className={`tag ${tone}`}>{children}</span>
}

export function Meter({ value, tone = '' }) {
  return (
    <div className={`bar ${tone}`}>
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
