const BASE = import.meta.env.BASE_URL || '/'

export default function Footer() {
  return (
    <footer className="py-12 border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)] text-center opacity-50">
      <img
        src={`${BASE}logo/gochess_wordmark_dark.svg`}
        alt="GoChess"
        className="h-[24px] w-auto mx-auto mb-[var(--space-8)] opacity-60"
      />
      <p className="text-[10px] text-text-secondary tracking-widest uppercase" style={{ fontFamily: 'var(--font-family-ui)' }}>
        &copy; 2026 &bull; Ratpoisen
      </p>
    </footer>
  )
}
