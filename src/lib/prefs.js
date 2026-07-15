const THEME_KEY = 'potheads.prefs.theme'
const DENSITY_KEY = 'potheads.prefs.density'
const COLLAPSED_STAGES_KEY = 'potheads_collapsed_stages'
const DEFAULT_COLLAPSED_STAGES = { finished: true }

export const THEMES = ['light', 'dark', 'system']
export const DENSITIES = ['comfortable', 'compact']

export function getTheme() {
  if (typeof window === 'undefined') return 'system'
  const v = window.localStorage.getItem(THEME_KEY)
  return THEMES.includes(v) ? v : 'system'
}

export function getDensity() {
  if (typeof window === 'undefined') return 'comfortable'
  const v = window.localStorage.getItem(DENSITY_KEY)
  return DENSITIES.includes(v) ? v : 'comfortable'
}

function resolveDarkMode(theme) {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (resolveDarkMode(theme)) root.classList.add('dark')
  else root.classList.remove('dark')
}

export function applyDensity(density) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (density === 'compact') root.classList.add('compact')
  else root.classList.remove('compact')
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) return
  window.localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

export function setDensity(density) {
  if (!DENSITIES.includes(density)) return
  window.localStorage.setItem(DENSITY_KEY, density)
  applyDensity(density)
}

export function getCollapsedStages() {
  if (typeof window === 'undefined') return DEFAULT_COLLAPSED_STAGES
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STAGES_KEY)
    if (!raw) return DEFAULT_COLLAPSED_STAGES
    return { ...DEFAULT_COLLAPSED_STAGES, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_COLLAPSED_STAGES
  }
}

export function setStageCollapsed(stage, collapsed) {
  const next = { ...getCollapsedStages(), [stage]: collapsed }
  window.localStorage.setItem(COLLAPSED_STAGES_KEY, JSON.stringify(next))
  return next
}

export function bootPrefs() {
  applyTheme(getTheme())
  applyDensity(getDensity())
}
