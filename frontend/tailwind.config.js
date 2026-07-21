/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── Canvas (the surface the whole product sits on) ────────────
        canvas: {
          DEFAULT: 'oklch(0.985 0.003 75)',     // #FAFAF9 — warm off-white, slight amber tint
          sunken:  'oklch(0.965 0.005 75)',     // #F5F5F4 — panel sub-surfaces
        },

        // ─── Ink (text, icons, hierarchy) ──────────────────────────────
        ink: {
          DEFAULT: 'oklch(0.22 0.008 75)',      // primary text — graphite, warm-shifted
          muted:   'oklch(0.48 0.006 75)',      // secondary text
          faint:   'oklch(0.65 0.005 75)',      // labels, captions
          inverse: 'oklch(0.98 0.003 75)',      // on-dark text
        },

        // ─── Hairline (borders, dividers) ──────────────────────────────
        hairline: {
          DEFAULT: 'oklch(0.91 0.005 75)',      // standard border
          strong:  'oklch(0.85 0.006 75)',      // emphasised border
        },

        // ─── Voltage (the one accent — industrial amber, "high voltage") ─
        // Used sparingly: primary CTA, active state, live indicator, focus.
        voltage: {
          50:  'oklch(0.97 0.025 80)',          // badge bg
          100: 'oklch(0.93 0.06 80)',           // tinted panel
          200: 'oklch(0.86 0.11 80)',           // ring, focus halo
          400: 'oklch(0.72 0.16 70)',           // secondary accent text
          500: 'oklch(0.68 0.18 65)',           // primary accent
          600: 'oklch(0.60 0.18 60)',           // primary hover
          700: 'oklch(0.50 0.16 55)',           // pressed
        },

        // ─── Status (semantic — risk states, never decorative) ────────
        // Each has a bg / fg / border triple tuned to live on `canvas`.
        status: {
          critical: { bg: 'oklch(0.96 0.025 25)',  fg: 'oklch(0.45 0.18 25)',  border: 'oklch(0.88 0.06 25)' },
          warning:  { bg: 'oklch(0.96 0.025 75)',  fg: 'oklch(0.48 0.14 70)',  border: 'oklch(0.88 0.06 75)' },
          ok:       { bg: 'oklch(0.96 0.020 150)', fg: 'oklch(0.45 0.12 150)', border: 'oklch(0.88 0.05 150)' },
          info:     { bg: 'oklch(0.96 0.008 240)', fg: 'oklch(0.45 0.04 240)', border: 'oklch(0.88 0.02 240)' },
        },

        // ─── Brand-on-dark (login + sidebar) ──────────────────────────
        // Sidebar keeps the deep graphite but tinted slightly warm.
        graphite: {
          950: 'oklch(0.16 0.006 60)',
          900: 'oklch(0.20 0.008 60)',
          800: 'oklch(0.26 0.010 60)',
          700: 'oklch(0.34 0.010 60)',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
