import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-slate-950 hover:bg-brand-hover',
  secondary: 'bg-surface text-text-primary border border-border hover:bg-surface-hover',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface',
};

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClassName[variant],
        className,
      )}
      {...props}
    />
  );
}
