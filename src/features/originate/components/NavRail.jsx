// NavRail — hierarchical tree navigation for the Originate page.
// Two expandable groups (Applications, Decisions), each with the same three
// channel children. Active leaf = activeTab === group && activeChannel === channel.
// Collapse/expand of the whole rail is now self-managed: it starts collapsed,
// expands on hover, and can be pinned open with the bottom toggle. `collapsed`
// and `onToggleCollapsed` are kept for API compatibility with the parent shell.

import { useEffect, useState } from 'react'
import {
  LayoutList, FileCheck2, Smartphone, Globe, Building2,
  ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react'

const CHANNELS = [
  { key: 'APP', label: 'Mobile App', icon: Smartphone },
  { key: 'WEB', label: 'Web', icon: Globe },
  { key: 'BRANCH', label: 'Branch', icon: Building2 },
]

const TREE = [
  { key: 'applications', label: 'Applications', icon: LayoutList, children: CHANNELS },
  { key: 'decisions', label: 'Decisions', icon: FileCheck2, children: CHANNELS },
]

export function NavRail({
  activeTab,
  activeChannel,
  onTabChange,
  onChannelChange,
  collapsed,      // kept: parent-controlled collapsed default (persisted localStorage)
  onToggleCollapsed, // kept: parent toggle callback
}) {
  const [open, setOpen] = useState({ applications: true, decisions: false })
  const [expanded, setExpanded] = useState(false)   // false = collapsed on mount
  const [pinned, setPinned] = useState(false)       // manually pinned open

  // Keep the group containing the active tab open.
  useEffect(() => {
    setOpen((o) => (o[activeTab] ? o : { ...o, [activeTab]: true }))
  }, [activeTab])

  const handleMouseEnter = () => {
    if (!pinned) setExpanded(true)
  }

  const handleMouseLeave = () => {
    if (!pinned) setExpanded(false)
  }

  const handleTogglePinned = () => {
    setPinned((prev) => {
      const next = !prev
      if (next) setExpanded(true)
      return next
    })
  }

  const handleGroup = (key) => {
    if (!expanded) {
      // Collapsed rail: clicking a group expands the rail and opens it.
      setExpanded(true)
      setOpen((o) => ({ ...o, [key]: true }))
      if (activeTab !== key) onTabChange(key)
      return
    }
    if (activeTab !== key) {
      onTabChange(key)
      setOpen((o) => ({ ...o, [key]: true }))
    } else {
      setOpen((o) => ({ ...o, [key]: !o[key] }))
    }
  }

  const handleLeaf = (group, channel) => {
    if (activeTab !== group) onTabChange(group)
    onChannelChange(channel)
  }

  const isCollapsed = !expanded

  return (
    <aside
      className={`orig-rail ${isCollapsed ? 'is-collapsed' : ''} ${pinned ? 'is-pinned' : ''}`}
      role="navigation"
      aria-label="Originate navigation"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <ul className="orig-tree">
        {TREE.map(({ key, label, icon: Icon, children }) => {
          const isGroupActive = activeTab === key
          const isOpen = !isCollapsed && open[key]
          const panelId = `orig-tree-${key}`

          return (
            <li key={key} className="orig-tree-group">
              <button
                type="button"
                className={`orig-tree-node is-parent ${isGroupActive ? 'is-active' : ''}`}
                onClick={() => handleGroup(key)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                title={isCollapsed ? label : undefined}
              >
                <Icon className="orig-tree-icon" aria-hidden="true" />
                <span className="orig-tree-label">{label}</span>
                <ChevronDown
                  className={`orig-tree-chevron ${isOpen ? 'is-open' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {/* Animated container: grid rows 0fr -> 1fr */}
              <div id={panelId} className={`orig-tree-panel ${isOpen ? 'is-open' : ''}`}>
                <ul className="orig-tree-children" role="group">
                  {children.map(({ key: ck, label: cl, icon: CIcon }) => {
                    const isActive = isGroupActive && activeChannel === ck
                    return (
                      <li key={ck} className="orig-tree-leaf">
                        <button
                          type="button"
                          tabIndex={isOpen ? 0 : -1}
                          className={`orig-tree-node is-child ${isActive ? 'is-active' : ''}`}
                          onClick={() => handleLeaf(key, ck)}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <CIcon className="orig-tree-icon" aria-hidden="true" />
                          <span className="orig-tree-label">{cl}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        className={`orig-rail-toggle ${pinned ? 'is-pinned' : ''}`}
        onClick={handleTogglePinned}
        aria-label={pinned ? 'Unpin navigation' : 'Pin navigation'}
        aria-expanded={expanded}
        aria-pressed={pinned}
      >
        {expanded
          ? <ChevronLeft className="orig-rail-toggle-icon" aria-hidden="true" />
          : <ChevronRight className="orig-rail-toggle-icon" aria-hidden="true" />}
      </button>
    </aside>
  )
}
