import { describe, expect, it } from 'vitest'
import {
  buildReport,
  eventTotal,
  expenseShares,
  minimizeTransfers,
  participantBalances,
  participantTotals,
  resolveCoverer,
  splitEqualRounded,
  sumOfAllShares,
} from '@/lib/calc'
import type { FairEvent, ID, Settlement } from '@/types/models'

describe('splitEqualRounded', () => {
  it('делит поровну без остатка', () => {
    expect(splitEqualRounded(700, 5)).toEqual([140, 140, 140, 140, 140])
  })

  it('распределяет остаток по методу наибольших остатков', () => {
    // 1718 / 5 = 343.6 -> total 1718, base 343, rem 3 -> первым трём +1
    expect(splitEqualRounded(1718, 5)).toEqual([344, 344, 344, 343, 343])
  })

  it('сумма долей всегда равна округлённой цене', () => {
    for (const price of [460, 169, 397, 771, 1718, 333, 1000, 1]) {
      for (let n = 1; n <= 7; n++) {
        const shares = splitEqualRounded(price, n)
        const sum = shares.reduce((a, b) => a + b, 0)
        expect(sum).toBe(Math.round(price))
        expect(shares.length).toBe(n)
      }
    }
  })

  it('возвращает пустой массив при n<=0', () => {
    expect(splitEqualRounded(100, 0)).toEqual([])
  })
})

function makeEvent(): FairEvent {
  // Кейс из examples/тусовки - шашлыки 290723.csv
  const ids = ['valya', 'masha', 'andr', 'ilya', 'maks']
  const [valya, masha, andr, ilya, maks] = ids
  return {
    id: 'ev1',
    name: 'Шашлыки',
    date: null,
    currency: 'RUB',
    participants: ids.map((id) => ({ id, name: id, paidById: null })),
    expenses: [
      {
        id: 'e1',
        title: 'сижки',
        price: 460,
        payerId: valya,
        participantIds: [valya, andr, ilya],
        createdAt: '',
      },
      { id: 'e2', title: 'мясо', price: 1718, payerId: masha, participantIds: ids, createdAt: '' },
      { id: 'e3', title: 'магнит', price: 771, payerId: andr, participantIds: ids, createdAt: '' },
      { id: 'e4', title: 'овощи', price: 169, payerId: ilya, participantIds: ids, createdAt: '' },
      {
        id: 'e5',
        title: 'такси',
        price: 397,
        payerId: maks,
        participantIds: [valya, masha, andr, ilya],
        createdAt: '',
      },
      { id: 'e6', title: 'дастархан', price: 700, payerId: valya, participantIds: ids, createdAt: '' },
    ],
    createdAt: '',
    updatedAt: '',
  }
}

describe('expenseShares', () => {
  it('считает доли по позиции', () => {
    const ev = makeEvent()
    const shares = expenseShares(ev.expenses[0]) // сижки 460 на 3
    expect([...shares.values()].reduce((a, b) => a + b, 0)).toBe(460)
    expect(shares.size).toBe(3)
  })

  it('пустой результат, если нет участников', () => {
    const shares = expenseShares({
      id: 'x',
      title: 'x',
      price: 100,
      payerId: null,
      participantIds: [],
      createdAt: '',
    })
    expect(shares.size).toBe(0)
  })
})

