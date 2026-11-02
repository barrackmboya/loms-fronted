import * as React from 'react'

import { cn } from '../../lib/utils'

// shadcn Empty: a composed placeholder for empty states (no data, no results).
// Structure: Empty > EmptyHeader > (EmptyMedia, EmptyTitle, EmptyDescription)
// and an optional EmptyContent for call-to-action buttons.

function Empty({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex min-w-[250px] flex-col items-center justify-center gap-2.5 rounded-card border border-dashed border-border p-6 text-center text-sm',
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }) {
  return <div className={cn('flex max-w-sm flex-col items-center gap-1', className)} {...props} />
}

function EmptyMedia({ className, icon: Icon, ...props }) {
  return (
    <div
      className={cn(
        'flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0',
        className
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" /> : null}
    </div>
  )
}

function EmptyTitle({ className, ...props }) {
  return <div className={cn('text-sm font-medium leading-tight', className)} {...props} />
}

function EmptyDescription({ className, ...props }) {
  return (
    <div
      className={cn('text-sm text-muted-foreground [&>p]:leading-relaxed', className)}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }) {
  return <div className={cn('flex flex-wrap items-center justify-center gap-2', className)} {...props} />
}

export { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent }
