import { useNavigate } from 'react-router-dom'
import { useBoardStore, BOARD_THEMES, PIECE_SETS } from '@/stores/boardStore'

const BASE = import.meta.env.BASE_URL || '/'

function ThemePreview({ white, black }: { white: string; black: string }) {
  return (
    <div className="grid grid-cols-2 w-[64px] h-[64px] rounded-[var(--radius-8)] overflow-hidden border border-[color-mix(in_srgb,var(--border)_60%,transparent)]">
      <div style={{ backgroundColor: white }} />
      <div style={{ backgroundColor: black }} />
      <div style={{ backgroundColor: black }} />
      <div style={{ backgroundColor: white }} />
    </div>
  )
}

function PiecePreview({ pieceSetId }: { pieceSetId: string }) {
  const pieces = [
    { color: 'w', type: 'K' },
    { color: 'b', type: 'K' },
    { color: 'w', type: 'Q' },
    { color: 'b', type: 'Q' },
  ]

  return (
    <div className="grid grid-cols-2 gap-[4px] w-[64px] h-[64px]">
      {pieces.map(({ color, type }) => (
        <div
          key={`${color}${type}`}
          className="flex items-center justify-center rounded-[4px]"
          style={{
            backgroundColor: color === 'w' ? '#f0f0f0' : '#3a3a3a',
          }}
        >
          <img
            src={`${BASE}pieces/${pieceSetId}/${color}${type}.svg`}
            alt={`${color}${type}`}
            className="w-[28px] h-[28px]"
            draggable={false}
          />
        </div>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { selectedTheme, selectedPieceSet, setSelectedTheme, setSelectedPieceSet } = useBoardStore()

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)] px-[var(--space-20)] py-[var(--space-16)]">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="px-[14px] py-[8px] bg-[color-mix(in_srgb,var(--surface-elevated)_76%,var(--surface))] text-text border border-[color-mix(in_srgb,var(--accent)_14%,var(--border))] rounded-[var(--btn-radius)] text-[var(--font-size-sm)] cursor-pointer hover:translate-y-[-2px] transition-transform duration-[0.14s] ease-[steps(2,end)]"
          >
            ← В лобби
          </button>
          <h1 className="text-[var(--font-size-md)] font-bold text-text tracking-[0.02em]">
            Настройки
          </h1>
          <div className="w-[100px]" />
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-[var(--space-20)] py-[var(--space-32)] flex-1">
        <section className="mb-[var(--space-32)]">
          <h2 className="text-[var(--font-size-lg)] font-semibold mb-[var(--space-20)] text-text tracking-[0.02em]">
            Тема доски
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-[var(--space-16)]">
            {Object.values(BOARD_THEMES).map((theme) => {
              const isActive = selectedTheme === theme.id
              return (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`
                    flex flex-col items-center gap-[var(--space-12)] p-[var(--space-20)] min-h-[120px] justify-center rounded-[var(--radius-16)]
                    border transition-[border-color,box-shadow,transform] duration-[0.14s] ease-[steps(2,end)]
                    hover:translate-y-[-2px] hover:shadow-[0_8px_16px_rgba(0,0,0,0.2)]
                    active:translate-y-[1px] active:scale-[0.985]
                    ${isActive
                      ? 'border-[var(--accent)] shadow-[0_0_0_2px_var(--accent-soft)]'
                      : 'border-[color-mix(in_srgb,var(--border)_80%,transparent)] hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))]'
                    }
                  `}
                  style={{
                    background: isActive
                      ? 'var(--accent-soft)'
                      : 'linear-gradient(180deg, color-mix(in srgb, var(--surface-elevated) 55%, var(--card)), color-mix(in srgb, var(--card) 94%, #151915))',
                  }}
                >
                  <ThemePreview white={theme.whiteSquare} black={theme.blackSquare} />
                  <span className="text-[var(--font-size-sm)] text-text font-medium text-center">{theme.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="text-[var(--font-size-lg)] font-semibold mb-[var(--space-20)] text-text tracking-[0.02em]">
            Набор фигур
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--space-16)]">
            {Object.values(PIECE_SETS).map((pieceSet) => {
              const isActive = selectedPieceSet === pieceSet.id
              return (
                <button
                  key={pieceSet.id}
                  onClick={() => setSelectedPieceSet(pieceSet.id)}
                  className={`
                    flex flex-col items-center gap-[var(--space-12)] p-[var(--space-20)] rounded-[var(--radius-16)]
                    border transition-[border-color,box-shadow,transform] duration-[0.14s] ease-[steps(2,end)]
                    hover:translate-y-[-2px] hover:shadow-[0_8px_16px_rgba(0,0,0,0.2)]
                    active:translate-y-[1px] active:scale-[0.985]
                    ${isActive
                      ? 'border-[var(--accent)] shadow-[0_0_0_2px_var(--accent-soft)]'
                      : 'border-[color-mix(in_srgb,var(--border)_80%,transparent)] hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))]'
                    }
                  `}
                  style={{
                    background: isActive
                      ? 'var(--accent-soft)'
                      : 'linear-gradient(180deg, color-mix(in srgb, var(--surface-elevated) 55%, var(--card)), color-mix(in srgb, var(--card) 94%, #151915))',
                  }}
                >
                  <PiecePreview pieceSetId={pieceSet.id} />
                  <span className="text-[var(--font-size-sm)] text-text font-medium">{pieceSet.label}</span>
                </button>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
