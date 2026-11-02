import { useState, useEffect, useCallback } from 'react'
import { File } from 'lucide-react'
import { api } from '../lib/api'
import { Dialog, Empty, Rows, Tag } from '../components'

const DECISION_TONE = { APPROVE: 'ok', CONDITIONAL: 'warn', DECLINE: 'bad' }

// Detail dialog for a single application (max-width 800px, scrollable).
// Sections: Personal Info, KYC Details, Financial Details, Application History,
// Documents (thumbnails with click-to-zoom lightbox).
export default function OriginateDetail({ id, onClose }) {
  const [app, setApp] = useState(null)
  const [files, setFiles] = useState([])
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Object URLs for fetched document blobs; revoked on unmount to avoid leaks.
  const [objectUrls, setObjectUrls] = useState({})
  const [zoom, setZoom] = useState(null) // doc_id currently zoomed

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, f, d] = await Promise.all([
        api.retrieveApplication(id),
        api.applicationFiles(id),
        api.applicationDecisions(id),
      ])
      setApp(a); setFiles(f); setDecisions(d); setError(null)
    } catch (e) {
      setError(e.message || 'Failed to load application')
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  // Fetch a document blob once (authenticated) and cache its object URL.
  const getObjectUrl = useCallback(async (docId) => {
    if (objectUrls[docId]) return objectUrls[docId]
    try {
      const url = await api.documentObjectUrl(docId)
      setObjectUrls((o) => ({ ...o, [docId]: url }))
      return url
    } catch (e) {
      return null
    }
  }, [objectUrls])

  useEffect(() => () => {
    // Revoke every object URL when the dialog unmounts.
    Object.values(objectUrls).forEach((u) => { try { URL.revokeObjectURL(u) } catch {} })
  }, [objectUrls])

  if (error) {
    return (
      <Dialog title="Application" width={800} onClose={onClose}>
        <p className="error">{error}</p>
      </Dialog>
    )
  }
  if (!app) return null // the Dialog is rendered once app is ready

  const party = app.party || {}
  const title = `${party.name || 'Application'} · #${app.id ?? id}`

  const rows = {
    personal: [
      ['Applicant', party.name || '—'],
      ['Application ID', String(app.id ?? id)],
      ['Channel', app.channel || '—'],
      ['Party type', party.party_type || '—'],
      ['Phone verified', party.phone_verified ? 'Yes' : 'No'],
      ['Employer', party.employer || '—'],
    ],
    kyc: [
      ['KYC status', <Tag tone={app.kyc_status === 'VERIFIED' ? 'ok' : app.kyc_status === 'FAILED' ? 'bad' : 'muted'}>{app.kyc_status || '—'}</Tag>],
      ['Sanctions hit', String(app.sanctions_hit ?? '—')],
      ['Device applications (24h)', String(app.device_apps_24h ?? '—')],
      ['IP vs KYC geo mismatch', String(app.ip_geo_mismatch ?? '—')],
    ],
    financial: [
      ['Product', app.product_name || app.product || '—'],
      ['Amount requested', app.amount_requested != null ? app.amount_requested.toLocaleString() : '—'],
      ['Tenure (months)', String(app.tenure_months ?? '—')],
      ['Stated income', app.stated_income != null ? app.stated_income.toLocaleString() : '—'],
      ['Verified income', app.verified_income != null ? app.verified_income.toLocaleString() : '—'],
      ['Existing debt service', app.existing_debt_service != null ? app.existing_debt_service.toLocaleString() : '—'],
      ['Bureau score', String(app.bureau_score ?? '—')],
      ['Collateral value', app.collateral_value != null ? app.collateral_value.toLocaleString() : '—'],
      ['Salary domiciled', String(app.salary_domiciled ?? '—')],
    ],
  }

  return (
    <Dialog title={title} width={800} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16, padding: 20 }}>
        {/* Personal Info */}
        <div className="soft">
          <div className="eyebrow">Personal Info</div>
          <Rows rows={rows.personal} />
        </div>

        {/* KYC Details */}
        <div className="soft">
          <div className="eyebrow">KYC Details</div>
          <Rows rows={rows.kyc} />
        </div>

        {/* Financial Details */}
        <div className="soft">
          <div className="eyebrow">Financial Details</div>
          <Rows rows={rows.financial} />
        </div>

        {/* Application History */}
        <div className="soft">
          <div className="eyebrow">Application History</div>
          {decisions.length ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '7px 8px', color: '#5d6b66', fontWeight: 500, borderBottom: '1px solid #d3dad4' }}>Decided at</th>
                  <th style={{ textAlign: 'left', padding: '7px 8px', color: '#5d6b66', fontWeight: 500, borderBottom: '1px solid #d3dad4' }}>Decision</th>
                  <th style={{ textAlign: 'right', padding: '7px 8px', color: '#5d6b66', fontWeight: 500, borderBottom: '1px solid #d3dad4' }}>Approved limit</th>
                  <th style={{ textAlign: 'right', padding: '7px 8px', color: '#5d6b66', fontWeight: 500, borderBottom: '1px solid #d3dad4' }}>PD 12m</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={d.decision_id} style={{ borderBottom: '1px solid #eceeec' }}>
                    <td style={{ padding: '7px 8px' }}>{d.as_of_ts ? new Date(d.as_of_ts).toLocaleString() : '—'}</td>
                    <td style={{ padding: '7px 8px' }}><Tag tone={DECISION_TONE[d.decision] || 'muted'}>{d.decision}</Tag> {d.grade ? `· ${d.grade}` : ''}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>{d.approved_limit != null ? d.approved_limit.toLocaleString() : '—'}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>{d.pd_12m != null ? (d.pd_12m * 100).toFixed(1) + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No decision recorded yet.</Empty>}
        </div>

        {/* Documents */}
        <div className="soft">
          <div className="eyebrow">Application documents</div>
          {files.length ? (
            <div className="thumb-grid">
              {files.map((f) => {
                const isImage = (f.mime || '').startsWith('image/')
                const handleClick = () => {
                  if (!isImage) return
                  getObjectUrl(f.doc_id)
                  setZoom(f.doc_id)
                }
                return (
                  <div key={f.doc_id} className="thumb" onClick={handleClick} role="button" tabIndex={0}
                    aria-label={`View ${f.original_filename || f.doc_type}`}>
                    {isImage ? (
                      <img src={objectUrls[f.doc_id] || undefined} alt={f.original_filename || f.doc_type} loading="lazy" />
                    ) : (
                      <div className="thumb-file">
                        <File size={28} color="#5d6b66" />
                        <div>{f.doc_type}</div>
                      </div>
                    )}
                    <div className="thumb-label">{f.original_filename || f.doc_type}</div>
                  </div>
                )
              })}
            </div>
          ) : <Empty>No documents attached.</Empty>}
        </div>
      </div>

      {/* Lightbox: click-to-zoom for image documents */}
      {zoom && objectUrls[zoom] && (
        <div className="lightbox" onClick={() => setZoom(null)}>
          <img src={objectUrls[zoom]} alt="Document" />
        </div>
      )}
    </Dialog>
  )
}
