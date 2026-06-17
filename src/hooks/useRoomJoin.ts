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

        if (!data.white_player_id && data.black_player_id !== user.uid) {
          await runTransaction(db, async (transaction) => {
            const freshDoc = await transaction.get(gameDoc.ref)
            const freshData = freshDoc.data() as GameData | undefined
            if (!freshData) return
            if (!freshData.white_player_id && freshData.black_player_id !== user.uid) {
              transaction.update(gameDoc.ref, {
                white_player_id: user.uid,
                white_name: user.displayName || 'Игрок',
              })
            }
          })
        } else if (!data.black_player_id && data.white_player_id !== user.uid) {
          await runTransaction(db, async (transaction) => {
            const freshDoc = await transaction.get(gameDoc.ref)
            const freshData = freshDoc.data() as GameData | undefined
            if (!freshData) return
            if (!freshData.black_player_id && freshData.white_player_id !== user.uid) {
              transaction.update(gameDoc.ref, {
                black_player_id: user.uid,
                black_name: user.displayName || 'Игрок',
              })
            }
          })
        } else if (data.white_player_id !== user.uid && data.black_player_id !== user.uid) {
          if (!cancelled) {
            onError('Комната уже заполнена')
            onLoading(false)
          }
          return
        }

        if (cancelled) return
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
