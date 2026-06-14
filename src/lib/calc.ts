import type { Expense, FairEvent, ID, Participant, Settlement } from '@/types/models'

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

/**
 * Возвращает id конечного участника, который оплачивает долю `participantId`
 * во взаиморасчётах, разрешая цепочку `paidById` (например, парень платит за пару).
 * Циклы и ссылки на несуществующих участников трактуются как «Сам» —
 * возвращается последний валидный участник в цепочке.
 */
export function resolveCoverer(participants: Participant[], participantId: ID): ID {
  const byId = new Map(participants.map((p) => [p.id, p]))
  const seen = new Set<ID>()
  let current = participantId
  while (true) {
    const p = byId.get(current)
    if (!p || !p.paidById || !byId.has(p.paidById)) return current
    if (seen.has(current)) return current // защита от цикла
    seen.add(current)
    current = p.paidById
  }
}

export interface ParticipantBalance {
  participantId: ID
  /** Сколько участник заплатил (по учтённым позициям, где он плательщик). */
  paid: number
  /** Сколько участник должен (его доля по учтённым позициям). */
  owed: number
  /** Сальдо: paid − owed. >0 — кредитор, <0 — дебитор. */
  balance: number
}

/**
 * Балансы участников по разделу 6.6.
 * Учитываются только позиции с participantIds.length > 0 и существующим payerId.
 * Инвариант: сумма всех balance строго равна 0.
 */
export function participantBalances(event: FairEvent): Map<ID, ParticipantBalance> {
  const map = new Map<ID, ParticipantBalance>()
  for (const p of event.participants) {
    map.set(p.id, { participantId: p.id, paid: 0, owed: 0, balance: 0 })
  }
  for (const expense of event.expenses) {
    if (expense.participantIds.length === 0) continue
    if (!expense.payerId) continue
    const payer = map.get(expense.payerId)
    if (!payer) continue // плательщик не из участников мероприятия — позицию не учитываем
    payer.paid += Math.round(expense.price)
    const shares = expenseShares(expense)
    for (const [pid, value] of shares) {
      // Долю участника во взаиморасчётах несёт тот, кто за него платит
      // (например, парень за свою половинку). По умолчанию — он сам.
      const covererId = resolveCoverer(event.participants, pid)
      const b = map.get(covererId)
      if (b) b.owed += value
    }
  }
  for (const b of map.values()) b.balance = b.paid - b.owed
  return map
}

/**
 * Оптимальная схема переводов (раздел 6.7), жадный алгоритм сведения долгов.
 * Возвращает список переводов «дебитор → кредитор» с минимальным числом транзакций.
 */
export function minimizeTransfers(balances: Map<ID, number>): Settlement[] {
  const creditors: Array<{ id: ID; amount: number }> = []
  const debtors: Array<{ id: ID; amount: number }> = []
  for (const [id, balance] of balances) {
    if (balance > 0) creditors.push({ id, amount: balance })
    else if (balance < 0) debtors.push({ id, amount: -balance })
  }
  const byAmountThenId = (a: { id: ID; amount: number }, b: { id: ID; amount: number }) =>
    b.amount - a.amount || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  creditors.sort(byAmountThenId)
  debtors.sort(byAmountThenId)

  const settlements: Settlement[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = Math.min(debtor.amount, creditor.amount)
    if (amount > 0) {
      settlements.push({ fromId: debtor.id, toId: creditor.id, amount })
      debtor.amount -= amount
      creditor.amount -= amount
    }
    if (debtor.amount === 0) i++
    if (creditor.amount === 0) j++
  }
  return settlements
}

export interface ReportRow {
  expense: Expense
  /** Доли по участникам в порядке participantsOrder; undefined — если не участвует. */
  shares: Array<number | undefined>
}

export interface EventReport {
  participants: Participant[]
  rows: ReportRow[]
  participantTotals: number[]
  eventTotal: number
  /** Позиции без участников (предупреждение). */
  expensesWithoutParticipants: Expense[]
  /** Балансы участников в порядке participants (раздел 6.6). */
  balances: ParticipantBalance[]
  /** Оптимальная схема переводов (раздел 6.7). */
  settlements: Settlement[]
  /** Позиции с участниками, но без указанного плательщика (не входят в переводы). */
  expensesWithoutPayer: Expense[]
}

/** Строит полную матрицу отчёта в формате Excel-таблицы. */
export function buildReport(event: FairEvent): EventReport {
  const participants = event.participants
  const order = participants.map((p) => p.id)
  const totalsMap = participantTotals(event)

  const rows: ReportRow[] = []
  const expensesWithoutParticipants: Expense[] = []

  const expensesWithoutPayer: Expense[] = []

  for (const expense of event.expenses) {
    if (expense.participantIds.length === 0) {
      expensesWithoutParticipants.push(expense)
      continue
    }
    if (!expense.payerId) expensesWithoutPayer.push(expense)
    const shareMap = expenseShares(expense)
    const shares = order.map((id) => shareMap.get(id))
    rows.push({ expense, shares })
  }

  const participantTotalsArr = order.map((id) => totalsMap.get(id) ?? 0)

  const balancesMap = participantBalances(event)
  const balances = order.map(
    (id) => balancesMap.get(id) ?? { participantId: id, paid: 0, owed: 0, balance: 0 },
  )
  const balanceById = new Map<ID, number>(balances.map((b) => [b.participantId, b.balance]))
  const settlements = minimizeTransfers(balanceById)

  return {
    participants,
    rows,
    participantTotals: participantTotalsArr,
    eventTotal: eventTotal(event),
    expensesWithoutParticipants,
    balances,
    settlements,
    expensesWithoutPayer,
  }
}
