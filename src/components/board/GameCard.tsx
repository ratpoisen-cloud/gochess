import BoardPreview from '@/components/board/BoardPreview'

interface GameCardProps {
  game: any
  currentUserId?: string
  onClick: () => void
}

export default function GameCard({ game: g, currentUserId, onClick }: GameCardProps) {
  const isOnline = g.game_type === 'online'
  const isActive = g.game_state !== 'game_over'
  const isUserWhite = currentUserId ? g.white_player_id === currentUserId : false
  const isUserBlack = currentUserId ? g.black_player_id === currentUserId : false

  const isMyTurn = isActive && (
    (g.turn === 'w' && isUserWhite) || 
    (g.turn === 'b' && isUserBlack)
  )

  const opponentName = isUserWhite 
    ? (g.black_name || (g.game_type === 'bot' ? 'Ичи' : 'Соперник')) 
    : (g.white_name || (g.game_type === 'bot' ? 'Ичи' : 'Соперник'))

  const displayName = currentUserId 
    ? `vs ${opponentName}`
    : `${g.white_name || 'Белые'} vs ${g.black_name || 'Чёрные'}`

  const modeLabel = g.game_mode === 'spell_chess' ? 'Магия' 
    : g.game_mode === 'atomic_chess' ? 'Атомные' 
    : g.game_mode === 'fog_of_war' ? 'Туман' 
    : g.game_mode === 'rapid' ? 'Рапид' 
    : 'Классика'

  const isWin = (g.winner === 'white' && isUserWhite) || (g.winner === 'black' && isUserBlack)
  const isLoss = (g.winner === 'white' && isUserBlack) || (g.winner === 'black' && isUserWhite)
  const isDraw = g.winner === 'draw' || g.winner === 'stalemate'

  return (
    <div 
      onClick={onClick}
      className="p-[var(--space-12)] rounded-[var(--radius-8)] pixel-tile transition-all duration-200 flex gap-[var(--space-16)] items-center cursor-pointer active:scale-[0.98] hover:border-[var(--accent-brand)]"
    >
      <div className="relative shrink-0">
        <BoardPreview 
          fen={g.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'} 
          size={80} 
          orientation={isUserBlack ? 'black' : 'white'}
          gameMode={g.game_mode}
          playerColor={isUserWhite ? 'w' : 'b'}
        />
        {isActive && isMyTurn && (
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--accent-brand)] rounded-full animate-ping z-10" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[12px] font-bold text-text truncate">
              {displayName}
            </span>
            <span className="text-[9px] text-text-secondary opacity-70 uppercase tracking-wider shrink-0 border border-[var(--border)] px-1.5 py-0.5 rounded">
              {modeLabel}
            </span>
          </div>

          {!isActive && (
            <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
              isWin 
                ? 'text-[var(--success)]' 
                : isLoss 
                  ? 'text-[var(--danger)] opacity-85' 
                  : isDraw 
                    ? 'text-white' 
                    : 'text-text-secondary opacity-60'
            }`}>
              {isWin ? 'Победа' : isLoss ? 'Поражение' : isDraw ? 'Ничья' : (g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : 'Завершена')}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${
            isActive 
              ? (isMyTurn ? 'text-[var(--accent-brand)]' : 'text-text-secondary opacity-60') 
              : 'text-text-secondary opacity-40'
          }`}>
            {isActive 
              ? (isMyTurn ? 'Ваш ход' : 'Ход соперника')
              : (isOnline ? 'Онлайн' : g.game_type === 'bot' ? 'Ичи' : 'Локально')}
          </span>
          <span className="text-[10px] text-text-secondary opacity-50">
            {g.created_at
              ? new Date(
                  typeof g.created_at === 'string'
                    ? g.created_at
                    : g.created_at.seconds * 1000
                ).toLocaleDateString()
              : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
