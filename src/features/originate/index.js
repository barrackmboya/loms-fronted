// Originate module — data layer exports (Phase 2)

export * from './hooks/useApplications'
export * from './hooks/useStats'
export * from './hooks/useProducts'
export * from './hooks/useCreateApplication'
export * from './hooks/useRunDecision'
export * from './hooks/useDebounce'
export * from './lib/mappers'
export * from './lib/decisionStore'
export * from './lib/normalize'

// Phase 3: Page shell components
export { OriginatePage } from './OriginatePage'
export { StatStrip } from './StatStrip'
export { OriginateTabs } from './OriginateTabs'

// Phase 4: Applications tab
export { ApplicationsTab } from './ApplicationsTab'