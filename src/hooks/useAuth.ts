import { useEffect, useState, useCallback } from 'react'
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import {
  ensureAuthSubscription,
  normalizeUser,
  applyAuthDomState,
} from '@/lib/authSubscription'

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
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  const [error, setError] = useState<string | null>(null)

  const handleUserChange = useCallback((firebaseUser: FirebaseUser | null) => {
    const normalized = normalizeUser(firebaseUser)
    useAuthStore.getState().setUser(normalized)
    applyAuthDomState(normalized)
  }, [])

  useEffect(() => {
    ensureAuthSubscription()
  }, [])

  const signInWithGoogle = async () => {
    if (!auth) return
    setError(null)
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    if (!auth) return
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
    if (!auth) return
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
    if (!auth) return
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
