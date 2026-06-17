import { useState, useCallback } from 'react'
import { doc, updateDoc, getDoc, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createEngine } from '@/lib/engine'
import { useToast } from '@/components/Toast'
import type { GameData } from '@/types'

export function useGameRequest(gameDocId: string | null) {
  const { addToast } = useToast()
  const [undoRequest, setUndoRequest] = useState<GameData['undo_request']>(null)
  const [drawRequest, setDrawRequest] = useState<GameData['draw_request']>(null)

  const setRequestsFromSnapshot = useCallback((newData: GameData) => {
    setUndoRequest(newData.undo_request)
    setDrawRequest(newData.draw_request)
  }, [])

  const handleAcceptUndo = useCallback(async (pgn: string) => {
    if (!gameDocId || !undoRequest) return
    try {
      const snap = await getDoc(doc(db, 'games', gameDocId))
      const data = snap.data()
      const requestorColor = undoRequest.from_id === data?.white_player_id ? 'w' : 'b'

      const g = createEngine()
      g.loadPgn(pgn)

      if (requestorColor === g.turn()) {
        g.undo()
        g.undo()
      } else {
        g.undo()
      }

      await runTransaction(db, async (transaction) => {
        const gameRef2 = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(gameRef2)
        if (!freshDoc.exists()) return
        transaction.update(gameRef2, {
          pgn: g.pgn(),
          fen: g.fen(),
          turn: g.turn(),
          last_move_time: Date.now(),
          undo_request: null,
        })
      })
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
      await runTransaction(db, async (transaction) => {
        const gameRef2 = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(gameRef2)
        if (!freshDoc.exists()) return
        transaction.update(gameRef2, {
          game_state: 'game_over',
          winner: null,
          message: 'draw',
          draw_request: null,
        })
      })
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
