import { SCHEMA_VERSION, type FairEvent, type PersistedState } from '@/types/models'

const STORAGE_KEY = 'fairshare:state:v1'

export function emptyState(): PersistedState {
  return { schemaVersion: SCHEMA_VERSION, events: [] }
}

/**
 * Нормализует загруженные данные под актуальную схему.
 * В частности, у позиций без поля payerId (legacy-данные) проставляется null.
 */
export function migrateState(state: PersistedState): PersistedState {
  for (const event of state.events) {
    if (Array.isArray(event.expenses)) {
      for (const expense of event.expenses) {
        if (expense.payerId === undefined) expense.payerId = null
      }
    }
    if (Array.isArray(event.participants)) {
      for (const participant of event.participants) {
        if (participant.paidById === undefined) participant.paidById = null
      }
    }
  }
  return state
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as PersistedState
    if (!parsed || !Array.isArray(parsed.events)) return emptyState()
    return migrateState({
      schemaVersion: parsed.schemaVersion ?? SCHEMA_VERSION,
      events: parsed.events as FairEvent[],
    })
  } catch (err) {
    console.error('Не удалось загрузить состояние из localStorage:', err)
    return emptyState()
  }
}

/** Сохраняет состояние. Возвращает true при успехе, false при ошибке (квота/приватный режим). */
export function saveState(state: PersistedState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch (err) {
    console.error('Не удалось сохранить состояние в localStorage:', err)
    return false
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.error('Не удалось очистить localStorage:', err)
  }
}
