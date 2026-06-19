import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { FairEvent, ID } from '@/types/models'

/** Ссылка на коллекцию мероприятий конкретного пользователя. */
function eventsCol(uid: string) {
  return collection(db, 'users', uid, 'events')
}

function eventDoc(uid: string, eventId: ID) {
  return doc(db, 'users', uid, 'events', eventId)
}

/**
 * Приводит данные документа к актуальной схеме (legacy-нормализация)
 * и снимает реактивные обёртки/лишние поля.
 */
function normalizeEvent(raw: FairEvent): FairEvent {
  const event = JSON.parse(JSON.stringify(raw)) as FairEvent
  if (Array.isArray(event.expenses)) {
    for (const ex of event.expenses) {
      if (ex.payerId === undefined) ex.payerId = null
    }
  } else {
    event.expenses = []
  }
  if (Array.isArray(event.participants)) {
    for (const p of event.participants) {
      if (p.paidById === undefined) p.paidById = null
    }
  } else {
    event.participants = []
  }
  return event
}

/** Глубокая копия без реактивных прокси — Firestore принимает только плоские объекты. */
function toPlain(event: FairEvent): FairEvent {
  return JSON.parse(JSON.stringify(event)) as FairEvent
}

/**
 * Подписывается на коллекцию мероприятий пользователя в реальном времени.
 * Возвращает функцию отписки.
 */
export function subscribeEvents(
  uid: string,
  onData: (events: FairEvent[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    eventsCol(uid),
    (snap) => {
      const events = snap.docs.map((d) => normalizeEvent(d.data() as FairEvent))
      events.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      onData(events)
    },
    (err) => onError(err),
  )
}

/** Создаёт или перезаписывает документ мероприятия. */
export function saveEventDoc(uid: string, event: FairEvent): Promise<void> {
  return setDoc(eventDoc(uid, event.id), toPlain(event))
}

/** Удаляет документ мероприятия. */
export function deleteEventDoc(uid: string, eventId: ID): Promise<void> {
  return deleteDoc(eventDoc(uid, eventId))
}

/** Пакетная запись нескольких мероприятий. */
export async function saveEventsBatch(uid: string, events: FairEvent[]): Promise<void> {
  if (!events.length) return
  const batch = writeBatch(db)
  for (const ev of events) {
    batch.set(eventDoc(uid, ev.id), toPlain(ev))
  }
  await batch.commit()
}

/** Удаляет все мероприятия пользователя. */
export async function deleteAllEvents(uid: string): Promise<void> {
  const snap = await getDocs(eventsCol(uid))
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}
