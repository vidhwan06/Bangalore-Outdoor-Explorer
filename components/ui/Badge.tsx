// Badge Component
import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  dotColor?: string;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot, dotColor, children, ...props }, ref) => {
    const variants = {
      default: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300',
      primary: 'bg-primary/10 text-primary dark:bg-primary/20',
      secondary: 'bg-secondary text-secondary-foreground',
      success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      destructive: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      outline: 'border border-border bg-transparent',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-xs',
      lg: 'px-3 py-1 text-sm',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'rounded-full',
              'h-1.5 w-1.5',
              size === 'lg' && 'h-2 w-2',
              dotColor || (variant === 'success' && 'bg-green-500'),
              dotColor || (variant === 'warning' && 'bg-yellow-500'),
              dotColor || (variant === 'destructive' && 'bg-red-500'),
              dotColor || (variant === 'primary' && 'bg-primary'),
              dotColor || 'bg-surface-400'
            )}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
