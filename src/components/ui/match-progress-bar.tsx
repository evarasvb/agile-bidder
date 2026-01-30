import * as React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface MatchProgressBarProps {
  matchedProducts: number;
  totalProducts: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function MatchProgressBar({
  matchedProducts,
  totalProducts,
  className,
  showLabel = true,
  size = 'md',
}: MatchProgressBarProps) {
  const percentage = totalProducts > 0 
    ? Math.round((matchedProducts / totalProducts) * 100) 
    : 0;

  const getProgressColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTextColor = (pct: number) => {
    if (pct >= 80) return 'text-green-600';
    if (pct >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between">
        {showLabel && (
          <span className="text-xs text-muted-foreground">
            {matchedProducts}/{totalProducts} productos emparejados
          </span>
        )}
        <span className={cn('text-sm font-semibold', getTextColor(percentage))}>
          {percentage}%
        </span>
      </div>
      <div className={cn('relative w-full rounded-full bg-secondary', sizeClasses[size])}>
        <div
          className={cn(
            'absolute left-0 top-0 h-full rounded-full transition-all duration-300',
            getProgressColor(percentage)
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function MatchProgressBadge({
  percentage,
  className,
}: {
  percentage: number;
  className?: string;
}) {
  const getColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-100 text-green-800 border-green-300';
    if (pct >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        getColor(percentage),
        className
      )}
    >
      <div
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
        )}
      />
      {percentage}%
    </div>
  );
}
