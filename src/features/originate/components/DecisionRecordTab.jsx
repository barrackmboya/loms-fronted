// Decision Record tab — reads from the decisions store.
// Subscribes to store changes so new decisions appear immediately.
import { useCallback, useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { Skeleton } from '../../../components/ui/skeleton'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '../../../components/ui/empty'
import { Badge } from '../../../components/ui/badge'
import { DecisionDetailDialog } from './DecisionDetailDialog'
import { decisionStore } from '../lib/decisionStore'
import { ROW_STAGGER, BUTTON_HOVER_LIFT } from '../lib/classes'

const DECISION_BADGE_STYLE = {
  APPROVE: 'bg-green-100 text-green-700',
  CONDITIONAL: 'bg-amber-100 text-amber-700',
  DECLINE: 'bg-red-100 text-red-700',
}

const formatPd12m = (v) => {
  if (v == null) return '-'
  return (v * 100).toFixed(1) + '%'
}

const formatRunDate = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Glassmorphism container for the decisions table area.
const GLASS_STYLE = {
  background: 'rgba(255, 255, 255, 0.72)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  borderRadius: '12px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  padding: '24px',
}

export function DecisionRecordTab() {
  const [records, setRecords] = useState(() => decisionStore.list())
  const [detailRecord, setDetailRecord] = useState(null)

  useEffect(() => {
    const unsubscribe = decisionStore.subscribe(() => {
      setRecords(decisionStore.list())
    })
    return unsubscribe
  }, [])

  const handleClear = useCallback(() => {
    decisionStore.clear()
  }, [])

  const isEmpty = records.length === 0

  // Render skeleton rows
  const renderSkeletonRows = () => (
    <tbody className="orig-row-stagger">
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="h-11">
          <td className="px-3 py-2 font-mono text-xs"><Skeleton className="h-4 w-24" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-32" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-20" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-16" /></td>
          <td className="px-3 py-2 text-right font-mono tabular-nums"><Skeleton className="h-4 w-20 mx-auto" /></td>
          <td className="px-3 py-2 text-right font-mono tabular-nums"><Skeleton className="h-4 w-20 mx-auto" /></td>
          <td className="px-3 py-2"><Skeleton className="h-6 w-24 mx-auto" /></td>
        </tr>
      ))}
    </tbody>
  )

  // Render empty state
  const renderEmptyState = () => (
    <tbody>
      <tr>
        <td colSpan={8} className="py-16">
          <Empty className="w-full">
            <EmptyHeader>
              <EmptyMedia icon={FileText} className="size-12 text-muted-foreground/50" />
              <EmptyTitle className="text-base font-medium text-foreground">No decisions recorded yet</EmptyTitle>
              <EmptyDescription className="text-sm text-muted-foreground">
                Run a decision from the Applications tab.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {records.length > 0 && (
                <button
                  onClick={handleClear}
                  className={`${BUTTON_HOVER_LIFT} btn ghost text-xs`}
                >
                  Clear all
                </button>
              )}
            </EmptyContent>
          </Empty>
        </td>
      </tr>
    </tbody>
  )

  // Render data rows
  const renderDataRows = () => (
    <tbody>
      {records.map((r, index) => {
        const selected = detailRecord?.id === r.id
        return (
          <tr
            key={r.id}
            className={`h-11 cursor-pointer ${index % 2 === 1 ? 'border-b bg-row-zebra' : ''} ${selected ? 'ring-1 ring-teal/50' : ''}`}
            style={{
              borderLeft: '3px solid transparent',
              paddingLeft: 'calc(0.75rem - 3px)',
              transition: 'all 200ms ease-out',
              backgroundColor: selected ? 'rgba(23, 107, 99, 0.06)' : (index % 2 === 1 ? 'rgba(23, 107, 99, 0.035)' : 'transparent'),
              borderBottom: index % 2 === 1 ? '1px solid rgba(211, 218, 212, 0.5)' : 'none',
              borderLeftColor: selected ? 'var(--teal)' : 'transparent',
            }}
            onClick={() => setDetailRecord(r)}
            onMouseEnter={(e) => {
              if (selected) return
              e.currentTarget.style.backgroundColor = 'rgba(23, 107, 99, 0.08)'
              e.currentTarget.style.borderLeftColor = 'var(--teal)'
            }}
            onMouseLeave={(e) => {
              if (selected) return
              e.currentTarget.style.backgroundColor = index % 2 === 1 ? 'rgba(23, 107, 99, 0.035)' : 'transparent'
              e.currentTarget.style.borderLeftColor = 'transparent'
            }}
          >
          <td className="px-3 py-2 font-mono text-xs text-foreground">
            {r.applicationId}
          </td>
          <td className="px-3 py-2 text-foreground">
            {r.applicantName}
          </td>
          <td className="px-3 py-2 text-foreground">
            {r.channel}
          </td>
          <td className="px-3 py-2">
            <Badge
              variant="secondary"
              className={`${DECISION_BADGE_STYLE[r.decision] || ''} border-current`}
            >
              {r.decision}
            </Badge>
          </td>
          <td className="px-3 py-2 text-foreground">
            {r.grade}
          </td>
          <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
            {formatPd12m(r.pd_12m)}
          </td>
          <td className="px-3 py-2 font-mono text-xs text-foreground">
            {formatRunDate(r.runDate)}
          </td>
          <td className="px-3 py-2">
            <button
              onClick={(e) => { e.stopPropagation(); setDetailRecord(r) }}
              className={`${BUTTON_HOVER_LIFT} btn ghost text-xs`}
            >
              View Details
            </button>
          </td>
        </tr>
      )})}
    </tbody>
  )

  // Render pagination
  const renderPagination = () => (
    <div className="flex items-center justify-end gap-4 mt-6 pt-4 border-t border-border">
      <div className="text-sm text-muted-foreground font-mono">
        {records.length} decisions
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleClear}
          className={`${BUTTON_HOVER_LIFT} btn ghost text-xs px-3 py-1.5`}
        >
          Clear all
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div style={GLASS_STYLE} className="space-y-4">
        {/* Table */}
        <div className="rounded-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" role="table">
              <thead>
                <tr style={{ borderBottom: '2px solid var(--teal)' }}>
                  <th style={{ backgroundColor: 'rgba(23, 107, 99, 0.05)' }} className="sticky top-0 z-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                    Application ID
                  </th>
                  <th style={{ backgroundColor: 'rgba(23, 107, 99, 0.05)' }} className="sticky top-0 z-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                    Applicant Name
                  </th>
                  <th style={{ backgroundColor: 'rgba(23, 107, 99, 0.05)' }} className="sticky top-0 z-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                    Channel
                  </th>
                  <th style={{ backgroundColor: 'rgba(23, 107, 99, 0.05)' }} className="sticky top-0 z-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                    Decision
                  </th>
                  <th style={{ backgroundColor: 'rgba(23, 107, 99, 0.05)' }} className="sticky top-0 z-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                    Grade
                  </th>
                  <th style={{ backgroundColor: 'rgba(23, 107, 99, 0.05)' }} className="sticky top-0 z-10 px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                    PD 12M
                  </th>
                  <th style={{ backgroundColor: 'rgba(23, 107, 99, 0.05)' }} className="sticky top-0 z-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                    Run Date
                  </th>
                  <th style={{ backgroundColor: 'rgba(23, 107, 99, 0.05)' }} className="sticky top-0 z-10 px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                    Actions
                  </th>
                </tr>
              </thead>
              {isEmpty ? renderEmptyState() : renderDataRows()}
            </table>
          </div>

          {/* Pagination */}
          {renderPagination()}
        </div>
      </div>

      {/* Decision Detail dialog */}
      {detailRecord && (
        <DecisionDetailDialog
          open={true}
          onOpenChange={(o) => { if (!o) setDetailRecord(null) }}
          record={detailRecord}
        />
      )}
    </div>
  )
}
