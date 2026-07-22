/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── Canvas (surface backgrounds) ─────────────────────────
        canvas: {
          DEFAULT: 'rgb(var(--color-canvas) / <alpha-value>)',
          sunken:  'rgb(var(--color-canvas-sunken) / <alpha-value>)',
        },

        // ─── Ink (text, icons, hierarchy) ─────────────────────────
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          muted:   'rgb(var(--color-ink-muted) / <alpha-value>)',
          faint:   'rgb(var(--color-ink-faint) / <alpha-value>)',
          inverse: 'rgb(var(--color-ink-inverse) / <alpha-value>)',
        },

        // ─── Hairline (borders, dividers) ─────────────────────────
        hairline: {
          DEFAULT: 'rgb(var(--color-hairline) / <alpha-value>)',
          strong:  'rgb(var(--color-hairline-strong) / <alpha-value>)',
        },

        // ─── On-Accent (text rendered on accent-colored surfaces) ─
        'on-accent': 'rgb(var(--color-on-accent) / <alpha-value>)',

        // ─── Voltage (primary brand action color) ─────────────────
        voltage: {
          50:  'rgb(var(--color-voltage-50) / <alpha-value>)',
          100: 'rgb(var(--color-voltage-100) / <alpha-value>)',
          200: 'rgb(var(--color-voltage-200) / <alpha-value>)',
          400: 'rgb(var(--color-voltage-400) / <alpha-value>)',
          500: 'rgb(var(--color-voltage-500) / <alpha-value>)',
          600: 'rgb(var(--color-voltage-600) / <alpha-value>)',
          700: 'rgb(var(--color-voltage-700) / <alpha-value>)',
        },

        // ─── Status (semantic risk/health states) ─────────────────
        status: {
          critical: {
            bg:     'rgb(var(--color-status-critical-bg) / <alpha-value>)',
            fg:     'rgb(var(--color-status-critical-fg) / <alpha-value>)',
            border: 'rgb(var(--color-status-critical-border) / <alpha-value>)',
          },
          warning: {
            bg:     'rgb(var(--color-status-warning-bg) / <alpha-value>)',
            fg:     'rgb(var(--color-status-warning-fg) / <alpha-value>)',
            border: 'rgb(var(--color-status-warning-border) / <alpha-value>)',
          },
          ok: {
            bg:     'rgb(var(--color-status-ok-bg) / <alpha-value>)',
            fg:     'rgb(var(--color-status-ok-fg) / <alpha-value>)',
            border: 'rgb(var(--color-status-ok-border) / <alpha-value>)',
          },
          info: {
            bg:     'rgb(var(--color-status-info-bg) / <alpha-value>)',
            fg:     'rgb(var(--color-status-info-fg) / <alpha-value>)',
            border: 'rgb(var(--color-status-info-border) / <alpha-value>)',
          },
        },

        // ─── Graphite (sidebar, login, brand-on-dark surfaces) ────
        graphite: {
          950: 'rgb(var(--color-graphite-950) / <alpha-value>)',
          900: 'rgb(var(--color-graphite-900) / <alpha-value>)',
          800: 'rgb(var(--color-graphite-800) / <alpha-value>)',
          700: 'rgb(var(--color-graphite-700) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
