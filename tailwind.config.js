/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ["'Press Start 2P'", 'monospace'],
      },
      colors: {
        bg: 'var(--bg)',
        card: 'var(--card)',
        surface: 'var(--surface)',
        'surface-elevated': 'var(--surface-elevated)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          active: 'var(--accent-active)',
          soft: 'var(--accent-soft)',
          dark: 'var(--accent-dark)',
          contrast: 'var(--accent-contrast)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          hover: 'var(--danger-hover)',
        },
        success: 'var(--success)',
        text: {
          DEFAULT: 'var(--text)',
          secondary: 'var(--text-secondary)',
        },
        border: 'var(--border)',
        draw: {
          bg: 'var(--draw-bg)',
          text: 'var(--draw-text)',
          border: 'var(--draw-border)',
          hover: 'var(--draw-hover)',
        },
        'top-bar': 'var(--top-bar-bg)',
        'panel-muted': 'var(--panel-muted-bg)',
        overlay: 'var(--overlay-bg)',
        modal: 'var(--modal-bg)',
        input: {
          bg: 'var(--input-bg)',
          'bg-readonly': 'var(--input-bg-readonly)',
          placeholder: 'var(--input-placeholder)',
        },
        'item': {
          bg: 'var(--item-bg)',
          'hover-bg': 'var(--item-hover-bg)',
        },
        'move-list': 'var(--move-list-bg)',
        toast: {
          bg: 'var(--toast-bg)',
          info: 'var(--toast-info-bg)',
        },
      },
      borderRadius: {
        '8': 'var(--radius-8)',
        '12': 'var(--radius-12)',
        '16': 'var(--radius-16)',
        '20': 'var(--radius-20)',
        '24': 'var(--radius-24)',
      },
      fontSize: {
        'xs': 'var(--font-size-xs)',
        'sm': 'var(--font-size-sm)',
        'md': 'var(--font-size-md)',
        'lg': 'var(--font-size-lg)',
        'xl': 'var(--font-size-xl)',
      },
      spacing: {
        '4': 'var(--space-4)',
        '8': 'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
        '14': 'var(--space-14)',
        '16': 'var(--space-16)',
        '20': 'var(--space-20)',
        '24': 'var(--space-24)',
        '32': 'var(--space-32)',
      },
      animation: {
        'modal-overlay-in': 'modalOverlayIn 0.18s ease-out',
        'modal-pixel-in': 'modalPixelIn 0.2s steps(4, end)',
        'toast-retro-in': 'toastRetroIn 0.2s steps(4, end)',
        'loading-dot-pulse': 'loadingDotPulse 0.9s steps(3, end) infinite',
        'loading-text-blink': 'loadingTextBlink 1.4s steps(2, end) infinite',
      },
      transitionTimingFunction: {
        'retro-2': 'steps(2, end)',
        'retro-3': 'steps(3, end)',
        'retro-4': 'steps(4, end)',
      },
    },
  },
  plugins: [],
}
