import { CheckCircle2, XCircle, ShieldAlert, FilePlus2 } from 'lucide-react'
import { decisionTone, money, pct, prettify } from '../lib/format'
import { Meter, Rows, Tag } from '../components'

const bandChipTone = (b) => (
  { A: 'ok', B: 'ok', C: 'info', D: 'warn', E: 'bad' }[b] || 'muted'
)

// "Decision record" page: gates, scorecard breakdown, extracted facts, priced
// offer, fraud fusion and collections outlook. Receives the decision result
// (res) and the application form (for the demo-extracted facts) from the
// container (Originate.jsx); onBook books the approved file and
// onNewApplication starts a fresh application from here.
export default function OriginateDecisioning({ res, form, income, kyc, crb, onBook, booked, busy, onNewApplication }) {
  const gates = Object.entries(res.gates || {})
  const declined = res.decision === 'DECLINE'
  const bts = res.scorecard?.bts  // both segments (decisioning mapper attaches the segment's BTSResult)

  return (
    <>
      <div className="panel">
        <h2>Decision</h2>
        <p style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 6px' }}>
          <Tag tone={decisionTone(res.decision)}>{res.decision}</Tag>
          <span className="mono">grade {res.grade} · 12-month PD {pct(res.pd_12m, 2)}</span>
        </p>

        {bts && <BtsPanel bts={bts} />}

        {income && <IncomePanel income={income} />}

        {kyc && <KycPanel kyc={kyc} />}

        {crb && <CrbPanel crb={crb} />}

        <p className="eyebrow band">Gates</p>
        {gates.map(([key, gate]) => (
          <div className="gate" key={key}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {gate.pass
                ? <CheckCircle2 size={15} color="var(--ok)" />
                : <XCircle size={15} color="var(--bad)" />}
              {prettify(key)}
            </span>
            <span className="why">{gate.pass ? '' : gate.fail_path}</span>
          </div>
        ))}

        <p className="eyebrow band">Extracted from application documents</p>
        <p className="muted" style={{ marginTop: 0 }}>Populated when the decision ran — the
          documents on the application panel are the source, not operator keying. Demo
          extraction values until the document pipeline is wired.</p>
        <div className="grid cols-2">
          <Rows rows={[
            ['KYC status', form.kyc_status || 'not extracted'],
            ['Phone verified', form.phone_verified ? 'Yes' : 'No'],
            ['Sanctions hit', form.sanctions_hit ? 'Yes' : 'No'],
            ['Stated monthly income', money(form.stated_income)],
            ['Verified monthly income', money(form.verified_income)],
            ['Existing debt service', money(form.existing_debt_service)],
            ['Income verification source', { AA: 'Account aggregator', EMPLOYER: 'Employer API', UPLOAD: 'Customer upload' }[form.doc_source] || form.doc_source],
          ]} />
          <Rows rows={[
            ['Bureau score', form.bureau_score ?? 'not extracted'],
            ['Enquiries, last 6 months', form.bureau_enquiries_6m ?? 'not extracted'],
            ['Delinquencies, last 12 months', form.delinquencies_12m ?? 'not extracted'],
            ['Bounced debits, last 6 months', form.bounces_6m ?? 'not extracted'],
            ['Applications from this device, 24h', form.device_apps_24h ?? 'not extracted'],
            ['Worst document tamper score', form.tamper_score ?? 'not extracted'],
            ['IP vs KYC geo mismatch', form.ip_geo_mismatch ? 'Yes' : 'No'],
          ]} />
        </div>

        <p className="eyebrow band">Reason codes</p>
        <p className="mono">{(res.reason_codes || []).join(' · ') || 'none'}</p>

        <p style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button className="btn" disabled={busy || declined || booked} onClick={onBook}>
            {booked ? 'Booked' : declined ? 'Cannot book a declined file' : 'Book and post day-1 ECL'}
          </button>
          <button className="btn ghost" disabled={busy} onClick={onNewApplication}>
            <FilePlus2 size={16} /> New application
          </button>
        </p>
        {booked && (
          <p className="mono" style={{ marginTop: 10 }}>
            Account {booked.account_id} · stage {booked.day1_ecl.stage} ·
            ECL {money(booked.day1_ecl.ecl)} on EAD {money(booked.day1_ecl.ead)}
          </p>
        )}
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <h2>Limit and price</h2>
          <Rows rows={[
            ['Approved limit', money(res.limit_detail.approved_limit)],
            ['Binding constraint', res.limit_detail.binding.join(', ')],
            ['Debt service ratio', pct(res.affordability.dsr)],
            ['Expected loss in price', pct(res.pricing.el_pct, 2)],
            ['All-in rate', pct(res.pricing.all_in_rate, 2)],
            ['Monthly instalment', money(res.pricing.monthly_instalment)],
          ]} />
        </div>

        <div className="soft">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ShieldAlert size={16} /> Fraud fusion
          </h2>
          <p className="mono">{res.fraud.composite} / 1000 · {res.fraud.decision}</p>
          <Meter value={res.fraud.composite / 1000}
            tone={res.fraud.composite > 640 ? 'bad' : res.fraud.composite > 420 ? 'warn' : ''} />

          <p className="eyebrow band">Signals above warn</p>
          <div className="inset mono">
            {res.fraud.signals.length
              ? res.fraud.signals.map(([code, value]) => (
                  <div key={code}>{code}: {String(value)}</div>))
              : 'none'}
          </div>

          <p className="eyebrow band">If this file ever reaches collections</p>
          <div className="inset mono">
            Right-party contact {pct(res.collection_propensity.p_right_party_contact)}<br />
            Recovery if default {pct(res.collection_propensity.expected_recovery_rate_if_default)}<br />
            Mandate {res.collection_propensity.recommended_mandate_type}
          </div>

          <p className="eyebrow band">Model provenance</p>
          <p className="mono" style={{ color: 'var(--muted)' }}>
            {Object.entries(res.model_versions).map(([k, v]) => `${k} ${v}`).join(' · ')}
          </p>
        </div>
      </div>
    </>
  )
}

