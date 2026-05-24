import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg'
  bordered?: boolean
}

const paddingClasses: Record<string, string> = {
  sm: 'p-[var(--space-16)]',
  md: 'p-[var(--space-32)]',
  lg: 'p-[var(--space-40)]',
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', padding = 'md', bordered = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          bg-[var(--bg)]
          rounded-[var(--radius-8)]
          ${paddingClasses[padding]}
          ${bordered ? 'border border-[color-mix(in_srgb,var(--accent-brand)_30%,var(--border))]' : ''}
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
