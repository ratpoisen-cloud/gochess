import { useState, useEffect, useCallback, useRef } from 'react'
import { doc, getDoc, runTransaction, serverTimestamp, collection, addDoc, query, where, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/components/Toast'
import { createRematchInTransaction, REMATCH_OFFER_TTL_MS } from '@/lib/challenges'
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

  /**
   * Clear rematch state when the room changes. GamePage is not remounted when
   * only the /game/:roomId param changes (a rematch navigates in place), so
   * without this a proposal made in the previous game kept its button label,
   * and a created rematch left the button stuck on "Переход..." forever.
   */
  const resetRematch = useCallback(() => {
    setIsRematchProposed(false)
    setRematchGameId(null)
  }, [])

  /**
   * Mark the mirrored lobby offer as answered once the rematch exists.
   *
   * createRematchInTransaction only touches the games collection, so without
   * this a rematch started from the in-game button left its `challenges` mirror
   * pending forever: the opponent would later see "Приглашение на реванш" for
   * a game that had already started. Two equality filters need no composite
   * index (zig-zag merge), so this runs outside the transaction.
   */
  const closeRematchMirror = useCallback(async (sourceGameId: string, gameId: string) => {
    try {
      const q = query(
        collection(db, 'challenges'),
        where('sourceGameId', '==', sourceGameId),
        where('status', '==', 'pending'),
      )
      const snap = await getDocs(q)
      await Promise.all(
        snap.docs.map((d) => updateDoc(d.ref, { status: 'accepted', gameId })),
      )
    } catch {
      /* the in-game path does not depend on the mirror */
    }
  }, [])

  /** Decline a rematch offered from the finished game. */
  const handleDeclineRematch = useCallback(async () => {
    if (!gameDocId || !user) return
    try {
      await updateDoc(doc(db, 'games', gameDocId), {
        rematch_proposed_by: null,
        rematch_game_id: null,
      })
      setIsRematchProposed(false)

      // Mark the mirrored lobby offer declined too, so it stops showing up.
      const q = query(
        collection(db, 'challenges'),
        where('sourceGameId', '==', gameDocId),
        where('status', '==', 'pending'),
      )
      const snap = await getDocs(q)
      await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { status: 'declined' })))
    } catch {
      addToast('Не удалось отклонить реванш', 'error')
    }
  }, [gameDocId, user, addToast])

  /** Navigate into the rematch immediately, without waiting on a timer. */
  const goToRematch = useCallback(() => {
    if (!rematchGameId || !onRematchReady) return
    onRematchReady(rematchGameId)
  }, [rematchGameId, onRematchReady])

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
          // Same mode, same time control, swapped sides — and idempotent: a
          // rematch created from either entry point is reused, never duplicated.
          const outcome = await createRematchInTransaction(db, transaction, gameDocId)
          if (outcome.gameId) {
            transaction.update(docRef, { rematch_proposed_by: null })
            void closeRematchMirror(gameDocId, outcome.gameId)
          }
        } else {
          // First click: offer it. The flag keeps the in-game button instant,
          // the mirrored challenge makes it visible from the lobby.
          transaction.update(docRef, { rematch_proposed_by: user.uid })
        }
      })

      // Mirror the offer into `challenges` so a player who left the game page
      // still sees it. Best-effort: the in-game button works without this.
      const snap = await getDoc(doc(db, 'games', gameDocId))
      const data = snap.data() as GameData | undefined
      if (
        data &&
        data.rematch_proposed_by === user.uid &&
        !data.rematch_game_id &&
        data.black_player_id &&
        data.black_player_id !== user.uid
      ) {
        await addDoc(collection(db, 'challenges'), {
          kind: 'rematch',
          fromId: user.uid,
          fromName: user.displayName,
          toId: data.black_player_id,
          mode: data.game_mode || 'classic',
          timeControl: data.game_mode === 'rapid' ? (data.time_control ?? null) : null,
          sourceGameId: gameDocId,
          status: 'pending',
          createdAt: serverTimestamp(),
          expiresAt: Date.now() + REMATCH_OFFER_TTL_MS,
        }).catch(() => {
          /* the in-game flag is the primary path */
        })

        addToast('Предложение реванша отправлено', 'info')
      }
    } catch {
      addToast('Ошибка при создании реванша', 'error')
    }
  }, [gameDocId, user, addToast])

  // Auto-enter the rematch shortly after it appears, but never depend on it:
  // the timer is kept in a ref so a re-render cannot cancel it, and the modal
  // in GamePage always offers an explicit "Перейти" button. The button used to
  // sit on "Переход..." forever when the effect was torn down before firing.
  const autoNavRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!rematchGameId) return
    if (!onRematchReady) return

    addToast('Реванш создан!', 'success')

    if (autoNavRef.current) clearTimeout(autoNavRef.current)
    autoNavRef.current = setTimeout(() => {
      autoNavRef.current = null
      onRematchReady(rematchGameId)
    }, 2000)

    return () => {
      if (autoNavRef.current) {
        clearTimeout(autoNavRef.current)
        autoNavRef.current = null
      }
    }
  }, [rematchGameId, addToast, onRematchReady])

  return {
    isRematchProposed,
    rematchGameId,
    setRematchGameId,
    setIsRematchProposed,
    setRematchFromSnapshot,
    resetRematch,
    handleRematch,
    handleDeclineRematch,
    goToRematch,
  }
}
