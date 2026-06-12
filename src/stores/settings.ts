import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'dark' | 'light'

const THEME_KEY = 'fairshare:theme'
const DARK_CLASS = 'fs-dark'

function loadTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'dark') root.classList.add(DARK_CLASS)
  else root.classList.remove(DARK_CLASS)
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(loadTheme())
  applyTheme(theme.value)

  watch(theme, (mode) => {
    applyTheme(mode)
    try {
      localStorage.setItem(THEME_KEY, mode)
    } catch {
      /* ignore */
    }
  })

  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggleTheme }
})
