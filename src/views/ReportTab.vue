<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Message from 'primevue/message'
import EmptyState from '@/components/EmptyState.vue'
import { useEventsStore } from '@/stores/events'
import { buildReport } from '@/lib/calc'
import { formatMoney } from '@/lib/format'
import { exportReportToCsv } from '@/lib/io'

const props = defineProps<{ id: string }>()
const store = useEventsStore()
const toast = useToast()

const event = computed(() => store.getEventById(props.id))
const currency = computed(() => event.value?.currency ?? 'RUB')
const report = computed(() => (event.value ? buildReport(event.value) : null))

function money(value: number) {
  return formatMoney(value, currency.value)
}

function exportCsv() {
  if (!event.value) return
  exportReportToCsv(event.value)
  toast.add({ severity: 'success', summary: 'Отчёт выгружен в CSV', life: 2000 })
}
</script>

<template>
  <div v-if="event && report" class="fs-stack">
    <div class="fs-row fs-row-wrap">
      <h2 class="fs-section-title" style="margin: 0">Отчёт</h2>
      <div class="fs-spacer" />
      <Button
        label="Экспорт в CSV"
        icon="pi pi-download"
        severity="secondary"
        :disabled="!report.rows.length"
        @click="exportCsv"
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

    <!-- Итоги по группам -->
    <section v-if="report.groupTotals.length">
      <h3 class="fs-section-title">Итого по группам</h3>
      <ul class="group-list">
        <li v-for="gt in report.groupTotals" :key="gt.group.id" class="group-row">
          <div class="group-info">
            <span class="group-name">{{ gt.group.name }}</span>
            <span class="fs-muted group-members">
              {{ gt.members.map((m) => m.name).join(', ') || 'нет участников' }}
            </span>
          </div>
          <span class="group-total">{{ money(gt.total) }}</span>
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
.group-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.group-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.6rem;
  background: var(--p-content-background);
}
.group-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.group-name {
  font-weight: 700;
}
.group-members {
  font-size: 0.82rem;
}
.group-total {
  font-weight: 800;
  font-size: 1.05rem;
}
</style>
