import { useEffect } from 'react'
import { doc, getDoc, query, collection, where, getDocs, runTransaction, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { GameData, User } from '@/types'

export function useRoomJoin(
  roomCode: string | undefined,
  user: User | null,
  authLoading: boolean,
  onJoined: (gameDocId: string) => void,
  onError: (error: string) => void,
  onLoading: (loading: boolean) => void,
) {
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      onLoading(false)
      return
    }
    if (!roomCode) return

    let cancelled = false

    const initRoom = async () => {
      try {
        const docRef = doc(db, 'games', roomCode)
        let docSnap = await getDoc(docRef)

        let gameDoc = null
        let data = null

        if (docSnap.exists()) {
          gameDoc = docSnap
          data = docSnap.data() as GameData
        } else {
          const q = query(collection(db, 'games'), where('room_code', '==', roomCode), limit(1))
          const snapshot = await getDocs(q)
          if (!snapshot.empty) {
            gameDoc = snapshot.docs[0]
            data = gameDoc.data() as GameData
          }
        }

        if (!gameDoc || !data) {
          if (!cancelled) {
            onError('Комната не найдена')
            onLoading(false)
          }
          return
        }

        // Already seated (reload / rematch) — no transaction needed.
        if (data.white_player_id === user.uid || data.black_player_id === user.uid) {
          if (cancelled) return
          onJoined(gameDoc.id)
          return
        }

        // Seat claim must re-read inside the transaction: two players opening the
        // same link both see a free seat in the pre-transaction snapshot, and a
        // silent no-op used to let the loser into the game without a chair.
        const result = await runTransaction(db, async (transaction): Promise<
          'claimed' | 'mine' | 'taken' | 'missing'
        > => {
          const freshDoc = await transaction.get(gameDoc.ref)
          const freshData = freshDoc.data() as GameData | undefined
          if (!freshData) return 'missing'
          if (freshData.white_player_id === user.uid || freshData.black_player_id === user.uid) return 'mine'

          const seat = !freshData.white_player_id ? 'white' : !freshData.black_player_id ? 'black' : null
          if (!seat) return 'taken'

          transaction.update(gameDoc.ref, {
            [`${seat}_player_id`]: user.uid,
            [`${seat}_name`]: user.displayName || 'Игрок',
          })
          return 'claimed'
        })

        if (cancelled) return
        if (result === 'taken') {
          onError('Комната уже заполнена')
          onLoading(false)
          return
        }
        if (result === 'missing') {
          onError('Комната не найдена')
          onLoading(false)
          return
        }
        onJoined(gameDoc.id)
      } catch {
        if (!cancelled) {
          onError('Ошибка входа в комнату')
          onLoading(false)
        }
      }
    }

    initRoom()
    return () => { cancelled = true }
  }, [roomCode, user, authLoading, onJoined, onError, onLoading])
}
