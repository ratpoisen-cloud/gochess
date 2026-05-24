import { useEffect, useState, useCallback } from 'react'
import { supabase, isConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'

const normalizeUser = (supabaseUser: any): User | null => {
  if (!supabaseUser) return null
  
  const metadata = supabaseUser.user_metadata || {}
  const identities = supabaseUser.identities || []
  const firstIdentityData = identities[0]?.identity_data || {}
  
  const email = supabaseUser.email || ''
  const emailName = email.includes('@') ? email.split('@')[0] : ''
  
  const providerPhoto = metadata.avatar_url || metadata.picture || firstIdentityData.avatar_url || firstIdentityData.picture || null
  
  return {
    uid: supabaseUser.id,
    displayName: metadata.full_name || metadata.name || metadata.user_name || emailName || 'Игрок',
    email: email,
    photoURL: providerPhoto,
    customAvatarURL: metadata.custom_avatar_url || null
  }
}

const mapAuthError = (err: any) => {
  if (!err) return new Error('Auth error')
  const message = err.message || 'Auth error'
  if (message.includes('Invalid login credentials')) {
    return new Error('Неверная почта или пароль')
  }
  if (message.includes('User already registered')) {
    return new Error('Эта почта уже зарегистрирована')
  }
  return err
}

export function useAuth() {
  const { user, setUser, isLoading, setLoading } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  const handleUserChange = useCallback((supabaseUser: any) => {
    const normalized = normalizeUser(supabaseUser)
    setUser(normalized)
    
    // Toggle body classes like in the original auth.js
    if (normalized) {
      document.body.classList.add('auth-state')
      document.body.classList.remove('guest-state')
    } else {
      document.body.classList.remove('auth-state')
      document.body.classList.add('guest-state')
    }
  }, [setUser])

  useEffect(() => {
    if (!isConfigured || !supabase) {
      setLoading(false)
      document.body.classList.add('guest-state')
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserChange(session?.user || null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUserChange(session?.user || null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [handleUserChange, setLoading])

  const signInWithGoogle = async () => {
    if (!isConfigured || !supabase) {
      throw new Error('Supabase not configured')
    }
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: window.location.origin + (import.meta.env.BASE_URL || '/')
      },
    })
    if (error) {
      setError(error.message)
      throw error
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    if (!isConfigured || !supabase) {
      throw new Error('Supabase not configured')
    }
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const mapped = mapAuthError(error)
      setError(mapped.message)
      throw mapped
    }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    if (!isConfigured || !supabase) {
      throw new Error('Supabase not configured')
    }
    setError(null)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      const mapped = mapAuthError(error)
      setError(mapped.message)
      throw mapped
    }
    return data
  }

  const signOut = async () => {
    if (!isConfigured || !supabase) {
      throw new Error('Supabase not configured')
    }
    setError(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      const mapped = mapAuthError(error)
      setError(mapped.message)
      throw mapped
    }
  }

  const uploadAvatar = async (file: File) => {
    if (!isConfigured || !supabase) {
      throw new Error('Supabase not configured')
    }
    if (!user) throw new Error('Пользователь не авторизован')
    
    if (!file.type || !file.type.startsWith('image/')) {
      throw new Error('Можно загружать только изображения')
    }

    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      throw new Error('Файл слишком большой. Максимум 5 MB')
    }

    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const filePath = `${user.uid}/avatar.${extension}`
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type
      })
      
    if (uploadError) throw uploadError
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)
    
    const timestampedUrl = `${publicUrl}?t=${Date.now()}`
    await updateProfile({ custom_avatar_url: timestampedUrl })
    return timestampedUrl
  }

  const updateProfile = async (updates: Record<string, any>) => {
    if (!isConfigured || !supabase) {
      throw new Error('Supabase not configured')
    }
    const { data, error } = await supabase.auth.updateUser({
      data: updates
    })
    if (error) throw error
    
    if (data.user) {
      handleUserChange(data.user)
    }
    return data
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
    uploadAvatar,
    updateProfile,
  }
}
