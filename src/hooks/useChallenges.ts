import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './useAuth'
import { acceptIncomingChallenge, CHALLENGE_TTL_MS, type AcceptResult } from '@/lib/challenges'
import type { Challenge, GameMode } from '@/types'
import type { TimeControl } from '@/lib/gameDoc'

const JOINED_GAME_KEY = 'gochess:joined-game'

export function useChallenges() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pendingChallenges, setPendingChallenges] = useState<Challenge[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [outgoingGameId, setOutgoingGameId] = useState<string | null>(null)

  // Expiry has to be re-checked continuously, not only when a snapshot
  // arrives: otherwise a challenge that expires while the modal is open
  // stays on screen forever and the accept button keeps working.
  // (A server-side expiresAt range filter is not possible here: Firestore
  // forbids a range field that is not the first orderBy.)
  useEffect(() => {
    if (pendingChallenges.length === 0) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [pendingChallenges.length])

  const incomingChallenges = useMemo(
    () => pendingChallenges.filter((c) => c.expiresAt > now),
    [pendingChallenges, now],
  )

  useEffect(() => {
    if (!user) {
      setPendingChallenges([])
      return
    }
    if (!db) return

    const q = query(
      collection(db, 'challenges'),
      where('toId', '==', user.uid),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const challenges = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Challenge[]
      setPendingChallenges(challenges)
    })

    return () => unsubscribe()
  }, [user])

  // Listen for accepted outgoing challenges
  useEffect(() => {
    if (!user || !db) return

    const q = query(
      collection(db, 'challenges'),
      where('fromId', '==', user.uid),
      where('status', '==', 'accepted'),
      orderBy('createdAt', 'desc'),
      limit(1)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as any
        if (data.gameId && data.expiresAt > Date.now()) {
          // Already joined this game in this tab (left the lobby and came
          // back within the TTL) — do not drag the player back in.
          if (sessionStorage.getItem(JOINED_GAME_KEY) === data.gameId) return
          setOutgoingGameId(data.gameId)
        }
      }
    })

    return () => unsubscribe()
  }, [user])

  // Navigate when challenge accepted
  useEffect(() => {
    if (outgoingGameId) {
      sessionStorage.setItem(JOINED_GAME_KEY, outgoingGameId)
      navigate(`/game/${outgoingGameId}`)
      setOutgoingGameId(null)
    }
  }, [outgoingGameId, navigate])

  const sendChallenge = async (toId: string, mode: GameMode, timeControl?: TimeControl | null) => {
    if (!user || !db) return

    await addDoc(collection(db, 'challenges'), {
      kind: 'challenge',
      fromId: user.uid,
      fromName: user.displayName,
      toId,
      mode,
      timeControl: mode === 'rapid' ? (timeControl ?? null) : null,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    })
  }

  /**
   * Accept a challenge of either kind. Delegates to the shared helper so the
   * lobby pages and the in-game rematch button cannot drift apart; the helper
   * is idempotent, so a double click reuses the same game.
   */
  const acceptChallenge = async (challenge: Challenge): Promise<AcceptResult> => {
    if (!db || !user) return { gameId: '', created: false, error: 'no-db' }
    return acceptIncomingChallenge(
      challenge,
      { uid: user.uid, displayName: user.displayName },
      db,
    )
  }

  const declineChallenge = async (challengeId: string) => {
    if (!db) return
    await updateDoc(doc(db, 'challenges', challengeId), {
      status: 'declined'
    })
  }

  return {
    incomingChallenges,
    now,
    sendChallenge,
    acceptChallenge,
    declineChallenge
  }
}
