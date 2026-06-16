import { useState } from 'react'

export const CATEGORY_DEFAULTS = { form: '#78350f', glaze: '#4a7c59' }

const COLOR_WORDS = {
  red: '#ef4444', crimson: '#dc143c', scarlet: '#ff4040', ruby: '#9b111e',
  blue: '#3b82f6', cobalt: '#0047ab', navy: '#1e3a5f', indigo: '#4338ca', azure: '#007fff',
  green: '#22c55e', sage: '#87ae73', jade: '#00a86b', olive: '#708238', moss: '#8a9a5b',
  celadon: '#ace1af', tenmoku: '#2c1810', shino: '#f5efe6', ash: '#b2beb5',
  copper: '#b87333', iron: '#8b4513', rust: '#b7410e',
  gold: '#fbbf24', amber: '#f59e0b', yellow: '#eab308',
  purple: '#9333ea', lavender: '#967bb6', violet: '#8b5cf6',
  black: '#1c1917', charcoal: '#374151',
  white: '#f5f5f4', cream: '#fffdd0', ivory: '#fffff0',
  brown: '#78350f', clay: '#78350f',
  gray: '#6b7280', grey: '#6b7280',
  pink: '#ec4899', rose: '#f43f5e',
  orange: '#f97316', teal: '#14b8a6', turquoise: '#40e0d0', silver: '#c0c0c0',
}

export function detectColor(name) {
  const lower = name.toLowerCase()
  for (const [word, hex] of Object.entries(COLOR_WORDS)) {
    if (lower.includes(word)) return hex
  }
  return null
}

function hexToRgb(hex) {
  const h = (hex || '').replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const int = parseInt(full, 16)
  if (Number.isNaN(int) || full.length !== 6) return { r: 0, g: 0, b: 0 }
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

// WCAG relative luminance (0 = black, 1 = white).
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  const lin = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

// Black or white ink that reads against a solid fill of `hex`.
export function readableTextColor(hex) {
  return luminance(hex) > 0.55 ? '#1c1917' : '#ffffff'
}

function mix(hex, target, amt) {
  const a = hexToRgb(hex)
  const b = hexToRgb(target)
  return rgbToHex(a.r + (b.r - a.r) * amt, a.g + (b.g - a.g) * amt, a.b + (b.b - a.b) * amt)
}

export function isDarkMode() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}

// Nudge a chip color so an outlined chip's text/border stays legible against the
// current theme surface: lighten very dark colors in dark mode, darken very
// light colors in light mode. Returns the color unchanged when already legible.
export function contrastColor(hex, dark = isDarkMode()) {
  const L = luminance(hex)
  if (dark && L < 0.22) return mix(hex, '#ffffff', 0.55)
  if (!dark && L > 0.72) return mix(hex, '#1c1917', 0.5)
  return hex
}

export function useTagColors() {
  const [tagColors, setTagColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('potheads_tag_colors') || '{}') } catch { return {} }
  })
  const [recentColors, setRecentColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('potheads_recent_tag_colors') || '[]') } catch { return [] }
  })

  function saveTagColor(name, hex) {
    const current = tagColors
    const next = { ...current, [name]: hex }
    localStorage.setItem('potheads_tag_colors', JSON.stringify(next))
    setTagColors(next)
  }

  function addRecentColor(hex) {
    const next = [hex, ...recentColors.filter(c => c !== hex)].slice(0, 8)
    localStorage.setItem('potheads_recent_tag_colors', JSON.stringify(next))
    setRecentColors(next)
  }

  return { tagColors, recentColors, saveTagColor, addRecentColor }
}
