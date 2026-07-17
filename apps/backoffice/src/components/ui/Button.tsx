import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-slate-950 hover:bg-brand-hover',
  secondary: 'bg-surface text-text-primary border border-border hover:bg-surface-hover',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface',
  danger: 'bg-danger text-white hover:bg-red-600',
};

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClassName[variant],
        className,
      )}
      {...props}
    />
  );
}
