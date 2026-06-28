import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  createEmptyProfile,
  type FairEvent,
  type Friend,
  type ID,
  type UserProfile,
} from '@/types/models'

/** Ссылка на коллекцию мероприятий конкретного пользователя. */
function eventsCol(uid: string) {
  return collection(db, 'users', uid, 'events')
}

function eventDoc(uid: string, eventId: ID) {
  return doc(db, 'users', uid, 'events', eventId)
}

/** Ссылка на коллекцию друзей конкретного пользователя. */
function friendsCol(uid: string) {
  return collection(db, 'users', uid, 'friends')
}

function friendDoc(uid: string, friendId: ID) {
  return doc(db, 'users', uid, 'friends', friendId)
}

/** Ссылка на документ пользователя (хранит платёжный профиль). */
function userDoc(uid: string) {
  return doc(db, 'users', uid)
}

/** Приводит профиль к актуальной схеме, подставляя значения по умолчанию. */
function normalizeProfile(raw: Partial<UserProfile> | undefined): UserProfile {
  const base = createEmptyProfile()
  if (!raw) return base
  return {
    paymentMethod: raw.paymentMethod === 'card' ? 'card' : 'sbp',
    phone: typeof raw.phone === 'string' ? raw.phone : base.phone,
    bank: typeof raw.bank === 'string' ? raw.bank : base.bank,
    cardNumber: typeof raw.cardNumber === 'string' ? raw.cardNumber : base.cardNumber,
    recipient: typeof raw.recipient === 'string' ? raw.recipient : base.recipient,
  }
}

/** Разово читает платёжный профиль пользователя; возвращает значения по умолчанию, если профиля нет. */
export async function getUserProfile(uid: string): Promise<UserProfile> {
  const snap = await getDoc(userDoc(uid))
  const data = snap.exists() ? (snap.data() as { profile?: Partial<UserProfile> }) : undefined
  return normalizeProfile(data?.profile)
}

/** Сохраняет платёжный профиль пользователя (merge, чтобы не затирать прочие поля документа). */
export function saveUserProfile(uid: string, profile: UserProfile): Promise<void> {
  return setDoc(userDoc(uid), { profile: normalizeProfile(profile) }, { merge: true })
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
      if (typeof p.sbpPhone !== 'string') p.sbpPhone = ''
      if (typeof p.bank !== 'string') p.bank = ''
      if (typeof p.recipient !== 'string') p.recipient = ''
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

/**
 * Разово читает мероприятие конкретного пользователя по прямой ссылке (для шаринга).
 * Возвращает актуальные данные из Firestore либо null, если документа нет.
 */
export async function getPublicEvent(uid: string, eventId: ID): Promise<FairEvent | null> {
  const snap = await getDoc(eventDoc(uid, eventId))
  if (!snap.exists()) return null
  return normalizeEvent(snap.data() as FairEvent)
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

// --- Друзья ---

/** Приводит документ друга к актуальной схеме, подставляя значения по умолчанию. */
function normalizeFriend(raw: Partial<Friend> & { id: ID }): Friend {
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : '',
    sbpPhone: typeof raw.sbpPhone === 'string' ? raw.sbpPhone : '',
    bank: typeof raw.bank === 'string' ? raw.bank : '',
    recipient: typeof raw.recipient === 'string' ? raw.recipient : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
  }
}

/** Подписывается на список друзей пользователя в реальном времени. Возвращает функцию отписки. */
export function subscribeFriends(
  uid: string,
  onData: (friends: Friend[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    friendsCol(uid),
    (snap) => {
      const friends = snap.docs.map((d) => normalizeFriend(d.data() as Partial<Friend> & { id: ID }))
      friends.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      onData(friends)
    },
    (err) => onError(err),
  )
}

/** Создаёт или перезаписывает документ друга. */
export function saveFriendDoc(uid: string, friend: Friend): Promise<void> {
  return setDoc(friendDoc(uid, friend.id), normalizeFriend(friend))
}

/** Удаляет документ друга. */
export function deleteFriendDoc(uid: string, friendId: ID): Promise<void> {
  return deleteDoc(friendDoc(uid, friendId))
}
