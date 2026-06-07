import { useEffect } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './useAuth'

export function usePresence() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const userRef = doc(db, 'users', user.uid)
    
    const updatePresence = async () => {
      try {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          lastSeen: serverTimestamp()
        }, { merge: true })
      } catch (err) {
        console.error('[Presence] Error updating lastSeen:', err)
      }
    }

    // Initial update
    updatePresence()

    // Update every 2 minutes
    const interval = setInterval(updatePresence, 120000)

    return () => clearInterval(interval)
  }, [user])
}
