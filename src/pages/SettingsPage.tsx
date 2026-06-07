import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useBoardStore, BOARD_THEMES, PIECE_SETS } from '@/stores/boardStore'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import Button from '@/components/Button'
import Footer from '@/components/Footer'

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
            backgroundColor: color === 'w' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)',
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
  const { selectedTheme, selectedPieceSet, setSelectedTheme, setSelectedPieceSet } = useBoardStore()
  const { user, updateProfile } = useAuth()
  const { addToast } = useToast()
  
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName)
    }
  }, [user])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      addToast('Имя не может быть пустым', 'warning')
      return
    }

    setIsUpdating(true)
    try {
      await updateProfile({ displayName })
      addToast('Профиль обновлён', 'success')
    } catch (err: any) {
      addToast('Ошибка обновления: ' + (err.message || err), 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="px-[var(--space-24)] py-[var(--space-32)] max-sm:py-[var(--space-16)] bg-bg">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <Link to="/">
            <img
              src={`${import.meta.env.BASE_URL || '/'}logo/gochess_wordmark_dark.svg`}
              alt="GoChess"
              className="h-[28px] w-auto"
            />
          </Link>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] py-[var(--space-48)] flex-1 w-full">

        {user && (
          <section className="mb-[var(--space-40)]">
            <h2 className="text-[var(--font-size-lg)] font-semibold mb-[var(--space-20)] text-text tracking-[0.02em]">
              Профиль
            </h2>
            <form onSubmit={handleUpdateProfile} className="max-w-[400px] space-y-[var(--space-16)] bg-[var(--bg)] p-[var(--space-24)] rounded-[var(--radius-8)] border border-[var(--border)]">
              <div className="space-y-[var(--space-8)]">
                <label className="text-[var(--font-size-xs)] text-[var(--accent-brand)] font-medium">
                  Отображаемое имя
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] p-[12px] text-text text-[var(--font-size-sm)] focus:outline-none focus:border-[var(--accent-brand)] transition-colors placeholder:text-[var(--input-placeholder)]"
                />
              </div>
              <Button type="submit" size="sm" disabled={isUpdating || displayName === user.displayName}>
                {isUpdating ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </form>
          </section>
        )}

        <section className="mb-[var(--space-40)]">
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
                    flex flex-col items-center gap-[var(--space-12)] p-[var(--space-20)] min-h-[120px] justify-center rounded-[var(--radius-8)]
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
                    flex flex-col items-center gap-[var(--space-12)] p-[var(--space-20)] rounded-[var(--radius-8)]
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

      <Footer />
    </div>
  )
}
