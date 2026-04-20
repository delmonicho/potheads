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
