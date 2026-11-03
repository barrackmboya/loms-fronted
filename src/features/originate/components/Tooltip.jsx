// Tooltip.jsx — reusable hover/focus tooltip used across the application.
// Behaviour comes from @radix-ui/react-tooltip (portal, hover/focus,
// touch-device suppression, configurable show delay); styling matches the
// spec: white box, 2px radius, drop shadow, 13px IBM Plex Sans muted text,
// bottom/centre triangular pointer, opacity-only fade, no clipping
// (content is portaled to document.body).
// Self-contained: each instance includes its own Radix Provider, so it can
// wrap any trigger element with no app-level setup.
import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

const TooltipProvider = TooltipPrimitive.Provider

// Inject the tooltip stylesheet once so every <Tooltip> instance shares it.
if (typeof document !== 'undefined' && !document.getElementById('loms-tooltip-styles')) {
  const style = document.createElement('style')
  style.id = 'loms-tooltip-styles'
  style.textContent = `
    .tooltip-box {
      background: #ffffff;
      border-radius: 2px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      padding: 8px 12px;
      max-width: 220px;
      font-family: var(--sans);
      font-size: 13px;
      color: #5d6b66;
      text-align: center;
      white-space: normal;
      z-index: 101;
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }
    .tooltip-box[data-state="open"] {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
      transition: opacity 120ms ease-out;
    }
    .tooltip-box[data-state="closed"] {
      transition: opacity 100ms ease-out;
    }
    @media (prefers-reduced-motion: reduce) {
      .tooltip-box { transition: none !important; }
      .tooltip-box[data-state="open"] { opacity: 1; }
      .tooltip-box[data-state="closed"] { opacity: 0; }
    }
    .tooltip-arrow {
      position: absolute;
      left: 50%;
      width: 8px;
      height: 8px;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transform: rotate(45deg) translateX(-50%);
    }
    .tooltip-box[data-side="top"] .tooltip-arrow {
      bottom: -4px;
      top: auto;
    }
    .tooltip-box[data-side="bottom"] .tooltip-arrow {
      top: -4px;
      bottom: auto;
    }
  `
  document.head.appendChild(style)
}

export function Tooltip({ content, children, side = 'top' }) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root delayDuration={150}>
        <TooltipPrimitive.Trigger asChild>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content side={side} className="tooltip-box">
            <span className="tooltip-text">{content}</span>
            <span className="tooltip-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipProvider>
  )
}
