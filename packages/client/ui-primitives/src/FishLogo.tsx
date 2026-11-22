import type { IconProps } from './icons/props.ts'

/**
 * The Massai face: six gold facets, a dark visor wedge and two ember eyes.
 * It replaces the upstream fish mark everywhere the app shows its own brand —
 * the sidebar identity, the brand slot and every fallback that used the fish.
 *
 * Coordinates are the same 0 0 512 512 artwork the hosted pages serve as
 * `/massai-face.svg`, inlined so the shell needs no network fetch to draw it.
 */
const FACE_GRADIENT_ID = 'massai-face-gold'

/** Native viewBox of the face mark (square). */
export const FACE_VIEWBOX = 512

/** The outer shell: a hexagonal helm seen head-on. */
const FACE_HELM = 'M 256 40 L 372 108 L 340 250 L 256 470 L 172 250 L 140 108 Z'

/** The visor: the dark wedge that carries the V. */
const FACE_VISOR = 'M 176 208 H 336 L 300 258 L 256 300 L 212 258 Z'

/**
 * Render the Massai face.
 * @param props.size - height in px (default 24).
 * @param props.className - extra class for layout placement.
 * @returns the mark svg (aria-hidden; pair with the wordmark for accessibility).
 */
export function FishLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox={`0 0 ${FACE_VIEWBOX} ${FACE_VIEWBOX}`}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={FACE_GRADIENT_ID} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FFEFC6" />
          <stop offset="40%" stopColor="#D9B463" />
          <stop offset="78%" stopColor="#9C7422" />
          <stop offset="100%" stopColor="#6B4C10" />
        </linearGradient>
      </defs>
      <path d={FACE_HELM} fill={`url(#${FACE_GRADIENT_ID})`} />
      <path d="M 256 40 L 256 470 L 172 250 L 140 108 Z" fill="#FFF3C6" fillOpacity="0.14" />
      <path d="M 256 40 L 372 108 L 340 250 L 256 470 Z" fill="#000000" fillOpacity="0.14" />
      <path d={FACE_VISOR} fill="#0a0a0c" />
      <rect x="196" y="228" width="44" height="14" rx="7" fill="#FF8A00" />
      <rect x="272" y="228" width="44" height="14" rx="7" fill="#FF8A00" />
      <rect x="202" y="230" width="32" height="9" rx="4.5" fill="#FFF6D0" />
      <rect x="278" y="230" width="32" height="9" rx="4.5" fill="#FFF6D0" />
      <path d="M 256 300 V 400" stroke="#0a0a0c" strokeWidth="10" strokeOpacity="0.45" />
    </svg>
  )
}
