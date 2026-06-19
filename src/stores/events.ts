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
import {
  subscribeEvents,
  saveEventDoc,
  deleteEventDoc,
  saveEventsBatch,
  deleteAllEvents,
} from '@/lib/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { buildExportFile, exportStateToJson, newId } from '@/lib/io'

export const useEventsStore = defineStore('events', () => {
  const events = ref<FairEvent[]>([])
  const schemaVersion = ref<number>(SCHEMA_VERSION)
  const lastError = ref<string | null>(null)
  // Загружена ли облачная коллекция текущего пользователя (получен первый снапшот).
  const ready = ref<boolean>(false)

  // Привязка к пользователю Firestore.
  let boundUid: string | null = null
  let unsubscribe: Unsubscribe | null = null

  function snapshot(): PersistedState {
    return { schemaVersion: schemaVersion.value, events: events.value }
  }

  /** Подписывается на мероприятия пользователя. Вызывается при входе (из main.ts). */
  function bindUser(uid: string): void {
    if (boundUid === uid) return
    unbind()
    boundUid = uid
    ready.value = false
    unsubscribe = subscribeEvents(
      uid,
      (list) => {
        events.value = list
        ready.value = true
        lastError.value = null
      },
      (err) => {
        console.error('Не удалось загрузить мероприятия из Firestore:', err)
        lastError.value = 'Не удалось загрузить данные из облака.'
        ready.value = true
      },
    )
  }

  /** Отписывается и очищает локальное состояние. Вызывается при выходе. */
  function unbind(): void {
    unsubscribe?.()
    unsubscribe = null
    boundUid = null
    events.value = []
    ready.value = false
    lastError.value = null
  }

  /** Записывает один документ мероприятия в Firestore (fire-and-forget c обработкой ошибок). */
  function persistEvent(event: FairEvent): void {
    if (!boundUid) return
    saveEventDoc(boundUid, event).catch((err) => {
      console.error('Не удалось сохранить мероприятие в Firestore:', err)
      lastError.value = 'Не удалось сохранить данные в облаке.'
    })
  }

  function nowIso(): string {
    return new Date().toISOString()
  }

  function getEventById(id: ID): FairEvent | undefined {
    return events.value.find((e) => e.id === id)
  }

  function touch(event: FairEvent): void {
    event.updatedAt = nowIso()
    persistEvent(event)
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
    persistEvent(event)
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
      if (boundUid) {
        deleteEventDoc(boundUid, id).catch((err) => {
          console.error('Не удалось удалить мероприятие в Firestore:', err)
          lastError.value = 'Не удалось удалить данные в облаке.'
        })
      }
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
    persistEvent(clone)
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
      if (boundUid) {
        const uid = boundUid
        deleteAllEvents(uid)
          .then(() => saveEventsBatch(uid, state.events))
          .catch((err) => {
            console.error('Не удалось импортировать данные в Firestore:', err)
            lastError.value = 'Не удалось сохранить импорт в облаке.'
          })
      }
    } else {
      const existingIds = new Set(events.value.map((e) => e.id))
      const added: FairEvent[] = []
      for (const ev of state.events) {
        if (existingIds.has(ev.id)) ev.id = newId()
        events.value.push(ev)
        added.push(ev)
      }
      if (boundUid) {
        saveEventsBatch(boundUid, added).catch((err) => {
          console.error('Не удалось импортировать данные в Firestore:', err)
          lastError.value = 'Не удалось сохранить импорт в облаке.'
        })
      }
    }
  }

  function importSingleEvent(event: FairEvent): void {
    const existingIds = new Set(events.value.map((e) => e.id))
    if (existingIds.has(event.id)) event = { ...event, id: newId() }
    events.value.push(event)
    persistEvent(event)
  }

  function clearAll(): void {
    events.value = []
    schemaVersion.value = SCHEMA_VERSION
    if (boundUid) {
      deleteAllEvents(boundUid).catch((err) => {
        console.error('Не удалось очистить данные в Firestore:', err)
        lastError.value = 'Не удалось очистить данные в облаке.'
      })
    }
  }

  return {
    events,
    schemaVersion,
    lastError,
    ready,
    bindUser,
    unbind,
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
