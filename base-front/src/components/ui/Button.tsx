import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> & {
  variant?: Variant
  leftIcon?: React.ReactNode
  size?: Size
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-[var(--accent-primary)] text-[var(--color-on-primary)] border border-transparent shadow-soft hover:brightness-110',
  secondary: 'bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--surface)]',
  ghost: 'bg-transparent text-[var(--text-primary)] border border-transparent hover:bg-white/5 hover:border-[var(--border-subtle)]',
  danger: 'bg-[var(--danger)] text-[var(--color-on-primary)] border border-transparent hover:brightness-110',
}

const sizeStyles: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-xs rounded-xl',
  md: 'min-h-11 px-4 text-sm rounded-2xl',
  lg: 'min-h-12 px-5 text-sm rounded-2xl',
}

export function Button({ variant = 'primary', size = 'md', className = '', leftIcon, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] ' +
        variantStyles[variant] +
        ' ' +
        sizeStyles[size] +
        ' ' +
        className
      }
    >
      {leftIcon}
      {children}
    </button>
  )
}
