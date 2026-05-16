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
    'bg-gradient-to-b from-[color-mix(in_srgb,var(--accent)_86%,#cadbb8)] to-[var(--accent)] text-[var(--accent-contrast)] border-[color-mix(in_srgb,var(--accent-active)_56%,var(--border))] shadow-[0_6px_14px_var(--shadow-accent)] font-semibold hover:bg-gradient-to-b hover:from-[color-mix(in_srgb,var(--accent-hover)_85%,#d6e5c7)] hover:to-[var(--accent-hover)] hover:shadow-[0_8px_16px_var(--shadow-accent)] active:bg-[var(--accent-active)] active:shadow-[0_4px_10px_color-mix(in_srgb,var(--accent-active)_36%,transparent)]',
  outline:
    'bg-[color-mix(in_srgb,var(--surface-elevated)_76%,var(--surface))] text-text border border-[color-mix(in_srgb,var(--accent)_14%,var(--border))] hover:bg-[color-mix(in_srgb,var(--surface-elevated)_92%,var(--accent-soft))] hover:border-[color-mix(in_srgb,var(--accent)_38%,var(--border))] hover:shadow-[0_8px_14px_color-mix(in_srgb,#000_14%,transparent)]',
  draw:
    'bg-[var(--draw-bg)] text-[var(--draw-text)] border border-[var(--draw-border)] hover:bg-[var(--draw-hover)] hover:shadow-[0_6px_14px_var(--draw-hover-shadow)]',
  danger:
    'bg-[color-mix(in_srgb,var(--danger)_90%,#d07b7b)] text-[#fff8f8] border-[color-mix(in_srgb,var(--danger)_72%,var(--border))] hover:bg-[var(--danger-hover)] hover:shadow-[0_8px_16px_color-mix(in_srgb,var(--danger)_18%,#000_16%)]',
  success:
    'bg-[color-mix(in_srgb,var(--success)_90%,#cde2bf)] text-[var(--accent-contrast)] border-[color-mix(in_srgb,var(--success)_72%,var(--border))] hover:shadow-[0_8px_16px_color-mix(in_srgb,var(--success)_18%,#000_16%)]',
  ghost:
    'bg-transparent text-text hover:bg-[var(--accent-soft)] border border-transparent',
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
          shadow-[0_2px_0_color-mix(in_srgb,#000_26%,transparent)]
          transition-[background-color,border-color,box-shadow,transform,color]
          duration-[0.14s] ease-[steps(2,end)]
          hover:translate-y-[-2px] hover:shadow-[0_4px_0_color-mix(in_srgb,#000_32%,transparent),0_8px_16px_color-mix(in_srgb,#000_16%,transparent)]
          active:translate-y-[1px] active:scale-[0.985] active:shadow-[0_1px_0_color-mix(in_srgb,#000_30%,transparent)]
          focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--accent-soft),0_0_0_4px_color-mix(in_srgb,var(--accent)_28%,transparent)]
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
