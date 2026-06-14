import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  type CurrencyCode,
  type Expense,
  type FairEvent,
  type ID,
  type ImportMode,
  type Participant,
  type PersistedState,
  SCHEMA_VERSION,
} from '@/types/models'
import { loadState, saveState, clearStorage } from '@/lib/storage'
import { buildExportFile, exportStateToJson, newId } from '@/lib/io'

export const useEventsStore = defineStore('events', () => {
  const initial = loadState()
  const events = ref<FairEvent[]>(initial.events)
  const schemaVersion = ref<number>(initial.schemaVersion ?? SCHEMA_VERSION)
  const lastError = ref<string | null>(null)

  function snapshot(): PersistedState {
    return { schemaVersion: schemaVersion.value, events: events.value }
  }

  function persist(): void {
    const ok = saveState(snapshot())
    lastError.value = ok ? null : 'Не удалось сохранить данные (возможно, хранилище переполнено).'
  }

  function nowIso(): string {
    return new Date().toISOString()
  }

  function getEventById(id: ID): FairEvent | undefined {
    return events.value.find((e) => e.id === id)
  }

  function touch(event: FairEvent): void {
    event.updatedAt = nowIso()
    persist()
  }

  // --- Мероприятия ---
  function createEvent(payload: {
    name: string
    date: string | null
    currency: CurrencyCode
  }): FairEvent {
    const event: FairEvent = {
      id: newId(),
      name: payload.name.trim(),
      date: payload.date,
      currency: payload.currency,
      participants: [],
      expenses: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    events.value.push(event)
    persist()
    return event
  }

  function updateEvent(
    id: ID,
    patch: Partial<Pick<FairEvent, 'name' | 'date' | 'currency'>>,
  ): void {
    const event = getEventById(id)
    if (!event) return
    if (patch.name !== undefined) event.name = patch.name.trim()
    if (patch.date !== undefined) event.date = patch.date
    if (patch.currency !== undefined) event.currency = patch.currency
    touch(event)
  }

  function deleteEvent(id: ID): void {
    const idx = events.value.findIndex((e) => e.id === id)
    if (idx >= 0) {
      events.value.splice(idx, 1)
      persist()
    }
  }

  function duplicateEvent(id: ID): FairEvent | undefined {
    const src = getEventById(id)
    if (!src) return undefined
    const clone: FairEvent = JSON.parse(JSON.stringify(src))
    clone.id = newId()
    clone.name = src.name + ' (копия)'
    clone.createdAt = nowIso()
    clone.updatedAt = nowIso()
    // Перегенерируем id участников/позиций, сохранив связи.
    const pMap = new Map<ID, ID>()
    clone.participants.forEach((p) => {
      const nid = newId()
      pMap.set(p.id, nid)
      p.id = nid
    })
    // Перепривязываем paidById после перегенерации id участников.
    clone.participants.forEach((p) => {
      if (p.paidById) p.paidById = pMap.get(p.paidById) ?? null
    })
    clone.expenses.forEach((ex) => {
      ex.id = newId()
      ex.participantIds = ex.participantIds.map((pid) => pMap.get(pid) ?? pid).filter(Boolean)
      ex.payerId = ex.payerId ? (pMap.get(ex.payerId) ?? null) : null
    })
    events.value.push(clone)
    persist()
    return clone
  }

  // --- Участники ---
  function addParticipant(
    eventId: ID,
    name: string,
    paidById: ID | null = null,
  ): Participant | undefined {
    const event = getEventById(eventId)
    if (!event) return undefined
    const exists = paidById && event.participants.some((p) => p.id === paidById)
    const participant: Participant = {
      id: newId(),
      name: name.trim(),
      paidById: exists ? paidById : null,
    }
    event.participants.push(participant)
    touch(event)
    return participant
  }

  /** Назначает, кто платит за участника во взаиморасчётах. null — платит сам. */
  function setPaidBy(eventId: ID, participantId: ID, paidById: ID | null): void {
    const event = getEventById(eventId)
    const p = event?.participants.find((x) => x.id === participantId)
    if (!event || !p) return
    // Нельзя ссылаться на самого себя или на несуществующего участника.
    if (paidById === participantId || !event.participants.some((x) => x.id === paidById)) {
      p.paidById = null
    } else {
      p.paidById = paidById
    }
    touch(event)
  }

  function renameParticipant(eventId: ID, participantId: ID, name: string): void {
    const event = getEventById(eventId)
    const p = event?.participants.find((x) => x.id === participantId)
    if (event && p) {
      p.name = name.trim()
      touch(event)
    }
  }

  function removeParticipant(eventId: ID, participantId: ID): void {
    const event = getEventById(eventId)
    if (!event) return
    event.participants = event.participants.filter((p) => p.id !== participantId)
    for (const ex of event.expenses) {
      ex.participantIds = ex.participantIds.filter((id) => id !== participantId)
      if (ex.payerId === participantId) ex.payerId = null
    }
    // Сбрасываем ссылки тех, за кого платил удалённый участник.
    for (const p of event.participants) {
      if (p.paidById === participantId) p.paidById = null
    }
    touch(event)
  }

  // --- Позиции ---
  function addExpense(
    eventId: ID,
    payload: { title: string; price: number; payerId: ID | null; participantIds: ID[] },
  ): Expense | undefined {
    const event = getEventById(eventId)
    if (!event) return undefined
    const expense: Expense = {
      id: newId(),
      title: payload.title.trim(),
      price: payload.price,
      payerId: payload.payerId,
      participantIds: [...payload.participantIds],
      createdAt: nowIso(),
    }
    event.expenses.push(expense)
    touch(event)
    return expense
  }

  function updateExpense(
    eventId: ID,
    expenseId: ID,
    patch: Partial<Pick<Expense, 'title' | 'price' | 'payerId' | 'participantIds'>>,
  ): void {
    const event = getEventById(eventId)
    const ex = event?.expenses.find((x) => x.id === expenseId)
    if (!event || !ex) return
    if (patch.title !== undefined) ex.title = patch.title.trim()
    if (patch.price !== undefined) ex.price = patch.price
    if (patch.payerId !== undefined) ex.payerId = patch.payerId
    if (patch.participantIds !== undefined) ex.participantIds = [...patch.participantIds]
    touch(event)
  }

  function removeExpense(eventId: ID, expenseId: ID): void {
    const event = getEventById(eventId)
    if (!event) return
    event.expenses = event.expenses.filter((e) => e.id !== expenseId)
    touch(event)
  }

  // --- IO ---
  function exportState(): void {
    exportStateToJson(snapshot())
  }

  function exportPayload() {
    return buildExportFile(snapshot())
  }

  function importState(state: PersistedState, mode: ImportMode): void {
    if (mode === 'replace') {
      events.value = state.events
      schemaVersion.value = state.schemaVersion
    } else {
      const existingIds = new Set(events.value.map((e) => e.id))
      for (const ev of state.events) {
        if (existingIds.has(ev.id)) ev.id = newId()
        events.value.push(ev)
      }
    }
    persist()
  }

  function importSingleEvent(event: FairEvent): void {
    const existingIds = new Set(events.value.map((e) => e.id))
    if (existingIds.has(event.id)) event = { ...event, id: newId() }
    events.value.push(event)
    persist()
  }

  function clearAll(): void {
    events.value = []
    schemaVersion.value = SCHEMA_VERSION
    clearStorage()
  }

  return {
    events,
    schemaVersion,
    lastError,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    duplicateEvent,
    addParticipant,
    setPaidBy,
    renameParticipant,
    removeParticipant,
    addExpense,
    updateExpense,
    removeExpense,
    exportState,
    exportPayload,
    importState,
    importSingleEvent,
    clearAll,
  }
})
