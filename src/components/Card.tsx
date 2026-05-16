import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg'
  bordered?: boolean
}

const paddingClasses: Record<string, string> = {
  sm: 'p-[var(--space-16)]',
  md: 'p-[30px]',
  lg: 'p-[var(--space-32)]',
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', padding = 'md', bordered = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          bg-gradient-to-b from-[color-mix(in_srgb,var(--surface-elevated)_55%,var(--card))] to-[color-mix(in_srgb,var(--card)_94%,#151915)]
          rounded-[var(--radius-24)]
          shadow-[0_12px_30px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(232,232,216,0.04)]
          ${paddingClasses[padding]}
          ${bordered ? 'border border-[color-mix(in_srgb,var(--accent)_12%,var(--border))]' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export default Card
