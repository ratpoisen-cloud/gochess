import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, runTransaction, serverTimestamp, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/components/Toast'
import type { GameData, User } from '@/types'

export function useRematch(
  gameDocId: string | null,
  user: User | null,
  onRematchReady?: (gameId: string) => void,
) {
  const { addToast } = useToast()
  const [isRematchProposed, setIsRematchProposed] = useState(false)
  const [rematchGameId, setRematchGameId] = useState<string | null>(null)

  const setRematchFromSnapshot = useCallback((newData: GameData, currentUser: any) => {
    if (newData.rematch_game_id) {
      setRematchGameId(newData.rematch_game_id)
    } else if (newData.rematch_proposed_by && newData.rematch_proposed_by !== currentUser?.uid) {
      setIsRematchProposed(true)
    }
  }, [])

  const handleRematch = useCallback(async (playerColor: 'w' | 'b' | null) => {
    if (!gameDocId || !user || !playerColor) return

    try {
      await runTransaction(db, async (transaction) => {
        const docRef = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(docRef)
        const data = freshDoc.data() as GameData
        if (!data) return

        if (data.rematch_game_id) return

        if (data.rematch_proposed_by && data.rematch_proposed_by !== user.uid) {
          const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
          const newGameData = {
            room_code: newRoomCode,
            white_player_id: data.black_player_id,
            white_name: data.black_name || 'Игрок',
            black_player_id: data.white_player_id,
            black_name: data.white_name || 'Игрок',
            game_type: 'online',
            game_mode: data.game_mode || 'classic',
            pgn: '',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            game_state: 'active',
            turn: 'w',
            time_control: data.time_control || null,
            white_time_left: data.time_control?.base || null,
            black_time_left: data.time_control?.base || null,
            last_timer_update: serverTimestamp(),
            timer_status: data.time_control ? 'active' : null,
            created_at: serverTimestamp(),
            last_move_time: serverTimestamp(),
            reactions: [],
            undo_request: null,
            draw_request: null,
            rematch_proposed_by: null,
            rematch_game_id: null,
          }
          const newGameRef = doc(collection(db, 'games'))
          transaction.set(newGameRef, newGameData)
          transaction.update(docRef, { rematch_game_id: newGameRef.id })
        } else {
          transaction.update(docRef, { rematch_proposed_by: user.uid })
        }
      })

      const snap = await getDoc(doc(db, 'games', gameDocId))
      if (snap.data()?.rematch_proposed_by === user.uid && !snap.data()?.rematch_game_id) {
        addToast('Предложение реванша отправлено', 'info')
      }
    } catch {
      addToast('Ошибка при создании реванша', 'error')
    }
  }, [gameDocId, user, addToast])

  useEffect(() => {
    if (rematchGameId) {
      addToast('Реванш создан! Переход...', 'success')
      if (onRematchReady) {
        const timer = setTimeout(() => onRematchReady(rematchGameId), 1500)
        return () => clearTimeout(timer)
      }
    }
  }, [rematchGameId, addToast, onRematchReady])

  return {
    isRematchProposed,
    rematchGameId,
    setRematchGameId,
    setIsRematchProposed,
    setRematchFromSnapshot,
    handleRematch,
  }
}
