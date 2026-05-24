import { ButtonHTMLAttributes, forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'outline' | 'draw' | 'danger' | 'success' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent-brand)] text-[var(--text)] border-[color-mix(in_srgb,var(--accent-brand)_60%,var(--border))] hover:bg-[color-mix(in_srgb,var(--accent-brand)_85%,transparent)] active:bg-[color-mix(in_srgb,var(--accent-brand)_70%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
  outline:
    'bg-[var(--bg)] text-text border border-[var(--border)] hover:bg-[color-mix(in_srgb,var(--accent-brand)_10%,transparent)] hover:border-[rgba(232,232,216,0.25)]',
  draw:
    'bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] hover:bg-[color-mix(in_srgb,var(--accent-brand)_10%,transparent)]',
  danger:
    'bg-[var(--danger-soft)] text-[var(--text)] border-[var(--danger-border)] hover:bg-[color-mix(in_srgb,var(--danger-soft)_120%,transparent)] active:scale-[0.98]',
  success:
    'bg-[var(--success)] text-white border-[color-mix(in_srgb,var(--success)_60%,var(--border))] hover:bg-[color-mix(in_srgb,var(--success)_80%,transparent)]',
  ghost:
    'bg-transparent text-text hover:bg-[color-mix(in_srgb,var(--accent-brand)_15%,transparent)] border border-transparent',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[40px] px-[14px] text-[0.76rem]',
  md: 'min-h-[var(--btn-height)] px-[var(--btn-padding-x)] text-[var(--btn-font-size)]',
  lg: 'min-h-[var(--btn-height-lg)] px-[20px] text-[0.88rem]',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', fullWidth = false, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center
          border rounded-[var(--btn-radius)]
          font-semibold cursor-pointer
          leading-[1.3] text-center
          tracking-[0.012em]
          shadow-none
          transition-[background-color,border-color,color]
          duration-[0.14s] ease-[steps(2,end)]
          hover:translate-y-[-2px]
          active:translate-y-[1px] active:scale-[0.985]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-brand)_40%,transparent)]
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
