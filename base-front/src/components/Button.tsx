import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
}

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed'
  const styles =
    variant === 'primary'
      ? 'bg-indigo-600 hover:bg-indigo-500'
      : variant === 'danger'
        ? 'bg-rose-600 hover:bg-rose-500'
        : 'bg-white/10 hover:bg-white/15'

  return <button className={`${base} ${styles} ${className}`} {...props} />
}
