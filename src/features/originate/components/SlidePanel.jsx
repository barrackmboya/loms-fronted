// SlidePanel.jsx — right-side slide-in panel with a translucent backdrop.
// Replaces the centered View Application dialog in ApplicationsTab.
// CSS transform + transition only — no animation library.
//
// Props:
//   open      - whether the panel is visible
//   onClose   - called on X click, backdrop click or Escape
//   title     - header title (applicant name, 16px semibold)
//   subtitle  - header subtitle (app id, 13px IBM Plex Mono, muted)
//   children  - panel body (scrolling)
import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

// Above the table (sticky header sits at z-10), well below sonner toasts
// (z-999999999).
const BACKDROP_Z_INDEX = 100
const PANEL_Z_INDEX = 110
const PANEL_WIDTH = 520
const SMALL_VIEWPORT_MAX = 639 // below 640px viewport: 100vw
const EXIT_MS = 220

export function SlidePanel({ open, onClose, title, subtitle, children }) {
  const [isMounted, setIsMounted] = useState(false)
  const [hasEntered, setHasEntered] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const panelRef = useRef(null)
  const exitTimer = useRef(null)

  const clearExitTimer = useCallback(() => {
    if (exitTimer.current !== null) {
      clearTimeout(exitTimer.current)
      exitTimer.current = null
    }
  }, [])

  // Lock background scroll while the panel is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Mount on open, animate in with CSS; on close run the exit animation,
  // then unmount and hand back to the parent.
  useEffect(() => {
    if (open) {
      clearExitTimer()
      setIsMounted(true)
      setIsExiting(false)
      // Commit the closed state first so the transform transition can run.
      requestAnimationFrame(() => setHasEntered(true))
      return
    }
    if (!isMounted || isExiting) return
    setIsExiting(true)
    exitTimer.current = setTimeout(() => {
      exitTimer.current = null
      setIsExiting(false)
      setHasEntered(false)
      setIsMounted(false)
      onClose()
    }, EXIT_MS)
  }, [open, isMounted, isExiting, clearExitTimer, onClose])

  // Close on Escape.
  useEffect(() => {
    if (!open || !isMounted) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, isMounted, onClose])

  // Focus trap: Tab cycles inside the panel while open.
  useEffect(() => {
    if (!open || !isMounted) return
    const panel = panelRef.current
    if (!panel) return
    const focusable = panel.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        }
      } else if (document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    panel.addEventListener('keydown', onKeyDown)
    return () => panel.removeEventListener('keydown', onKeyDown)
  }, [open, isMounted])

  // Move focus into the panel on open.
  useEffect(() => {
    if (!open || !isMounted || isExiting) return
    const focusable = panelRef.current?.querySelector(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    focusable?.focus()
  }, [open, isMounted, isExiting])

  const handleCloseClick = useCallback((event) => {
    event.stopPropagation()
    onClose()
  }, [onClose])

  const panelState = isExiting ? 'exiting' : hasEntered ? 'open' : 'closed'

  return (
    <>
      {isMounted && (
        <>
          <div
            className="slide-panel-backdrop"
            data-state={panelState}
            onClick={onClose}
            style={{ zIndex: BACKDROP_Z_INDEX }}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title || 'Application details'}
            data-state={panelState}
            className="slide-panel"
            style={{ zIndex: PANEL_Z_INDEX }}
          >
            <header className="slide-panel-header sticky top-0 z-20 shrink-0 flex items-center justify-between gap-2 border-b border-border p-4 backdrop-blur-sm bg-[rgba(255,255,255,0.9)]">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
                {subtitle != null && String(subtitle) !== '' && (
                  <p className="font-mono text-[13px] text-muted">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Close panel"
                onClick={handleCloseClick}
                className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          </div>
        </>
      )}
      <style>{`
        .slide-panel-backdrop {
          position: fixed;
          inset: 0;
          z-index: ${BACKDROP_Z_INDEX};
          background: rgba(13, 31, 28, 0.25);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          opacity: 0;
          transition: opacity 280ms ease-out;
        }
        .slide-panel-backdrop[data-state='open'] {
          opacity: 1;
        }
        .slide-panel-backdrop[data-state='exiting'] {
          opacity: 0;
          transition-duration: 220ms;
        }

        .slide-panel {
          position: fixed;
          right: 0;
          top: 0;
          height: 100vh;
          width: 75vw;
          max-width: 80vw;
          z-index: ${PANEL_Z_INDEX};
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-left: 1px solid var(--line);
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 280ms ease-out;
        }
        .slide-panel[data-state='open'] {
          transform: translateX(0);
        }
        .slide-panel[data-state='exiting'] {
          transform: translateX(100%);
          transition-duration: 220ms;
          pointer-events: none;
        }

        @media (max-width: ${SMALL_VIEWPORT_MAX}px) {
          .slide-panel {
            width: 100vw;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .slide-panel-backdrop,
          .slide-panel {
            transition: opacity 200ms ease-out;
            transform: none !important;
          }
          .slide-panel-backdrop[data-state='open'],
          .slide-panel[data-state='open'] {
            opacity: 1;
          }
          .slide-panel-backdrop[data-state='closed'],
          .slide-panel-backdrop[data-state='exiting'],
          .slide-panel[data-state='closed'],
          .slide-panel[data-state='exiting'] {
            opacity: 0;
          }
          .slide-panel-backdrop[data-state='exiting'],
          .slide-panel[data-state='exiting'] {
            transition-duration: 200ms;
            pointer-events: none;
          }
        }
      `}</style>
    </>
  )
}
