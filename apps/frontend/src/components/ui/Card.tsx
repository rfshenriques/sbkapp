import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div className={cn('rounded-2xl border border-border bg-surface p-4', className)} {...props} />
  );
}