// Score-axis marks of the credit gauge: tick marks evenly spread across the
// track at 0, 250, 500, 700, 850 with their tier labels below (Below Bronze,
// Bronze, Silver, Gold, Platinum); the red/amber/green graduation spans the
// full track evenly.
const SCALE_MARKS = [
  { score: 0, label: 'Below Bronze' },
  { score: 250, label: 'Bronze' },
  { score: 500, label: 'Silver' },
  { score: 700, label: 'Gold' },
  { score: 850, label: 'Platinum' },
]

function BtsGauge({ bts }) {
  const marks = SCALE_MARKS.map((m, i) => `${i / (SCALE_MARKS.length - 1) * 100}%`)
  const pos = (score) => `${Math.min(Math.max(score / 8.5, 0), 100)}%`
  return (
    <div className="bts-gauge">
      <div className="bts-gauge-head">
        <div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
            Partner Map {bts.partner_map} · {bts.file_class}
            {bts.confidence_badge ? ` · confidence ${bts.confidence_badge}` : ''}
          </div>
        </div>
      </div>

      {/* Graduated track: red (poor) → amber (fair) → green (strong), evenly
          spread across the track; tick marks at 0/250/500/700/850 with tier
          labels below each; the needle marks where this file scored. */}
      <div className="bts-track">
        {SCALE_MARKS.map((m, i) => (
          <span key={`mark-${m.score}`} className="bts-scale-mark" style={{ left: marks[i] }} title={`score ${m.score}`} />
        ))}
        <span className="bts-needle" style={{ left: pos(bts.bts) }} />
        <span className="bts-needle-label" style={{ left: pos(bts.bts) }}>
          {bts.bts} · {bts.tier}
        </span>
      </div>
      {/* Scale marks under the track: the score above, the tier label below each mark. */}
      <div className="bts-scale mono">
        {SCALE_MARKS.map((m, i) => (
          <span key={`scale-${m.score}`} style={{ position: 'absolute', left: marks[i], transform: 'translateX(-50%)' }}>
            <span className="bts-scale-score">{m.score}</span>
           
            <span className="bts-scale-label">{m.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// One row per characteristic: id, band chip, points bar (pts against max_pts) —
// hover any row for the banding rationale.
function CharRows({ characteristics }) {
  return (
    <table className="char-table">
      <thead>
        <tr><th>Characteristic</th><th>Band</th><th className="right">Points</th></tr>
      </thead>
      <tbody>
        {characteristics.map((c) => (
          <tr key={c.char_id} title={c.rationale}>
            <td>{c.char_id}</td>
            <td>
              <Tag tone={bandChipTone(c.band)}>{c.band}</Tag>
              {c.source === 'OVERRIDE' && <span className="mono ov-flag"> · override</span>}
            </td>
            <td className="right mono">{c.band === 'M' ? '—' : `${c.pts}/${c.max_pts}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Domain budgets as horizontal usage bars: fill = points spent, budget caps the
// track, % used to the right (tone flips to warn/bad as the domain saturates).
function DomainBars({ domains }) {
  return (
    <div className="domain-list">
      {Object.entries(domains).map(([domain, d]) => {
        const tone = d.used >= 0.85 ? 'bad' : d.used >= 0.6 ? 'warn' : ''
        return (
          <div className="domain-row" key={domain}>
            <span className="domain-name">{domain}</span>
            <div className="bar domain-bar">
              <i style={{ width: `${Math.min(Math.max(d.used * 100, 1), 100)}%`, background: tone ? `var(--${tone})` : 'var(--teal)' }} />
            </div>
            <span className="right mono domain-nums">{d.pts}/{d.budget} · {pct(d.used, 1)}</span>
          </div>
        )
      })}
    </div>
  )
}

// M-Pesa statement income analysis (POST /api/applications/{id}/income-analysis):
// the six 'Derived Features' (rows 48-53 of the feature workbook) each as value +
// formula + inputs, plus the panel-facing income_summary block. Empty until an
// analysis has been fetched for the application.
function IncomePanel({ income }) {
  if (!income) return null
  const s = income.income_summary || {}
  const feats = income.derived_features || {}
  const confTone = { HIGH: 'ok', MEDIUM: 'info', LOW: 'warn', NONE: 'muted' }[s.confidence] || 'muted'
  const stabTone = { STABLE: 'ok', SEASONAL: 'info', VARIABLE: 'warn', VOLATILE: 'bad', NO_DATA: 'muted' }[s.income_stability] || 'muted'
  return (
    <>
      <p className="eyebrow band">M-Pesa income analysis (statement upload)</p>
      <div className="inset">
        <div className="grid cols-2">
          <Rows rows={[
            ['Verified monthly income (FCF proxy)', money(s.verified_income_monthly)],
            ['Income sources observed', s.income_sources ?? '—'],
            ['Salary-like inflow', s.salary_flag ? 'Yes' : 'No'],
          ]} />
          <Rows rows={[
            ['Inflow stability', <Tag key="stab" tone={stabTone}>{s.income_stability || 'NO_DATA'}</Tag>],
            ['Analysis confidence', <Tag key="conf" tone={confTone}>{s.confidence || 'NONE'}</Tag>],
            ['Statement coverage', income.statement
              ? `${income.statement.window_days ?? 0} days · ${income.statement.rows ?? 0} txns`
              : '—'],
          ]} />
        </div>

        <p className="eyebrow band">Derived features (value · formula)</p>
        <table className="char-table">
          <thead>
            <tr><th>Feature</th><th>Value</th><th className="right">Formula</th></tr>
          </thead>
          <tbody>
            {Object.entries(feats).map(([name, f]) => (
              <tr key={name} title={f.rationale}>
                <td className="mono">{prettify(name)}</td>
                <td className="right mono">{money(f.value)}</td>
                <td className="right mono" style={{ color: 'var(--muted)' }}>{f.formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mono" style={{ color: 'var(--muted)', fontSize: 11.5, margin: '6px 0 0' }}>
          Statement as of {income.reference_date || '—'} · discounted FCF is the volatility-
          haircutted monthly FCF; stable FCF needs a salary-like inflow on the statement.
        </p>
      </div>
    </>
  )
}

// KRA PIN certificate extraction (POST /api/applications/{id}/kra-pin): the holder's
// PIN number, registered name and address as read off the uploaded certificate, each
// with the rationale the KYC decision rests on. Empty until a certificate upload has
// been analysed for the application.
function KycPanel({ kyc }) {
  if (!kyc) return null
  const d = kyc.kyc_details || {}
  const confTone = { HIGH: 'ok', MEDIUM: 'info', LOW: 'warn', NONE: 'muted' }[kyc.confidence] || 'muted'
  const pin = d.kra_pin || {}
  const holder = d.holder_name || {}
  const address = d.holder_address || {}
  return (
    <>
      <p className="eyebrow band">KRA PIN certificate (KYC document)</p>
      <div className="inset">
        <div className="grid cols-2">
          <Rows rows={[
            ['KRA PIN', <span key="pin" className="mono">{pin.value || '—'}</span>],
            ['Holder name', holder.value || '—'],
            ['Registered address', address.value || '—'],
          ]} />
          <Rows rows={[
            ['PIN format valid', pin.valid_format
              ? <Tag key="vf" tone="ok">Yes</Tag>
              : <Tag key="vf" tone="bad">No</Tag>],
            ['Extraction confidence', <Tag key="conf" tone={confTone}>{kyc.confidence || 'NONE'}</Tag>],
            ['Certificate read', kyc.document
              ? `${kyc.document.pages} page · ${kyc.document.strategy}`
              : '—'],
          ]} />
        </div>
        <p className="mono" style={{ color: 'var(--muted)', fontSize: 11.5, margin: '6px 0 0' }}>
          {pin.value && pin.valid_format
            ? 'PIN matches the KRA format (letter + 9 digits + letter); name and address as printed on the certificate.'
            : 'PIN missing or malformed — request a legible certificate before deciding.'}
        </p>
      </div>
    </>
  )
}

// Bureau report extraction (CRB upload): Metro-Score, summary-row enquiries and
// bounced cheques, each as {value, rationale} — mirrors the KRA PIN panel.
function CrbPanel({ crb }) {
  if (!crb) return null
  const d = crb.crb_details || {}
  const confTone = { HIGH: 'ok', MEDIUM: 'info', LOW: 'warn', NONE: 'muted' }[crb.confidence] || 'muted'
  const score = d.bureau_score || {}
  const enquiries = d.bureau_enquiries_6m || {}
  const bounces = d.bounces_6m || {}
  const complete = score.value != null && enquiries.value != null && bounces.value != null
  return (
    <>
      <p className="eyebrow band">CRB report (bureau document)</p>
      <div className="inset">
        <div className="grid cols-2">
          <Rows rows={[
            ['Bureau score', <span key="score" className="mono">{score.value ?? '—'}</span>],
            ['Enquiries, last 6 months', enquiries.value ?? '—'],
            ['Bounced cheques, last 6 months', bounces.value ?? '—'],
          ]} />
          <Rows rows={[
            ['Bureau', crb.extras?.bureau || '—'],
            ['Extraction confidence', <Tag key="conf" tone={confTone}>{crb.confidence || 'NONE'}</Tag>],
            ['Report read', crb.document
              ? `${crb.document.pages} page · ${crb.document.strategy}`
              : '—'],
          ]} />
        </div>
        <p className="mono" style={{ color: 'var(--muted)', fontSize: 11.5, margin: '6px 0 0' }}>
          {complete
            ? 'Metro-Score and summary-row counts read from the report; the bureau rows above use these values.'
            : 'Score or summary counts missing — request a full CRB report before relying on the bureau rows.'}
        </p>
      </div>
    </>
  )
}

function BtsPanel({ bts }) {
  return (
    <>
      <BtsGauge bts={bts} />

      <p className="eyebrow band">Scorecard characteristics (band · points / available)</p>
      <div className="inset">
        <CharRows characteristics={bts.characteristics} />
      </div>

      <p className="eyebrow band">Domain budgets used</p>
      <div className="inset">
        <DomainBars domains={bts.domains} />
      </div>

      <p className="eyebrow band">Poor-twin diagnostic (same file, bands floored at the poor mark)</p>
      <p className="mono">poor twin {bts.poor_twin_bts} ({bts.poor_twin_tier}) — the gap proves
        the card scores quality, not presence</p>

      {bts.reasons?.length > 0 && (
        <>
          <p className="eyebrow band">How to improve this score</p>
          <div className="inset mono">
            {bts.reasons.map((rc) => (
              <div key={rc.code} title={rc.language}>
                {rc.code} · {rc.label}: {rc.action} ({rc.est_pts})
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
