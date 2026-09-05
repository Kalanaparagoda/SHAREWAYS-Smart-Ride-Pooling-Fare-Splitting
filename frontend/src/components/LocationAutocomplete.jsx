/**
 * LocationAutocomplete — Nominatim-powered location search input with optional GPS button.
 * 100% free, no API key required. Replaces @react-google-maps/api Places Autocomplete.
 *
 * Props (same API as before):
 *   id, name, value, onChange   — standard input props
 *   onPlaceSelected(place)      — fired when user picks a suggestion ({ display_name, lat, lng })
 *   placeholder                 — input placeholder
 *   required                    — HTML required attribute
 *   showGpsButton               — show GPS crosshair button (use for origin/departure only)
 *   onGpsResult(address, lat, lng) — callback with reverse-geocoded GPS result
 *   className                   — override input class
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'

const PHOTON_BASE = 'https://photon.komoot.io'
const DEBOUNCE_MS = 300

/**
 * @typedef {{ properties: { name: string, city?: string, district?: string, state?: string }, geometry: { coordinates: [number, number] } }} PhotonResult
 */

/**
 * Reverse geocode lat/lng → address string using Nominatim.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{address: string, success: boolean}>}
 */
async function reverseGeocodeNominatim(lat, lng) {
  const rawCoords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'json' })
    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'CommuteShareSL/1.0' },
    })
    if (!res.ok) return { address: rawCoords, success: false }
    const data = await res.json()
    const address = data?.display_name || rawCoords
    return { address, success: !!data?.display_name }
  } catch {
    return { address: rawCoords, success: false }
  }
}

export default function LocationAutocomplete({
  id,
  name,
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  required = false,
  showGpsButton = false,
  onGpsResult,
  className = 'input-field',
}) {
  /** @type {[NominatimResult[], React.Dispatch<React.SetStateAction<NominatimResult[]>>]} */
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const debounceRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null))
  const containerRef = useRef(/** @type {HTMLDivElement|null} */ (null))

  // ── Photon search ────────────────────────────────────────────────────────
  const searchPhoton = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    setFetching(true)
    setShowDropdown(true)
    try {
      const url = `${PHOTON_BASE}/api/?q=${encodeURIComponent(query)}&bbox=79.5,5.8,82.0,9.9&limit=6`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Photon request failed')
      /** @type {{features: PhotonResult[]}} */
      const data = await res.json()
      setSuggestions(data.features || [])
      setShowDropdown(data.features?.length > 0)
      setActiveIndex(-1)
    } catch {
      setSuggestions([])
      setShowDropdown(false)
    } finally {
      setFetching(false)
    }
  }, [])

  // ── Debounced input handler ─────────────────────────────────────────────────
  function handleInputChange(e) {
    onChange(e)
    const query = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      searchPhoton(query)
    }, DEBOUNCE_MS)
  }

  // ── Suggestion selection ────────────────────────────────────────────────────
  /** @param {PhotonResult} suggestion */
  function handleSelect(suggestion) {
    const { name, city, district, state } = suggestion.properties
    const label = name + (city || district || state ? `, ${city || district || state}` : '')
    
    onChange({ target: { name, value: label } })
    onPlaceSelected?.({
      display_name: label,
      lat: suggestion.geometry.coordinates[1],
      lng: suggestion.geometry.coordinates[0],
      formatted_address: label,
    })
    setSuggestions([])
    setShowDropdown(false)
    setActiveIndex(-1)
  }

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  function handleKeyDown(e) {
    if (!showDropdown || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  // ── Click outside to close ──────────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── GPS handler ─────────────────────────────────────────────────────────────
  function handleGpsClick() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try {
          const result = await reverseGeocodeNominatim(lat, lng)
          onChange({ target: { name, value: result.address } })
          onGpsResult?.(result.address, lat, lng)
          if (result.success) {
            toast.success('📍 Location detected!')
          } else {
            toast.error('Location found, but could not get address.')
          }
        } catch {
          const rawCoords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          onChange({ target: { name, value: rawCoords } })
          onGpsResult?.(rawCoords, lat, lng)
          toast.error('Location found, but could not get address.')
        } finally {
          setGpsLoading(false)
        }
      },
      (err) => {
        setGpsLoading(false)
        const messages = {
          1: 'Location permission denied. Please allow access in your browser settings.',
          2: 'Location unavailable. Try again.',
          3: 'Location request timed out.',
        }
        toast.error(messages[err.code] || 'Could not get location')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      <div className="flex-1 relative">
        {/* Text input */}
        <input
          id={id}
          name={name}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          required={required}
          className={className}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={`${id}-suggestions`}
          aria-activedescendant={activeIndex >= 0 ? `${id}-suggestion-${activeIndex}` : undefined}
        />

        {/* Fetching indicator inside input */}
        {fetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Suggestions dropdown */}
        {showDropdown && (fetching || suggestions.length > 0) && (
          <ul
            id={`${id}-suggestions`}
            role="listbox"
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg overflow-hidden max-h-60 overflow-y-auto"
          >
            {fetching ? (
              <li className="px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Searching Sri Lanka...
              </li>
            ) : (
              suggestions.map((s, idx) => {
                const { name, city, district, state } = s.properties
                const primary = name || 'Unknown Location'
                const secondary = [city, district, state].filter(Boolean).join(', ')
                
                return (
                  <li
                    key={idx}
                    id={`${id}-suggestion-${idx}`}
                    role="option"
                    aria-selected={idx === activeIndex}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelect(s)
                    }}
                    className={`px-4 py-2.5 cursor-pointer flex items-start gap-2.5 transition-colors ${
                      idx === activeIndex
                        ? 'bg-orange-50 text-orange-700'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <svg
                      className="w-4 h-4 mt-0.5 shrink-0 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{primary}</span>
                      {secondary && <span className="text-xs text-slate-400">{secondary}</span>}
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        )}
      </div>

      {/* GPS Button — shown only for origin/departure field */}
      {showGpsButton && (
        <button
          type="button"
          onClick={handleGpsClick}
          disabled={gpsLoading}
          title="Use my current location"
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-400 hover:text-orange-600 text-slate-400 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {gpsLoading ? (
            <svg className="w-4 h-4 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06z"
              />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
