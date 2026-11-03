// Decision detail dialog — renders OriginateDecisioning inside a shadcn Dialog.
// No code is duplicated: the detail component is imported and rendered as-is.
// Action buttons (Book / New Application) are hidden via CSS in dialog context.
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogCloseButton } from '../../../components/ui/dialog'
import OriginateDecisioning from '../../../views/OriginateDecisioning'
import { api } from '../../../lib/api'

export function DecisionDetailDialog({ open, onOpenChange, record }) {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !record) return
    setLoading(true)
    api.retrieveApplication(record.applicationId)
      .then(setForm)
      .catch(() => setForm({}))
      .finally(() => setLoading(false))
  }, [open, record])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="decision-detail-dialog flex max-h-[90vh] w-[95vw] max-w-[1200px] flex-col overflow-hidden p-0">
        <style>{`
          .decision-detail-dialog .decision-detail-content button { display: none; }
        `}</style>

        {/* Sticky dialog header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-sans text-[16px] font-semibold text-foreground">
              Decision — {record.applicationId}
            </h2>
            <p className="font-mono text-[13px] text-muted">{record.applicationId}</p>
          </div>
          <DialogCloseButton />
        </div>

        {/* Scrolling body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted">
              <p>Loading decision detail…</p>
            </div>
          ) : (
            <div className="decision-detail-content">
              <OriginateDecisioning
                res={record.fullResponse}
                form={form}
                onBook={() => {}}
                onNewApplication={() => {}}
                booked={false}
                busy={false}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
