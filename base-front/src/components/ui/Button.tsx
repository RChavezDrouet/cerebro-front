import React from 'react'

type Variant = 'primary' | 'secondary' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> & {
  variant?: Variant
  leftIcon?: React.ReactNode
  size?: Size
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-[var(--primary)] text-white hover:opacity-95 shadow-soft',
  secondary: 'bg-white/10 text-white hover:bg-white/15 border border-white/10',
  danger: 'bg-[var(--danger)] text-white hover:opacity-95',
}

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-2 text-xs rounded-xl',
  md: 'px-4 py-2.5 text-sm rounded-2xl',
  lg: 'px-5 py-3 text-sm rounded-2xl',
}

export function Button({ variant = 'primary', size = 'md', className = '', leftIcon, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={
        'inline-flex items-center justify-center gap-2 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ' +
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
