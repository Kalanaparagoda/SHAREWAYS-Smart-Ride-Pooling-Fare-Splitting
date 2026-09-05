/**
 * StarRating — Reusable 5-star rating component.
 * Props:
 *   value: number (0-5)       — current rating
 *   onChange: fn(n)            — called when user clicks a star (omit for readonly)
 *   readonly: bool             — display only, no interaction
 *   size: 'sm' | 'md' | 'lg'  — icon size
 *   showLabel: bool            — show "x.x / 5" label
 */
import { useState } from 'react'

export default function StarRating({
  value = 0,
  onChange,
  readonly = false,
  size = 'md',
  showLabel = false,
}) {
  const [hovered, setHovered] = useState(0)

  const sizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-7 h-7' }
  const iconSize = sizes[size] || sizes.md

  const active = readonly ? value : (hovered || value)

  function StarIcon({ filled, half }) {
    if (half) {
      return (
        <svg className={iconSize} viewBox="0 0 24 24">
          <defs>
            <linearGradient id="half-fill">
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#e2e8f0" />
            </linearGradient>
          </defs>
          <path
            fill="url(#half-fill)"
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          />
        </svg>
      )
    }
    return (
      <svg className={iconSize} viewBox="0 0 24 24" fill={filled ? '#f97316' : 'none'} stroke={filled ? '#f97316' : '#cbd5e1'} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    )
  }

  // For readonly with fractional values, show half stars
  function getStarType(starIndex) {
    const v = value
    if (v >= starIndex) return 'full'
    if (v >= starIndex - 0.5) return 'half'
    return 'empty'
  }

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = readonly ? getStarType(star) === 'full' : active >= star
        const half = readonly && getStarType(star) === 'half'

        return readonly ? (
          <StarIcon key={star} filled={filled} half={half} />
        ) : (
          <button
            key={star}
            type="button"
            className="star-btn focus:outline-none"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange?.(star)}
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
          >
            <StarIcon filled={filled} />
          </button>
        )
      })}
      {showLabel && value > 0 && (
        <span className="ml-1.5 text-sm font-semibold text-slate-700">
          {typeof value === 'number' ? value.toFixed(1) : value}
          <span className="text-slate-400 font-normal"> / 5</span>
        </span>
      )}
    </div>
  )
}
