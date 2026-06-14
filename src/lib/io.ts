import {
  SCHEMA_VERSION,
  type ExportFile,
  type FairEvent,
  type PersistedState,
} from '@/types/models'
import { buildReport } from '@/lib/calc'
import { CURRENCIES } from '@/types/models'

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function triggerDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

export function buildExportFile(state: PersistedState): ExportFile {
  return {
    app: 'FairShare',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { schemaVersion: state.schemaVersion, events: state.events },
  }
}

export function exportStateToJson(state: PersistedState): void {
  const payload = buildExportFile(state)
  triggerDownload(
    JSON.stringify(payload, null, 2),
    `fairshare-backup-${todayStamp()}.json`,
    'application/json',
  )
}

export interface ParsedImport {
  ok: boolean
  error?: string
  state?: PersistedState
}

/** Валидирует и парсит JSON импорта. Не мутирует состояние. */
export function parseImportFile(raw: string): ParsedImport {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Файл не является корректным JSON.' }
  }
  if (typeof json !== 'object' || json === null) {
    return { ok: false, error: 'Неверная структура файла.' }
  }
  const obj = json as Record<string, unknown>
  // Поддерживаем как ExportFile, так и «голый» PersistedState.
  const data = (obj.data ?? obj) as Record<string, unknown>
  if (!Array.isArray(data.events)) {
    return { ok: false, error: 'В файле не найден список мероприятий (events).' }
  }
  const events = data.events as FairEvent[]
  const valid = events.every(
    (e) =>
      e &&
      typeof e.id === 'string' &&
      typeof e.name === 'string' &&
      Array.isArray(e.participants) &&
      Array.isArray(e.expenses),
  )
  if (!valid) {
    return { ok: false, error: 'Некоторые мероприятия имеют неверный формат.' }
  }
  // Нормализация под актуальную схему: legacy-позиции без payerId получают null,
  // участники без paidById — null («Сам»).
  for (const ev of events) {
    if (Array.isArray(ev.expenses)) {
      for (const ex of ev.expenses) {
        if (ex.payerId === undefined) ex.payerId = null
      }
    }
    if (Array.isArray(ev.participants)) {
      for (const p of ev.participants) {
        if (p.paidById === undefined) p.paidById = null
      }
    }
  }
  return {
    ok: true,
    state: {
      schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : SCHEMA_VERSION,
      events,
    },
  }
}

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

/** Экспорт отчёта мероприятия в CSV в формате, совместимом с examples/. */
export function exportReportToCsv(event: FairEvent): void {
  const report = buildReport(event)
  const names = report.participants.map((p) => p.name)
  const header = ['Наименование', 'Цена', ...names]
  const lines: string[] = [header.map(csvEscape).join(',')]

  for (const row of report.rows) {
    const cells = [
      csvEscape(row.expense.title),
      String(Math.round(row.expense.price)),
      ...row.shares.map((s) => (s === undefined ? '' : String(s))),
    ]
    lines.push(cells.join(','))
  }

  const totalRow = [
    'Итого',
    String(report.eventTotal),
    ...report.participantTotals.map((t) => String(t)),
  ]
  lines.push(totalRow.map(csvEscape).join(','))

  const currency = CURRENCIES[event.currency]?.label ?? event.currency
  lines.push('')
  lines.push(csvEscape(`Валюта: ${currency}`))

  // Блок взаиморасчётов (кто кому переводит, минимум транзакций).
  const nameById = new Map(report.participants.map((p) => [p.id, p.name]))
  if (report.settlements.length) {
    lines.push('')
    lines.push(csvEscape('Взаиморасчёты'))
    lines.push(['Кто', 'Кому', 'Сумма'].map(csvEscape).join(','))
    for (const s of report.settlements) {
      lines.push(
        [
          csvEscape(nameById.get(s.fromId) ?? '?'),
          csvEscape(nameById.get(s.toId) ?? '?'),
          String(s.amount),
        ].join(','),
      )
    }
  }

  const safeName = event.name.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'event'
  triggerDownload('\ufeff' + lines.join('\n'), `fairshare-${safeName}.csv`, 'text/csv;charset=utf-8')
}
