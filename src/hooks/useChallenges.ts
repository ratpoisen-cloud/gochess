import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './useAuth'
import type { Challenge, GameMode } from '@/types'

export function useChallenges() {
  const { user } = useAuth()
  const [incomingChallenges, setIncomingChallenges] = useState<Challenge[]>([])

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

  const sendChallenge = async (toId: string, mode: GameMode) => {
    if (!user || !db) return
    
    await addDoc(collection(db, 'challenges'), {
      fromId: user.uid,
      fromName: user.displayName,
      toId,
      mode,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: Date.now() + 60000 // 60 seconds life
    })
  }

  const acceptChallenge = async (challengeId: string) => {
    if (!db) return
    await updateDoc(doc(db, 'challenges', challengeId), {
      status: 'accepted'
    })
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
