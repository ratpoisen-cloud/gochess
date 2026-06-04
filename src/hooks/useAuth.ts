import { useEffect, useState, useCallback } from 'react'
import { 
  onAuthStateChanged, 
  signInWithRedirect, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  type User as FirebaseUser
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'

const normalizeUser = (firebaseUser: FirebaseUser | null): User | null => {
  if (!firebaseUser) return null
  
  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Игрок',
    email: firebaseUser.email || '',
    photoURL: firebaseUser.photoURL,
    customAvatarURL: null // Storage migration skipped as per user request
  }
}

const mapAuthError = (err: any) => {
  if (!err) return new Error('Ошибка авторизации')
  const code = err.code || ''
  
  if (code === 'auth/invalid-credential') {
    return new Error('Неверная почта или пароль')
  }
  if (code === 'auth/email-already-in-use') {
    return new Error('Эта почта уже зарегистрирована')
  }
  if (code === 'auth/weak-password') {
    return new Error('Пароль слишком слабый')
  }
  if (code === 'auth/user-not-found') {
    return new Error('Пользователь не найден')
  }
  return err
}

export function useAuth() {
  const { user, setUser, isLoading, setLoading } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  const handleUserChange = useCallback((firebaseUser: FirebaseUser | null) => {
    const normalized = normalizeUser(firebaseUser)
    setUser(normalized)
    
    if (normalized) {
      document.body.classList.add('auth-state')
      document.body.classList.remove('guest-state')
    } else {
      document.body.classList.remove('auth-state')
      document.body.classList.add('guest-state')
    }
  }, [setUser])

  useEffect(() => {
    setLoading(true)
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      handleUserChange(firebaseUser)
      setLoading(false)
    }, (err) => {
      console.error('[Auth] State change error:', err)
      setError('Ошибка подключения к серверу')
      setLoading(false)
    })

    return () => unsubscribe()
  }, [handleUserChange, setLoading])

  const signInWithGoogle = async () => {
    setError(null)
    const provider = new GoogleAuthProvider()
    try {
      await signInWithRedirect(auth, provider)
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err: any) {
      const mapped = mapAuthError(err)
      setError(mapped.message)
      throw mapped
    }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    setError(null)
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      return result
    } catch (err: any) {
      const mapped = mapAuthError(err)
      setError(mapped.message)
      throw mapped
    }
  }

  const signOut = async () => {
    setError(null)
    try {
      await firebaseSignOut(auth)
    } catch (err: any) {
      const mapped = mapAuthError(err)
      setError(mapped.message)
      throw mapped
    }
  }

  const updateProfile = async (updates: { displayName?: string; photoURL?: string }) => {
    if (!auth.currentUser) throw new Error('Пользователь не авторизован')
    
    try {
      await firebaseUpdateProfile(auth.currentUser, updates)
      handleUserChange(auth.currentUser)
    } catch (err) {
      console.error('[Auth] Update profile error:', err)
      throw err
    }
  }

  return {
    user,
    isLoading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    setError,
    updateProfile,
  }
}
