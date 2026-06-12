import { describe, expect, it } from 'vitest'
import {
  buildReport,
  eventTotal,
  expenseShares,
  participantTotals,
  splitEqualRounded,
  sumOfAllShares,
} from '@/lib/calc'
import type { FairEvent } from '@/types/models'

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
  const [valya, masha, andr, ilya] = ids
  return {
    id: 'ev1',
    name: 'Шашлыки',
    date: null,
    currency: 'RUB',
    participants: ids.map((id) => ({ id, name: id, groupId: null })),
    groups: [],
    expenses: [
      { id: 'e1', title: 'сижки', price: 460, participantIds: [valya, andr, ilya], createdAt: '' },
      { id: 'e2', title: 'мясо', price: 1718, participantIds: ids, createdAt: '' },
      { id: 'e3', title: 'магнит', price: 771, participantIds: ids, createdAt: '' },
      { id: 'e4', title: 'овощи', price: 169, participantIds: ids, createdAt: '' },
      {
        id: 'e5',
        title: 'такси',
        price: 397,
        participantIds: [valya, masha, andr, ilya],
        createdAt: '',
      },
      { id: 'e6', title: 'дастархан', price: 700, participantIds: ids, createdAt: '' },
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
    ev.expenses.push({ id: 'e7', title: 'пусто', price: 999, participantIds: [], createdAt: '' })
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
  it('строит матрицу с итогами и группами', () => {
    const ev = makeEvent()
    ev.groups = [{ id: 'g1', name: 'Валя и Маша' }]
    ev.participants[0].groupId = 'g1'
    ev.participants[1].groupId = 'g1'
    const report = buildReport(ev)

    expect(report.rows.length).toBe(6)
    expect(report.participants.length).toBe(5)
    expect(report.participantTotals.reduce((a, b) => a + b, 0)).toBe(report.eventTotal)

    const g = report.groupTotals[0]
    expect(g.members.length).toBe(2)
    // итог группы = сумма итогов Вали и Маши
    expect(g.total).toBe(report.participantTotals[0] + report.participantTotals[1])
  })

  it('собирает позиции без участников отдельно', () => {
    const ev = makeEvent()
    ev.expenses.push({ id: 'e7', title: 'пусто', price: 50, participantIds: [], createdAt: '' })
    const report = buildReport(ev)
    expect(report.expensesWithoutParticipants.length).toBe(1)
    expect(report.rows.length).toBe(6)
  })
})
