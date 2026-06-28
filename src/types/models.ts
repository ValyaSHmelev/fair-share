export type ID = string

export type CurrencyCode = 'RUB' | 'USD' | 'EUR' | 'KZT' | 'GBP'

export interface CurrencyInfo {
  code: CurrencyCode
  symbol: string
  label: string
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  RUB: { code: 'RUB', symbol: '₽', label: 'Рубль' },
  USD: { code: 'USD', symbol: '$', label: 'Доллар' },
  EUR: { code: 'EUR', symbol: '€', label: 'Евро' },
  KZT: { code: 'KZT', symbol: '₸', label: 'Тенге' },
  GBP: { code: 'GBP', symbol: '£', label: 'Фунт' },
}

export interface Participant {
  id: ID
  name: string
  /**
   * Кто оплачивает долю этого участника во взаиморасчётах.
   * null — участник платит сам за себя («Сам»). Иначе — id другого участника
   * (например, парень платит за свою половинку). Цепочки разрешаются до конечного
   * плательщика; циклы и висячие ссылки трактуются как «Сам».
   */
  paidById: ID | null
  /** Номер телефона для перевода по СБП. */
  sbpPhone: string
  /** Банк-получатель для перевода по СБП. */
  bank: string
  /** Отображаемое имя получателя (как высвечивается в приложении банка). */
  recipient: string
}

/** Популярные банки для перевода по СБП (для выпадающего списка с возможностью ввода своего). */
export const POPULAR_BANKS: string[] = [
  'Сбер',
  'Т-Банк',
  'Альфа',
  'ВТБ',
  'Газпром',
  'Озон Банк',
]

/**
 * Друг — запись в глобальном (на уровне пользователя) списке для быстрого
 * добавления в мероприятия. Хранится в подколлекции `users/{uid}/friends`.
 * Не содержит `paidById`: «кто платит» настраивается уже внутри мероприятия.
 */
export interface Friend {
  id: ID
  name: string
  /** Номер телефона для перевода по СБП. */
  sbpPhone: string
  /** Банк-получатель для перевода по СБП. */
  bank: string
  /** Отображаемое имя получателя (как высвечивается в приложении банка). */
  recipient: string
  createdAt: string
}

export interface Expense {
  id: ID
  title: string
  price: number
  payerId: ID | null
  participantIds: ID[]
  createdAt: string
}

export interface Settlement {
  fromId: ID
  toId: ID
  amount: number
}

export interface FairEvent {
  id: ID
  name: string
  date: string | null
  currency: CurrencyCode
  participants: Participant[]
  expenses: Expense[]
  createdAt: string
  updatedAt: string
}

export type PaymentMethod = 'sbp' | 'card'

/**
 * Платёжные реквизиты пользователя для приёма переводов.
 * Хранятся в документе `users/{uid}` в поле `profile`.
 */
export interface UserProfile {
  /** Предпочитаемый способ перевода. По умолчанию — СБП. */
  paymentMethod: PaymentMethod
  /** Номер телефона для перевода по СБП. */
  phone: string
  /** Банк-получатель для перевода по СБП. */
  bank: string
  /** Номер карты для перевода по карте. */
  cardNumber: string
  /** Отображаемое имя получателя (как высвечивается в приложении банка). */
  recipient: string
}

export function createEmptyProfile(): UserProfile {
  return {
    paymentMethod: 'sbp',
    phone: '',
    bank: '',
    cardNumber: '',
    recipient: '',
  }
}

export interface PersistedState {
  schemaVersion: number
  events: FairEvent[]
}

export const SCHEMA_VERSION = 1

export interface ExportFile {
  app: 'FairShare'
  schemaVersion: number
  exportedAt: string
  data: PersistedState
}

export type ImportMode = 'replace' | 'merge'
