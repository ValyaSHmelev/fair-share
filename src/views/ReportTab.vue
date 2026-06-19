<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import { buildShareUrl } from '@/lib/share'
import Message from 'primevue/message'
import EmptyState from '@/components/EmptyState.vue'
import { useEventsStore } from '@/stores/events'
import { useAuthStore } from '@/stores/auth'
import { buildReport } from '@/lib/calc'
import { formatMoney } from '@/lib/format'

const props = defineProps<{ id: string }>()
const store = useEventsStore()
const auth = useAuthStore()
const toast = useToast()

const event = computed(() => store.getEventById(props.id))
const currency = computed(() => event.value?.currency ?? 'RUB')
const report = computed(() => (event.value ? buildReport(event.value) : null))

const nameById = computed(
  () => new Map((event.value?.participants ?? []).map((p) => [p.id, p.name])),
)

function participantName(id: string): string {
  return nameById.value.get(id) ?? '?'
}

function money(value: number) {
  return formatMoney(value, currency.value)
}

async function share() {
  if (!event.value) return
  const uid = auth.user?.uid
  if (!uid) {
    toast.add({ severity: 'warn', summary: 'Войдите в аккаунт, чтобы поделиться', life: 3000 })
    return
  }
  try {
    const url = buildShareUrl(uid, event.value.id)
    await navigator.clipboard.writeText(url)
    toast.add({ severity: 'success', summary: 'Ссылка скопирована', detail: 'Отправьте её участникам', life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Не удалось скопировать ссылку', life: 3000 })
  }
}
</script>

<template>
  <div v-if="event && report" class="fs-stack">
    <div class="fs-row fs-row-wrap">
      <h2 class="fs-section-title" style="margin: 0">Отчёт</h2>
      <div class="fs-spacer" />
      <Button
        label="Поделиться"
        icon="pi pi-share-alt"
        severity="secondary"
        @click="share"
      />
    </div>

    <!-- Сводка -->
    <div class="summary-cards">
      <div class="summary-card">
        <span class="summary-label">Всего потрачено</span>
        <span class="summary-value">{{ money(report.eventTotal) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">Участников</span>
        <span class="summary-value">{{ report.participants.length }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">Позиций</span>
        <span class="summary-value">{{ report.rows.length }}</span>
      </div>
    </div>

    <Message
      v-if="report.expensesWithoutParticipants.length"
      severity="warn"
      :closable="false"
    >
      Не разделены и не учтены в итогах:
      {{ report.expensesWithoutParticipants.map((e) => e.title).join(', ') }}
    </Message>

    <EmptyState
      v-if="!report.rows.length"
      icon="pi-chart-bar"
      title="Отчёт пуст"
      description="Добавьте позиции расходов, чтобы увидеть, кто сколько должен."
    />

    <!-- Матрица -->
    <div v-else class="fs-table-scroll">
      <table class="report-table">
        <thead>
          <tr>
            <th class="sticky-col">Наименование</th>
            <th class="num">Цена</th>
            <th v-for="p in report.participants" :key="p.id" class="num">{{ p.name }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in report.rows" :key="row.expense.id">
            <td class="sticky-col">{{ row.expense.title }}</td>
            <td class="num">{{ money(Math.round(row.expense.price)) }}</td>
            <td v-for="(share, i) in row.shares" :key="i" class="num">
              <span v-if="share !== undefined">{{ money(share) }}</span>
              <span v-else class="fs-muted dash">—</span>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td class="sticky-col">Итого</td>
            <td class="num">{{ money(report.eventTotal) }}</td>
            <td v-for="(total, i) in report.participantTotals" :key="i" class="num">
              {{ money(total) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Взаиморасчёты -->
    <section v-if="report.rows.length" class="settlements">
      <h3 class="fs-section-title">Взаиморасчёты</h3>

      <Message
        v-if="report.expensesWithoutPayer.length"
        severity="warn"
        :closable="false"
      >
        Не учтены в переводах (не указан плательщик):
        {{ report.expensesWithoutPayer.map((e) => e.title).join(', ') }}
      </Message>

      <!-- Балансы -->
      <div class="fs-table-scroll">
        <table class="report-table">
          <thead>
            <tr>
              <th class="sticky-col">Участник</th>
              <th class="num">Заплатил</th>
              <th class="num">Доля</th>
              <th class="num">Баланс</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in report.balances" :key="b.participantId">
              <td class="sticky-col">{{ participantName(b.participantId) }}</td>
              <td class="num">{{ money(b.paid) }}</td>
              <td class="num">{{ money(b.owed) }}</td>
              <td
                class="num balance"
                :class="{ positive: b.balance > 0, negative: b.balance < 0 }"
              >
                {{ b.balance > 0 ? '+' : '' }}{{ money(b.balance) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Кто кому переводит -->
      <h4 class="transfers-title">Кто кому переводит</h4>
      <p v-if="!report.settlements.length" class="fs-muted all-settled">
        <i class="pi pi-check-circle" /> Все рассчитались — переводы не нужны.
      </p>
      <ul v-else class="transfer-list">
        <li v-for="(s, i) in report.settlements" :key="i" class="transfer-row">
          <span class="transfer-from">{{ participantName(s.fromId) }}</span>
          <i class="pi pi-arrow-right transfer-arrow" />
          <span class="transfer-to">{{ participantName(s.toId) }}</span>
          <div class="fs-spacer" />
          <span class="transfer-amount">{{ money(s.amount) }}</span>
        </li>
      </ul>
    </section>

  </div>
</template>

<style scoped>
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}
.summary-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.7rem;
  background: var(--p-content-background);
}
.summary-label {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}
.summary-value {
  font-size: 1.4rem;
  font-weight: 800;
}
.report-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.9rem;
}
.report-table th,
.report-table td {
  padding: 0.55rem 0.7rem;
  border-bottom: 1px solid var(--p-content-border-color);
  text-align: left;
  white-space: nowrap;
}
.report-table th {
  font-weight: 700;
  background: var(--p-content-background);
}
.report-table .num {
  text-align: right;
}
.sticky-col {
  position: sticky;
  left: 0;
  background: var(--p-content-background);
  z-index: 1;
  text-align: left !important;
}
.total-row td {
  font-weight: 800;
  border-top: 2px solid var(--p-primary-color);
  border-bottom: none;
}
.dash {
  opacity: 0.5;
}
.balance.positive {
  color: var(--p-green-400, #22c55e);
  font-weight: 700;
}
.balance.negative {
  color: var(--p-red-400, #ef4444);
  font-weight: 700;
}
.transfers-title {
  margin: 1rem 0 0.5rem;
  font-size: 1rem;
}
.all-settled {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.transfer-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.transfer-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.6rem;
  background: var(--p-content-background);
}
.transfer-from {
  font-weight: 600;
}
.transfer-to {
  font-weight: 600;
}
.transfer-arrow {
  color: var(--p-primary-color);
}
.transfer-amount {
  font-weight: 800;
  font-size: 1.05rem;
}
</style>
