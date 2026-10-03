import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'

export const normalizeUser = (firebaseUser: FirebaseUser | null): User | null => {
  if (!firebaseUser) return null

  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Игрок',
    email: firebaseUser.email || '',
    photoURL: firebaseUser.photoURL,
    customAvatarURL: null, // Storage migration skipped as per user request
  }
}

export const applyAuthDomState = (normalized: User | null): void => {
  if (normalized) {
    document.body.classList.add('auth-state')
    document.body.classList.remove('guest-state')
  } else {
    document.body.classList.remove('auth-state')
    document.body.classList.add('guest-state')
  }
}

let started = false

/**
 * Единственная подписка на onAuthStateChanged на всё приложение.
 * Идемпотентна: повторные вызовы из useAuth ничего не делают, поэтому
 * normalizeUser и записи в стор выполняются один раз на событие входа,
 * а не по разу на каждый из ~16 потребителей хука.
 */
export function ensureAuthSubscription(): void {
  if (started) return
  started = true

  const { setUser, setLoading } = useAuthStore.getState()

  if (!auth) {
    setLoading(false)
    return
  }

  setLoading(true)
  onAuthStateChanged(
    auth,
    (firebaseUser) => {
      const normalized = normalizeUser(firebaseUser)
      setUser(normalized)
      applyAuthDomState(normalized)
      setLoading(false)
    },
    (err) => {
      console.error('[Auth] State change error:', err)
      setLoading(false)
    }
  )
}
