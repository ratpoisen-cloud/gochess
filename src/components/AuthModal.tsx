import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from './Toast'
import { isConfigured } from '@/lib/supabase'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const { addToast } = useToast()

  if (!isConfigured) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Авторизация" description="Функция временно недоступна">
        <div className="text-center py-[var(--space-20)]">
          <p className="text-text-secondary text-[var(--font-size-sm)] mb-[var(--space-16)]">
            Авторизация через Supabase ещё не настроена.
          </p>
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
        </div>
      </Modal>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      addToast('Пожалуйста, заполните все поля', 'warning')
      return
    }

    setLoading(true)
    try {
      if (isLogin) {
        await signInWithEmail(email, password)
        addToast('Успешный вход!', 'success')
        onClose()
      } else {
        const data = await signUpWithEmail(email, password)
        if (data.session) {
          addToast('Аккаунт создан и выполнен вход!', 'success')
          onClose()
        } else {
          addToast('Аккаунт создан. Пожалуйста, подтвердите ваш email.', 'info')
          onClose()
        }
      }
    } catch (err: any) {
      addToast(err.message || 'Произошла ошибка', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch (err: any) {
      addToast(err.message || 'Ошибка входа через Google', 'error')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isLogin ? 'Вход в аккаунт' : 'Регистрация'}
      description={isLogin ? 'С возвращением!' : 'Создайте аккаунт, чтобы сохранять прогресс'}
    >
      <form onSubmit={handleSubmit} className="space-y-[var(--space-16)]">
        <div className="space-y-[var(--space-8)] text-left">
          <label className="text-[var(--font-size-xs)] text-text-secondary font-medium px-[var(--space-4)]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-[var(--move-list-bg)] border border-[color-mix(in_srgb,var(--border)_60%,transparent)] rounded-[var(--radius-12)] p-[12px] text-text text-[var(--font-size-sm)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>

        <div className="space-y-[var(--space-8)] text-left">
          <label className="text-[var(--font-size-xs)] text-text-secondary font-medium px-[var(--space-4)]">
            Пароль
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-[var(--move-list-bg)] border border-[color-mix(in_srgb,var(--border)_60%,transparent)] rounded-[var(--radius-12)] p-[12px] text-text text-[var(--font-size-sm)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>

        <Button type="submit" fullWidth disabled={loading}>
          {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Создать аккаунт'}
        </Button>

        <div className="relative py-[var(--space-8)]">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)]"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[var(--modal-bg)] px-[var(--space-12)] text-[var(--font-size-xs)] text-text-secondary uppercase tracking-widest">
              Или
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          fullWidth
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-[var(--space-8)]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google
        </Button>

        <p className="text-[var(--font-size-xs)] text-text-secondary mt-[var(--space-16)]">
          {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-[var(--accent)] font-semibold hover:underline"
          >
            {isLogin ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </p>
      </form>
    </Modal>
  )
}
