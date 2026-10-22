/**
 * Плитка варианта внутри модалок раздела Ичи.
 *
 * Единый стиль для всех меню выбора (игра, тренировка, пазлы, дебюты):
 * рамка + подпись + подпись снизу, активный вариант подсвечен акцентом.
 */

interface OptionTileProps {
  /** Основная подпись: «Итальянская защита». */
  title: string
  /** Вторая строка: «C50 · белые · Лёгкий». */
  subtitle?: string
  /** Короткий бейдж справа: счётчик или код. */
  badge?: string
  /** Подсвечен ли вариант. */
  selected?: boolean
  onClick: () => void
}

export default function OptionTile({
  title,
  subtitle,
  badge,
  selected = false,
  onClick,
}: OptionTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-2.5 rounded-[var(--radius-8)] border text-left transition-all ${
        selected
          ? 'border-[var(--accent-brand)] bg-[color-mix(in_srgb,var(--accent-brand)_15%,transparent)]'
          : 'border-[var(--border)] bg-bg/50 hover:border-[color-mix(in_srgb,var(--accent-brand)_50%,transparent)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-text truncate">{title}</span>
        {badge && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary opacity-70 shrink-0">
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <span className="block mt-0.5 text-[9px] uppercase tracking-wider text-text-secondary opacity-60">
          {subtitle}
        </span>
      )}
    </button>
  )
}
