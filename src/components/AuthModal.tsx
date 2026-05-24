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
      <button
        onClick={onClose}
        className="text-[10px] font-bold text-text-secondary hover:text-text transition-colors px-0 uppercase tracking-widest block mb-[var(--space-16)]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        Назад
      </button>
      <form onSubmit={handleSubmit} className="space-y-[var(--space-16)]">
        <div className="space-y-[var(--space-8)] text-left">
          <label className="text-[var(--font-size-xs)] text-[var(--accent-brand)] font-medium px-[var(--space-4)]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] p-[12px] text-text text-[var(--font-size-sm)] focus:outline-none focus:border-[var(--accent-brand)] transition-colors placeholder:text-[var(--input-placeholder)]"
          />
        </div>

        <div className="space-y-[var(--space-8)] text-left">
          <label className="text-[var(--font-size-xs)] text-[var(--accent-brand)] font-medium px-[var(--space-4)]">
            Пароль
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] p-[12px] text-text text-[var(--font-size-sm)] focus:outline-none focus:border-[var(--accent-brand)] transition-colors placeholder:text-[var(--input-placeholder)]"
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
            <span className="bg-[var(--bg)] px-[var(--space-12)] text-[var(--font-size-xs)] text-text-secondary uppercase tracking-widest">
              Или
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          fullWidth
          onClick={handleGoogleLogin}
          className="flex items-center justify-center"
        >
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
