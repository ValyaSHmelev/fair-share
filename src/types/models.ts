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
  groupId: ID | null
}

export interface Group {
  id: ID
  name: string
  color?: string
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
  groups: Group[]
  expenses: Expense[]
  createdAt: string
  updatedAt: string
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
