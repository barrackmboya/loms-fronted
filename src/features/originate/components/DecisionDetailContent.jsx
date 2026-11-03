// Decision detail panel content — renders OriginateDecisioning inside the
// SlidePanel body. Same data and props as the former DecisionDetailDialog;
// action buttons are hidden for the panel context.
import { useState, useEffect } from 'react'
import OriginateDecisioning from '../../../views/OriginateDecisioning'
import { api } from '../../../lib/api'

export function DecisionDetailContent({ record }) {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!record) return
    setForm(null)
    setLoading(true)
    api.retrieveApplication(record.applicationId)
      .then(setForm)
      .catch(() => setForm({}))
      .finally(() => setLoading(false))
  }, [record])

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
            res={record.fullResponse}
            form={form}
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
