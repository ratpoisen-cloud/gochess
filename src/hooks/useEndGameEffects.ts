import { useState, useEffect, useRef } from 'react'
import { getKingSquare } from '@/stores/gameStore'
import type { GameStatus, Color } from '@/types'

interface EndGameState {
  defeated: string | null
  emojis: { square: string; url: string }[]
}

interface Dependencies {
  game: any
  isGameOver: boolean
  status: GameStatus
  currentTurn: Color
  onSave?: () => void
}

const BASE = import.meta.env.BASE_URL || '/'

export function useEndGameEffects({ game, isGameOver, status, currentTurn, onSave }: Dependencies) {
  const [winnerColor, setWinnerColor] = useState<Color | null>(null)
  const [endGameState, setEndGameState] = useState<EndGameState | null>(null)
  const savedRef = useRef(false)

  useEffect(() => {
    if (isGameOver && !savedRef.current) {
      savedRef.current = true
      onSave?.()

      if (status === 'checkmate') {
        const loserColor = currentTurn
        const wc: Color = currentTurn === 'w' ? 'b' : 'w'
        setWinnerColor(wc)
        const kingSq = getKingSquare(game, loserColor)
        const winnerKingSq = getKingSquare(game, wc)
        setEndGameState({
          defeated: kingSq,
          emojis: [
            ...(kingSq ? [{ square: kingSq, url: `${BASE}emojis/end game/chekmate.png` }] : []),
            ...(winnerKingSq ? [{ square: winnerKingSq, url: `${BASE}emojis/end game/win.png` }] : []),
          ],
        })
      } else if (status === 'stalemate' || status === 'draw') {
        setWinnerColor(null)
        const whiteKingSq = getKingSquare(game, 'w')
        const blackKingSq = getKingSquare(game, 'b')
        setEndGameState({
          defeated: null,
          emojis: [
            ...(whiteKingSq ? [{ square: whiteKingSq, url: `${BASE}emojis/end game/draw.png` }] : []),
            ...(blackKingSq ? [{ square: blackKingSq, url: `${BASE}emojis/end game/draw.png` }] : []),
          ],
        })
      }
    }
    if (!isGameOver) {
      savedRef.current = false
      setEndGameState(null)
      setWinnerColor(null)
    }
  }, [isGameOver, status, currentTurn, game, onSave])

  return { winnerColor, endGameState }
}
