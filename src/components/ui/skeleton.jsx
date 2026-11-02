import { cn } from '../../lib/utils'

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-sm bg-accent', className)}
      {...props}
    />
  )
}

export { Skeleton }
