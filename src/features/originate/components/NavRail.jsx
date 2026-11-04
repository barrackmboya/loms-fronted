// NavRail — hierarchical tree navigation for the Originate page.
// Two expandable groups (Applications, Decisions), each with the same three
// channel children. Active leaf = activeTab === group && activeChannel === channel.
// Collapse/expand of the whole rail is controlled by the parent.

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
  collapsed,
  onToggleCollapsed,
}) {
  const [open, setOpen] = useState({ applications: true, decisions: false })

  // Keep the group containing the active tab open.
  useEffect(() => {
    setOpen((o) => (o[activeTab] ? o : { ...o, [activeTab]: true }))
  }, [activeTab])

  const handleGroup = (key) => {
    if (collapsed) {
      // Icon-only rail: clicking a group expands the rail and opens it.
      onToggleCollapsed()
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

  return (
    <aside
      className={`orig-rail ${collapsed ? 'is-collapsed' : ''}`}
      role="navigation"
      aria-label="Originate navigation"
    >
      <ul className="orig-tree">
        {TREE.map(({ key, label, icon: Icon, children }) => {
          const isGroupActive = activeTab === key
          const isOpen = !collapsed && open[key]
          const panelId = `orig-tree-${key}`

          return (
            <li key={key} className="orig-tree-group">
              <button
                type="button"
                className={`orig-tree-node is-parent ${isGroupActive ? 'is-active' : ''}`}
                onClick={() => handleGroup(key)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                title={collapsed ? label : undefined}
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
        className="orig-rail-toggle"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        aria-expanded={!collapsed}
      >
        {collapsed
          ? <ChevronRight className="orig-rail-toggle-icon" aria-hidden="true" />
          : <ChevronLeft className="orig-rail-toggle-icon" aria-hidden="true" />}
      </button>
    </aside>
  )
}