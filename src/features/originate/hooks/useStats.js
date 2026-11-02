// Stats hook (Phase 2).
// Computes client-side from loaded applications data for now.
// No stats endpoint exists yet.
// Returns: Total Applications, This Month, Approval Rate, Avg. Score

import { useMemo } from 'react'

const THIS_MONTH_START = new Date()
THIS_MONTH_START.setDate(1)
THIS_MONTH_START.setHours(0, 0, 0, 0)

export function useStats(applications) {
  return useMemo(() => {
    if (!applications || !applications.length) {
      return {
        total: 0,
        thisMonth: 0,
        approvalRate: 0,
        avgScore: null,
      }
    }

    const total = applications.length

    // This Month: applications created this month
    const thisMonth = applications.filter((app) => {
      if (!app.createdAt) return false
      const created = new Date(app.createdAt)
      return created >= THIS_MONTH_START
    }).length

    // Approval Rate: count of APPROVE / total decided
    // Note: status comes from Application.status (SUBMITTED/APPROVE/CONDITIONAL/DECLINE/BOOKED)
    // Per audit: status mapping - approved is Approved (green), rejected is Rejected (red), pending is Pending (yellow)
    // The decision field on Application: APPROVE, CONDITIONAL, DECLINE
    const decided = applications.filter((app) =>
      app.status === 'APPROVE' || app.status === 'DECLINE' || app.status === 'CONDITIONAL'
    )
    const approved = decided.filter((app) => app.status === 'APPROVE').length
    const approvalRate = decided.length > 0 ? (approved / decided.length) * 100 : 0

    // Avg Score: not available in application list (risk_score not in backend yet)
    // Will be computed from decision records when available
    const avgScore = null

    return {
      total,
      thisMonth,
      approvalRate: Math.round(approvalRate * 10) / 10, // 1 decimal place
      avgScore,
    }
  }, [applications])
}