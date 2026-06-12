import type { Expense, FairEvent, Group, ID, Participant } from '@/types/models'

/**
 * Делит стоимость позиции поровну между n участниками с округлением до целого рубля.
 * Использует метод наибольших остатков: сумма долей строго равна Math.round(price).
 * Распределение «+1» детерминировано — по порядку участников.
 */
export function splitEqualRounded(price: number, n: number): number[] {
  if (n <= 0) return []
  const total = Math.round(price)
  const base = Math.floor(total / n)
  let rem = total - base * n
  const shares = new Array<number>(n).fill(base)
  for (let i = 0; i < n && rem > 0; i++, rem--) shares[i] += 1
  return shares
}

/** Доли по позиции в виде Map<participantId, доля>. Пустой результат, если участников нет. */
export function expenseShares(expense: Expense): Map<ID, number> {
  const ids = expense.participantIds
  const result = new Map<ID, number>()
  if (ids.length === 0) return result
  const shares = splitEqualRounded(expense.price, ids.length)
  ids.forEach((id, i) => result.set(id, shares[i]))
  return result
}

/** Доля на одного человека (для предпросмотра) — округлённая до рубля. */
export function previewSharePerPerson(price: number, n: number): number {
  if (n <= 0) return 0
  return Math.round(Math.round(price) / n)
}

/** Итог по каждому участнику за всё мероприятие: Map<participantId, сумма>. */
export function participantTotals(event: FairEvent): Map<ID, number> {
  const totals = new Map<ID, number>()
  for (const p of event.participants) totals.set(p.id, 0)
  for (const expense of event.expenses) {
    if (expense.participantIds.length === 0) continue
    const shares = expenseShares(expense)
    for (const [pid, value] of shares) {
      totals.set(pid, (totals.get(pid) ?? 0) + value)
    }
  }
  return totals
}

/** Итог по участнику. */
export function totalForParticipant(event: FairEvent, participantId: ID): number {
  return participantTotals(event).get(participantId) ?? 0
}

/** Итог по группе — сумма итогов её участников. */
export function totalForGroup(event: FairEvent, groupId: ID): number {
  const totals = participantTotals(event)
  let sum = 0
  for (const p of event.participants) {
    if (p.groupId === groupId) sum += totals.get(p.id) ?? 0
  }
  return sum
}

/** Итог по мероприятию — сумма округлённых цен позиций, у которых есть участники. */
export function eventTotal(event: FairEvent): number {
  let sum = 0
  for (const expense of event.expenses) {
    if (expense.participantIds.length === 0) continue
    sum += Math.round(expense.price)
  }
  return sum
}

/** Сумма всех долей всех участников (для проверки инварианта). */
export function sumOfAllShares(event: FairEvent): number {
  let sum = 0
  for (const value of participantTotals(event).values()) sum += value
  return sum
}

export interface ReportRow {
  expense: Expense
  /** Доли по участникам в порядке participantsOrder; undefined — если не участвует. */
  shares: Array<number | undefined>
}

export interface GroupTotal {
  group: Group
  members: Participant[]
  total: number
}

export interface EventReport {
  participants: Participant[]
  rows: ReportRow[]
  participantTotals: number[]
  eventTotal: number
  groupTotals: GroupTotal[]
  /** Позиции без участников (предупреждение). */
  expensesWithoutParticipants: Expense[]
}

/** Строит полную матрицу отчёта в формате Excel-таблицы. */
export function buildReport(event: FairEvent): EventReport {
  const participants = event.participants
  const order = participants.map((p) => p.id)
  const totalsMap = participantTotals(event)

  const rows: ReportRow[] = []
  const expensesWithoutParticipants: Expense[] = []

  for (const expense of event.expenses) {
    if (expense.participantIds.length === 0) {
      expensesWithoutParticipants.push(expense)
      continue
    }
    const shareMap = expenseShares(expense)
    const shares = order.map((id) => shareMap.get(id))
    rows.push({ expense, shares })
  }

  const participantTotalsArr = order.map((id) => totalsMap.get(id) ?? 0)

  const groupTotals: GroupTotal[] = event.groups.map((group) => {
    const members = participants.filter((p) => p.groupId === group.id)
    const total = members.reduce((acc, p) => acc + (totalsMap.get(p.id) ?? 0), 0)
    return { group, members, total }
  })

  return {
    participants,
    rows,
    participantTotals: participantTotalsArr,
    eventTotal: eventTotal(event),
    groupTotals,
    expensesWithoutParticipants,
  }
}
