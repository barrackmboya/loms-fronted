/** Tailwind v3 config — Originate module foundation (Phase 1).
 *
 * Token mapping: every colour below points at the existing CSS custom
 * properties in index.css. Tailwind extends the hand-written stylesheet,
 * it never replaces it — no parallel palette is defined here.
 * Radius and fonts follow the Originate brief (8px cards/dialogs,
 * 6px buttons, 4px inputs; IBM Plex Sans/Mono). Spacing uses the default
 * Tailwind scale, which is already the brief's 4px base (gap-*). */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // shadcn semantic tokens mapped onto the existing index.css variables.
        background: 'var(--paper)',
        foreground: 'var(--ink)',
        surface: 'var(--panel)',
        card: {
          DEFAULT: 'var(--panel)',
          foreground: 'var(--ink)',
        },
        popover: {
          DEFAULT: 'var(--panel)',
          foreground: 'var(--ink)',
        },
        primary: {
          DEFAULT: 'var(--teal)',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#e2e8e3', // existing .soft surface tone
          foreground: 'var(--ink)',
        },
        // shadcn's `muted` surface maps to paper; its `muted` TEXT maps to
        // the existing --muted grey. Neither index.css variable is touched.
        muted: {
          DEFAULT: 'var(--paper)',
          foreground: 'var(--muted)',
        },
        accent: {
          DEFAULT: '#e2e8e3',
          foreground: 'var(--ink)',
        },
        destructive: {
          DEFAULT: 'var(--bad)',
          foreground: '#ffffff',
        },
        success: {
          DEFAULT: 'var(--ok)',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: 'var(--warn)',
          foreground: '#ffffff',
        },
        border: 'var(--line)',
        input: 'var(--line)',
        ring: 'var(--teal)',
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", 'system-ui', 'sans-serif'],
        mono: ["'IBM Plex Mono'", 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '8px',    // cards and dialogs
        button: '6px',  // buttons
        input: '4px',   // inputs
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      keyframes: {
        'orig-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'orig-dialog-in': {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'orig-fade-in': 'orig-fade-in 200ms ease-out',
        'orig-dialog-in': 'orig-dialog-in 200ms cubic-bezier(0.2, 0.8, 0.3, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
