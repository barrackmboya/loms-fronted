// Stat strip component — four cards: Total Applications, This Month, Approval Rate, Avg. Score.
// Shows shadcn Skeleton while loading; em dash "—" when unavailable.

import { Skeleton } from '../../components/ui/skeleton'

export function StatStrip({ stats, loading }) {
  const cards = [
    { key: 'total', label: 'Total Applications', value: stats?.total ?? null, mono: true },
    { key: 'thisMonth', label: 'This Month', value: stats?.thisMonth ?? null, mono: true },
    { key: 'approvalRate', label: 'Approval Rate', value: stats?.approvalRate != null ? `${stats.approvalRate}%` : null, mono: true },
    { key: 'avgScore', label: 'Avg. Score', value: stats?.avgScore != null ? String(stats.avgScore) : null, mono: true },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.key}
          className="orig-stat-card"
        >
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground font-sans tracking-normal">
                {card.label}
              </p>
              <p className="mt-1 font-mono text-xl tabular-nums text-foreground">
                {card.value ?? '—'}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  )
}