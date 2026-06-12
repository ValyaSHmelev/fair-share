import { CURRENCIES, type CurrencyCode } from '@/types/models'

/** Форматирует целочисленную сумму с символом валюты мероприятия. */
export function formatMoney(value: number, currency: CurrencyCode): string {
  const symbol = CURRENCIES[currency]?.symbol ?? ''
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(Math.round(value))
  return `${formatted} ${symbol}`.trim()
}

/** Форматирует число для отображения цены (может быть дробным при вводе). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)
}

/** Человекочитаемая дата из ISO-строки. */
export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d)
}
