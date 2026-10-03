import { useState, useCallback } from 'react'
import { doc, updateDoc, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createEngine } from '@/lib/engine'
import { useToast } from '@/components/Toast'
import type { GameData } from '@/types'

type UndoOutcome = 'ok' | 'noop' | 'missing' | 'finished' | 'stale' | 'unsupported'
type DrawOutcome = 'ok' | 'missing' | 'finished' | 'stale'

export function useGameRequest(gameDocId: string | null) {
  const { addToast } = useToast()
  const [undoRequest, setUndoRequest] = useState<GameData['undo_request']>(null)
  const [drawRequest, setDrawRequest] = useState<GameData['draw_request']>(null)

  const setRequestsFromSnapshot = useCallback((newData: GameData) => {
    setUndoRequest(newData.undo_request)
    setDrawRequest(newData.draw_request)
  }, [])

  // The position is rebuilt from the document read INSIDE the transaction:
  // using the caller's local PGN mirror would blindly overwrite any move that
  // landed between read and write. Guards re-check game_state and the request
  // identity so a rejected/expired request cannot roll back a finished game.
  const handleAcceptUndo = useCallback(async (mode?: string) => {
    if (!gameDocId || !undoRequest) return
    try {
      const outcome = await runTransaction(db, async (transaction): Promise<UndoOutcome> => {
        const gameRef = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(gameRef)
        const fresh = freshDoc.data()
        if (!fresh) return 'missing'
        if (fresh.game_state === 'game_over') return 'finished'

        const req = fresh.undo_request
        if (!req || req.from_id !== undoRequest.from_id || req.created_at !== undoRequest.created_at) {
          return 'stale'
        }

        // Spell Chess stores no move list in the document (FEN + spell state
        // only), so there is nothing to replay — accepting would reset the game.
        if (mode === 'spell_chess') return 'unsupported'

        const engineMode = mode === 'atomic_chess' ? 'atomic' : undefined
        const g = createEngine(engineMode)
        const freshPgn: string = fresh.pgn || ''
        try {
          g.loadPgn(freshPgn)
        } catch {
          transaction.update(gameRef, { undo_request: null })
          return 'noop'
        }
        if (g.history().length === 0) {
          transaction.update(gameRef, { undo_request: null })
          return 'noop'
        }

        const requestorColor = req.from_id === fresh.white_player_id ? 'w' : 'b'
        const plies = requestorColor === g.turn() ? 2 : 1
        for (let i = 0; i < plies && g.history().length > 0; i++) g.undo()

        const updateFields: Record<string, unknown> = {
          fen: g.fen(),
          turn: g.turn(),
          pgn: g.pgn(),
          last_move_time: Date.now(),
          undo_request: null,
        }
        const atomic = g as unknown as { getAtomicState?: () => unknown }
        if (atomic.getAtomicState) {
          updateFields.spell_state_json = JSON.stringify(atomic.getAtomicState())
        }

        transaction.update(gameRef, updateFields)
        return 'ok'
      })

      if (outcome === 'finished') addToast('Партия уже завершена', 'error')
      else if (outcome === 'stale') addToast('Запрос на отмену устарел', 'error')
      else if (outcome === 'missing') addToast('Партия не найдена', 'error')
      else if (outcome === 'unsupported') addToast('Отмена хода недоступна в этом режиме', 'error')
      else if (outcome === 'noop') addToast('Отменять нечего', 'warning')
    } catch {
      addToast('Ошибка при отмене хода', 'error')
    }
  }, [gameDocId, undoRequest, addToast])

  const handleRejectUndo = useCallback(async () => {
    if (!gameDocId) return
    try {
      await updateDoc(doc(db, 'games', gameDocId), { undo_request: null })
    } catch {
      addToast('Ошибка сети', 'error')
    }
  }, [gameDocId, addToast])

  const handleAcceptDraw = useCallback(async () => {
    if (!gameDocId || !drawRequest) return
    try {
      const outcome = await runTransaction(db, async (transaction): Promise<DrawOutcome> => {
        const gameRef = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(gameRef)
        const fresh = freshDoc.data()
        if (!fresh) return 'missing'
        // A draw accepted after the opponent delivered mate would overwrite a
        // decided result for both players.
        if (fresh.game_state === 'game_over') return 'finished'
        const req = fresh.draw_request
        if (!req || req.from_id !== drawRequest.from_id || req.created_at !== drawRequest.created_at) {
          return 'stale'
        }
        transaction.update(gameRef, {
          game_state: 'game_over',
          winner: null,
          message: 'draw',
          draw_request: null,
          undo_request: null,
        })
        return 'ok'
      })

      if (outcome === 'finished') addToast('Партия уже завершена', 'error')
      else if (outcome === 'stale') addToast('Предложение ничьей устарело', 'error')
      else if (outcome === 'missing') addToast('Партия не найдена', 'error')
    } catch {
      addToast('Ошибка при согласии на ничью', 'error')
    }
  }, [gameDocId, drawRequest, addToast])

  return {
    undoRequest,
    drawRequest,
    setUndoRequest,
    setDrawRequest,
    setRequestsFromSnapshot,
    handleAcceptUndo,
    handleRejectUndo,
    handleAcceptDraw,
  }
}
