import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, EyeOff, Bookmark } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type FeedbackType = 'like' | 'dislike' | 'hide' | 'save';

interface FeedbackButtonsProps {
  onFeedback: (type: FeedbackType) => void;
  currentFeedback?: FeedbackType | null;
  isLoading?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  showLabels?: boolean;
}

export function FeedbackButtons({
  onFeedback,
  currentFeedback,
  isLoading = false,
  className,
  size = 'sm',
  showLabels = false,
}: FeedbackButtonsProps) {
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const buttonSize = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';

  const buttons = [
    {
      type: 'like' as FeedbackType,
      icon: ThumbsUp,
      label: 'Me interesa',
      activeClass: 'text-green-600 bg-green-50',
    },
    {
      type: 'dislike' as FeedbackType,
      icon: ThumbsDown,
      label: 'No me interesa',
      activeClass: 'text-red-600 bg-red-50',
    },
    {
      type: 'hide' as FeedbackType,
      icon: EyeOff,
      label: 'Ocultar',
      activeClass: 'text-gray-600 bg-gray-100',
    },
    {
      type: 'save' as FeedbackType,
      icon: Bookmark,
      label: 'Guardar',
      activeClass: 'text-blue-600 bg-blue-50',
    },
  ];

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-1', className)}>
        {buttons.map(({ type, icon: Icon, label, activeClass }) => (
          <Tooltip key={type}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  buttonSize,
                  'rounded-full transition-colors',
                  currentFeedback === type && activeClass
                )}
                onClick={() => onFeedback(type)}
                disabled={isLoading}
              >
                <Icon className={iconSize} />
                {showLabels && (
                  <span className="ml-1 text-xs">{label}</span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

// Simple thumbs up/down only version
export function SimpleFeedback({
  onLike,
  onDislike,
  liked,
  disliked,
  className,
}: {
  onLike: () => void;
  onDislike: () => void;
  liked?: boolean;
  disliked?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-7 w-7 rounded-full',
          liked && 'text-green-600 bg-green-50'
        )}
        onClick={onLike}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-7 w-7 rounded-full',
          disliked && 'text-red-600 bg-red-50'
        )}
        onClick={onDislike}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
