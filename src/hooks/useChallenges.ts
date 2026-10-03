import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './useAuth'
import { acceptIncomingChallenge, CHALLENGE_TTL_MS, type AcceptResult } from '@/lib/challenges'
import type { Challenge, GameMode } from '@/types'
import type { TimeControl } from '@/lib/gameDoc'

export function useChallenges() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [incomingChallenges, setIncomingChallenges] = useState<Challenge[]>([])
  const [outgoingGameId, setOutgoingGameId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setIncomingChallenges([])
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
      
      // Filter out expired challenges locally just in case
      const now = Date.now()
      setIncomingChallenges(challenges.filter(c => c.expiresAt > now))
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
          setOutgoingGameId(data.gameId)
        }
      }
    })

    return () => unsubscribe()
  }, [user])

  // Navigate when challenge accepted
  useEffect(() => {
    if (outgoingGameId) {
      navigate(`/game/${outgoingGameId}`)
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
    sendChallenge,
    acceptChallenge,
    declineChallenge
  }
}
