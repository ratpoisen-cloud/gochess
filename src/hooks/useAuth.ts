import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const { user, setUser, isLoading, setLoading } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          uid: session.user.id,
          displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Игрок',
          email: session.user.email || '',
          photoURL: session.user.user_metadata?.custom_avatar_url || session.user.user_metadata?.avatar_url || null,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          uid: session.user.id,
          displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Игрок',
          email: session.user.email || '',
          photoURL: session.user.user_metadata?.custom_avatar_url || session.user.user_metadata?.avatar_url || null,
        })
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setLoading])

  const signInWithGoogle = async () => {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      throw error
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      throw error
    }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    setError(null)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      throw error
    }
    return data
  }

  const signOut = async () => {
    setError(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setError(error.message)
      throw error
    }
  }

  const uploadAvatar = async (file: File) => {
    if (!user) throw new Error('Пользователь не авторизован')
    
    const extension = file.name.split('.').pop()
    const filePath = `${user.uid}/avatar-${Date.now()}.${extension}`
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file)
      
    if (uploadError) throw uploadError
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)
      
    await updateProfile({ custom_avatar_url: publicUrl })
    return publicUrl
  }

  const updateProfile = async (updates: Record<string, any>) => {
    const { data, error } = await supabase.auth.updateUser({
      data: updates
    })
    if (error) throw error
    
    if (data.user) {
      setUser({
        uid: data.user.id,
        displayName: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Игрок',
        email: data.user.email || '',
        photoURL: data.user.user_metadata?.custom_avatar_url || data.user.user_metadata?.avatar_url || null,
      })
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
