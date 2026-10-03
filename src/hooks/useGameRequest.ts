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

  const handleAcceptUndo = useCallback(async (pgn: string, mode?: string, ssj?: string | null) => {
    if (!gameDocId || !undoRequest) return
    try {
      const snap = await getDoc(doc(db, 'games', gameDocId))
      const data = snap.data()
      const requestorColor = undoRequest.from_id === data?.white_player_id ? 'w' : 'b'

      const engineMode = mode === 'spell_chess' ? 'spell' : mode === 'atomic_chess' ? 'atomic' : undefined
      const g = createEngine(engineMode)
      if (mode === 'spell_chess' && ssj) {
        try { (g as any).applySpellStateJSON?.(ssj) } catch {}
      }
      try {
        g.loadPgn(pgn)
      } catch {
        if (data?.fen) g.load(data.fen)
      }

      if (requestorColor === g.turn()) {
        g.undo()
        g.undo()
      } else {
        g.undo()
      }

      const updateFields: Record<string, any> = {
        fen: g.fen(),
        turn: g.turn(),
        last_move_time: Date.now(),
        undo_request: null,
      }

      updateFields.pgn = g.pgn()
      if ((g as any).spellStateToJSON) {
        updateFields.spell_state_json = (g as any).spellStateToJSON()
      } else if ((g as any).getAtomicState) {
        updateFields.spell_state_json = JSON.stringify((g as any).getAtomicState())
      }

      await runTransaction(db, async (transaction) => {
        const gameRef2 = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(gameRef2)
        if (!freshDoc.exists()) return
        transaction.update(gameRef2, updateFields)
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
