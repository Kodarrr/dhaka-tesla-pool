'use client'

import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number | null   // 0-5, supports decimals
  reviewCount?: number
  size?: 'sm' | 'md'
  className?: string
}

export default function StarRating({ rating, reviewCount, size = 'sm', className }: StarRatingProps) {
  if (rating === null || reviewCount === 0) {
    return (
      <span className={cn('text-[#4d6080] text-xs', className)}>
        No ratings yet
      </span>
    )
  }

  const starSize = size === 'md' ? 'text-base' : 'text-sm'

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className={cn('tracking-tight', starSize)} aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rating >= i
          const half = !filled && rating >= i - 0.5
          return (
            <span
              key={i}
              className={cn(
                filled || half ? 'text-amber-400' : 'text-[#2a3650]'
              )}
            >
              {filled ? '★' : half ? '✩' : '☆'}
            </span>
          )
        })}
      </span>
      <span className="text-xs font-semibold text-[#f0f4ff]">{rating.toFixed(1)}</span>
      {reviewCount !== undefined && (
        <span className="text-xs text-[#4d6080]">({reviewCount})</span>
      )}
    </span>
  )
}