describe('итоги мероприятия', () => {
  it('eventTotal = сумма округлённых цен позиций с участниками', () => {
    const ev = makeEvent()
    expect(eventTotal(ev)).toBe(460 + 1718 + 771 + 169 + 397 + 700)
  })

  it('ИНВАРИАНТ: сумма всех долей участников == eventTotal', () => {
    const ev = makeEvent()
    expect(sumOfAllShares(ev)).toBe(eventTotal(ev))
  })

  it('позиции без участников не входят в итог', () => {
    const ev = makeEvent()
    ev.expenses.push({
      id: 'e7',
      title: 'пусто',
      price: 999,
      payerId: 'valya',
      participantIds: [],
      createdAt: '',
    })
    expect(eventTotal(ev)).toBe(460 + 1718 + 771 + 169 + 397 + 700)
    expect(sumOfAllShares(ev)).toBe(eventTotal(ev))
  })

  it('каждый участник получает неотрицательную сумму', () => {
    const ev = makeEvent()
    for (const total of participantTotals(ev).values()) {
      expect(total).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('buildReport', () => {
  it('строит матрицу с итогами', () => {
    const ev = makeEvent()
    const report = buildReport(ev)

    expect(report.rows.length).toBe(6)
    expect(report.participants.length).toBe(5)
    expect(report.participantTotals.reduce((a, b) => a + b, 0)).toBe(report.eventTotal)
  })

  it('собирает позиции без участников отдельно', () => {
    const ev = makeEvent()
    ev.expenses.push({
      id: 'e7',
      title: 'пусто',
      price: 50,
      payerId: 'valya',
      participantIds: [],
      createdAt: '',
    })
    const report = buildReport(ev)
    expect(report.expensesWithoutParticipants.length).toBe(1)
    expect(report.rows.length).toBe(6)
  })
})

/** Применяет переводы к балансам и возвращает итоговые балансы. */
function applyTransfers(balances: Map<ID, number>, transfers: Settlement[]): Map<ID, number> {
  const result = new Map(balances)
  for (const t of transfers) {
    result.set(t.fromId, (result.get(t.fromId) ?? 0) + t.amount)
    result.set(t.toId, (result.get(t.toId) ?? 0) - t.amount)
  }
  return result
}

describe('participantBalances', () => {
  it('считает paid/owed/balance по позициям с плательщиком', () => {
    const ev = makeEvent()
    const balances = participantBalances(ev)
    // valya оплатил сижки (460) и дастархан (700) = 1160
    expect(balances.get('valya')!.paid).toBe(1160)
    // masha оплатила мясо (1718)
    expect(balances.get('masha')!.paid).toBe(1718)
    // maks оплатил такси (397), но в его дележе не участвует
    expect(balances.get('maks')!.paid).toBe(397)
    // у каждого balance = paid - owed
    for (const b of balances.values()) {
      expect(b.balance).toBe(b.paid - b.owed)
    }
  })

  it('ИНВАРИАНТ: сумма всех балансов строго равна 0', () => {
    const ev = makeEvent()
    const balances = participantBalances(ev)
    const sum = [...balances.values()].reduce((acc, b) => acc + b.balance, 0)
    expect(sum).toBe(0)
  })

  it('owed по всем учтённым позициям совпадает с totalForParticipant (когда у всех есть плательщик)', () => {
    const ev = makeEvent()
    const balances = participantBalances(ev)
    const totals = participantTotals(ev)
    for (const [id, b] of balances) {
      expect(b.owed).toBe(totals.get(id))
    }
  })

  it('позиции без плательщика не учитываются в paid/owed', () => {
    const ev = makeEvent()
    ev.expenses.push({
      id: 'noPayer',
      title: 'без плательщика',
      price: 500,
      payerId: null,
      participantIds: ['valya', 'masha'],
      createdAt: '',
    })
    const balances = participantBalances(ev)
    const sum = [...balances.values()].reduce((acc, b) => acc + b.balance, 0)
    expect(sum).toBe(0)
  })

  it('плательщик-неучастник мероприятия не ломает баланс', () => {
    const ev = makeEvent()
    ev.expenses.push({
      id: 'ghost',
      title: 'призрак',
      price: 300,
      payerId: 'unknown-id',
      participantIds: ['valya', 'masha', 'andr'],
      createdAt: '',
    })
    const balances = participantBalances(ev)
    // позиция с несуществующим плательщиком игнорируется во взаиморасчётах
    const sum = [...balances.values()].reduce((acc, b) => acc + b.balance, 0)
    expect(sum).toBe(0)
  })
})

describe('resolveCoverer (кто платит за участника)', () => {
  it('по умолчанию участник платит сам за себя', () => {
    const ev = makeEvent()
    expect(resolveCoverer(ev.participants, 'masha')).toBe('masha')
  })

  it('разрешает прямую ссылку: парень платит за половинку', () => {
    const ev = makeEvent()
    // masha платит за себя через valya
    ev.participants.find((p) => p.id === 'masha')!.paidById = 'valya'
    expect(resolveCoverer(ev.participants, 'masha')).toBe('valya')
  })

  it('разрешает цепочку до конечного плательщика', () => {
    const ev = makeEvent()
    ev.participants.find((p) => p.id === 'masha')!.paidById = 'valya'
    ev.participants.find((p) => p.id === 'valya')!.paidById = 'andr'
    expect(resolveCoverer(ev.participants, 'masha')).toBe('andr')
  })

  it('цикл трактуется как «Сам» (не зацикливается)', () => {
    const ev = makeEvent()
    ev.participants.find((p) => p.id === 'masha')!.paidById = 'valya'
    ev.participants.find((p) => p.id === 'valya')!.paidById = 'masha'
    const r = resolveCoverer(ev.participants, 'masha')
    expect(['masha', 'valya']).toContain(r)
  })

  it('висячая ссылка на несуществующего участника трактуется как «Сам»', () => {
    const ev = makeEvent()
    ev.participants.find((p) => p.id === 'masha')!.paidById = 'ghost'
    expect(resolveCoverer(ev.participants, 'masha')).toBe('masha')
  })
})

describe('взаиморасчёты с переносом доли на плательщика (paidById)', () => {
  it('доля участника переносится на того, кто за него платит', () => {
    const ev = makeEvent()
    // valya платит за машу: долю маши несёт valya
    ev.participants.find((p) => p.id === 'masha')!.paidById = 'valya'
    const balances = participantBalances(ev)
    // у маши owed обнуляется (её долю несёт valya)
    expect(balances.get('masha')!.owed).toBe(0)
    // paid остаётся как было (masha оплатила мясо 1718)
    expect(balances.get('masha')!.paid).toBe(1718)
  })

  it('ИНВАРИАНТ: сумма всех балансов = 0 при наличии плательщиков за других', () => {
    const ev = makeEvent()
    ev.participants.find((p) => p.id === 'masha')!.paidById = 'valya'
    ev.participants.find((p) => p.id === 'ilya')!.paidById = 'andr'
    const balances = participantBalances(ev)
    const sum = [...balances.values()].reduce((acc, b) => acc + b.balance, 0)
    expect(sum).toBe(0)
  })

  it('переводы обнуляются и тот, за кого платят, не фигурирует как должник', () => {
    const ev = makeEvent()
    ev.participants.find((p) => p.id === 'masha')!.paidById = 'valya'
    const report = buildReport(ev)
    // masha никому не должна: её долю несёт valya
    expect(report.settlements.some((s) => s.fromId === 'masha')).toBe(false)
    const balanceMap = new Map<ID, number>(report.balances.map((b) => [b.participantId, b.balance]))
    const after = applyTransfers(balanceMap, report.settlements)
    for (const v of after.values()) expect(v).toBe(0)
  })
})

describe('minimizeTransfers', () => {
  it('возвращает пустой список, когда все рассчитались', () => {
    const balances = new Map<ID, number>([
      ['a', 0],
      ['b', 0],
    ])
    expect(minimizeTransfers(balances)).toEqual([])
  })

  it('простой случай: один должник, один кредитор', () => {
    const balances = new Map<ID, number>([
      ['a', -100],
      ['b', 100],
    ])
    const transfers = minimizeTransfers(balances)
    expect(transfers).toEqual([{ fromId: 'a', toId: 'b', amount: 100 }])
  })

  it('после применения переводов все балансы обнуляются', () => {
    const ev = makeEvent()
    const balanceMap = new Map<ID, number>(
      [...participantBalances(ev)].map(([id, b]) => [id, b.balance]),
    )
    const transfers = minimizeTransfers(balanceMap)
    const after = applyTransfers(balanceMap, transfers)
    for (const v of after.values()) expect(v).toBe(0)
  })

  it('число переводов не превышает (число ненулевых балансов − 1)', () => {
    const ev = makeEvent()
    const balanceMap = new Map<ID, number>(
      [...participantBalances(ev)].map(([id, b]) => [id, b.balance]),
    )
    const nonZero = [...balanceMap.values()].filter((v) => v !== 0).length
    const transfers = minimizeTransfers(balanceMap)
    expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1))
  })

  it('все суммы переводов — целые положительные числа', () => {
    const balances = new Map<ID, number>([
      ['a', -50],
      ['b', -30],
      ['c', 80],
    ])
    const transfers = minimizeTransfers(balances)
    for (const t of transfers) {
      expect(Number.isInteger(t.amount)).toBe(true)
      expect(t.amount).toBeGreaterThan(0)
    }
    const sum = transfers.reduce((acc, t) => acc + t.amount, 0)
    expect(sum).toBe(80)
  })

  it('детерминированность: сортировка по убыванию и id', () => {
    const balances = new Map<ID, number>([
      ['a', -60],
      ['b', -40],
      ['c', 70],
      ['d', 30],
    ])
    const transfers = minimizeTransfers(balances)
    const after = applyTransfers(balances, transfers)
    for (const v of after.values()) expect(v).toBe(0)
    // крупнейший должник 'a'(60) гасит крупнейшего кредитора 'c'(70)
    expect(transfers[0]).toEqual({ fromId: 'a', toId: 'c', amount: 60 })
  })
})

describe('buildReport — взаиморасчёты', () => {
  it('включает балансы, переводы и список позиций без плательщика', () => {
    const ev = makeEvent()
    ev.expenses.push({
      id: 'noPayer',
      title: 'без плательщика',
      price: 200,
      payerId: null,
      participantIds: ['valya', 'masha'],
      createdAt: '',
    })
    const report = buildReport(ev)
    expect(report.balances.length).toBe(5)
    expect(report.expensesWithoutPayer.length).toBe(1)
    // переводы обнуляют балансы
    const balanceMap = new Map<ID, number>(report.balances.map((b) => [b.participantId, b.balance]))
    const after = applyTransfers(balanceMap, report.settlements)
    for (const v of after.values()) expect(v).toBe(0)
  })
})
