// Decision detail panel content — renders OriginateDecisioning inside the
// SlidePanel body. Same data and props as the former DecisionDetailDialog;
// action buttons are hidden for the panel context.
import { useState, useEffect } from 'react'
import OriginateDecisioning from '../../../views/OriginateDecisioning'
import { api } from '../../../lib/api'

export function DecisionDetailContent({ record }) {
  const [form, setForm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!record) return
    setForm(null)
    setDetail(null)
    setLoading(true)
    // The application form supplies the bureau/telemetry rows; the persisted
    // decision supplies the latest income and document extraction evidence.
    Promise.all([
      api.retrieveApplication(record.applicationId).catch(() => ({})),
      api.decisionDetail(record.applicationId).catch(() => null),
    ])
      .then(([application, decision]) => {
        setForm(application)
        setDetail(decision)
      })
      .finally(() => setLoading(false))
  }, [record])

  const detailData = detail || {}
  const base = record.fullResponse || {}
  // Prefer the fresh evidence from the persisted decision; keep the richer
  // POST response shape for everything else.
  const res = { ...detailData, ...base }
  res.limit_detail = base.limit_detail || detailData.limit || detailData.limit_detail || {}
  res.income_analysis = detailData.income_analysis ?? base.income_analysis
  const analysis = detailData.document_analysis || base.document_analysis || {}
  res.document_analysis = analysis

  return (
    <div className="flex h-full flex-col">
      <style>{`
        .decision-detail-panel .action-buttons { display: none; }
      `}</style>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 decision-detail-panel">
        {loading || form === null ? (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <p>Loading decision detail…</p>
          </div>
        ) : (
          <OriginateDecisioning
            res={res}
            form={form}
            income={res.income_analysis}
            kyc={analysis.kra_pin}
            crb={analysis.crb}
            identityDoc={analysis.identity}
            onBook={() => {}}
            onNewApplication={() => {}}
            booked={false}
            busy={false}
          />
        )}
      </div>
    </div>
  )
}
