import { Link } from 'react-router-dom'

const BASE = import.meta.env.BASE_URL || '/'

export default function Footer() {
  return (
    <footer className="py-12 border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)] text-center opacity-50">
      <img
        src={`${BASE}logo/gochess_wordmark_dark.svg`}
        alt="GoChess"
        className="h-[24px] w-auto mx-auto mb-[var(--space-8)] opacity-60"
      />
      <p className="text-[10px] text-text-secondary tracking-widest uppercase mb-[var(--space-8)]" style={{ fontFamily: 'var(--font-family-ui)' }}>
        &copy; 2026 &bull; Pixel Soul
      </p>
      <Link to="/agent-logs" className="text-[9px] text-text-secondary hover:text-[var(--accent-brand)] transition-colors uppercase tracking-widest" style={{ fontFamily: 'var(--font-family-ui)' }}>
        Логи агента
      </Link>
    </footer>
  )
}
