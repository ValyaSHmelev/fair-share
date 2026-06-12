<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { decodeEvent } from '@/lib/share'
import { buildReport } from '@/lib/calc'
import { formatMoney, formatDate } from '@/lib/format'
import { useEventsStore } from '@/stores/events'
import type { FairEvent } from '@/types/models'

const router = useRouter()
const toast = useToast()
const store = useEventsStore()

const event = ref<FairEvent | null>(null)
const error = ref<string | null>(null)
const loading = ref(true)
const importing = ref(false)

onMounted(async () => {
  const hash = window.location.hash.slice(1)
  if (!hash) {
    error.value = 'Ссылка не содержит данных мероприятия.'
    loading.value = false
    return
  }
  try {
    event.value = await decodeEvent(hash)
  } catch {
    error.value = 'Не удалось прочитать данные. Возможно, ссылка повреждена или устарела.'
  } finally {
    loading.value = false
  }
})

const report = computed(() => (event.value ? buildReport(event.value) : null))
const currency = computed(() => event.value?.currency ?? 'RUB')

const nameById = computed(
  () => new Map((event.value?.participants ?? []).map((p) => [p.id, p.name])),
)

function participantName(id: string): string {
  return nameById.value.get(id) ?? '?'
}

function money(value: number) {
  return formatMoney(value, currency.value)
}

async function importEvent() {
  if (!event.value) return
  importing.value = true
  try {
    store.importSingleEvent(event.value)
    toast.add({ severity: 'success', summary: 'Мероприятие добавлено', life: 2000 })
    await router.push({ name: 'events' })
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка импорта', life: 3000 })
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="share-page">
    <!-- Шапка страницы -->
    <header class="share-header">
      <div class="share-header-inner">
        <span class="share-logo">FairShare</span>
        <span class="share-badge">Общий доступ</span>
        <div class="share-spacer" />
        <Button
          label="Открыть приложение"
          icon="pi pi-external-link"
          severity="secondary"
          size="small"
          @click="router.push('/')"
        />
      </div>
    </header>

    <main class="share-main">
      <!-- Загрузка -->
      <div v-if="loading" class="share-center">
        <ProgressSpinner />
        <p class="share-hint">Загрузка данных…</p>
      </div>

      <!-- Ошибка -->
      <div v-else-if="error" class="share-center">
        <Message severity="error" :closable="false" style="width: 100%; max-width: 480px">
          {{ error }}
        </Message>
        <Button label="На главную" icon="pi pi-home" class="share-home-btn" @click="router.push('/')" />
      </div>

      <!-- Отчёт -->
      <div v-else-if="event && report" class="share-content fs-stack">
        <!-- Заголовок мероприятия -->
        <div class="event-header">
          <div>
            <h1 class="event-title">{{ event.name }}</h1>
            <p v-if="event.date" class="event-date fs-muted">{{ formatDate(event.date) }}</p>
          </div>
          <Button
            label="Добавить к себе"
            icon="pi pi-download"
            :loading="importing"
            @click="importEvent"
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

        <!-- Матрица расходов -->
        <div v-if="report.rows.length" class="fs-table-scroll">
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
        <section class="settlements fs-stack">
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

          <!-- Переводы -->
          <h4 class="transfers-title">Кто кому переводит</h4>
          <p v-if="!report.settlements.length" class="fs-muted all-settled">
            <i class="pi pi-check-circle" /> Все рассчитались — переводы не нужны.
          </p>
          <ul v-else class="transfer-list">
            <li v-for="(s, i) in report.settlements" :key="i" class="transfer-row">
              <span class="transfer-from">{{ participantName(s.fromId) }}</span>
              <i class="pi pi-arrow-right transfer-arrow" />
              <span class="transfer-to">{{ participantName(s.toId) }}</span>
              <div class="share-spacer" />
              <span class="transfer-amount">{{ money(s.amount) }}</span>
            </li>
          </ul>
        </section>

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

        <!-- Нижний баннер -->
        <div class="share-footer-banner">
          <span class="fs-muted">Создано в&nbsp;</span>
          <strong>FairShare</strong>
          <span class="fs-muted">&nbsp;— делите расходы честно</span>
          <Button
            label="Попробовать"
            icon="pi pi-external-link"
            severity="secondary"
            size="small"
            style="margin-left: 1rem"
            @click="router.push('/')"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.share-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--p-surface-ground);
}

.share-header {
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
  position: sticky;
  top: 0;
  z-index: 10;
}

.share-header-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.share-logo {
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--p-primary-color);
}

.share-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--p-primary-color);
  color: #fff;
  opacity: 0.85;
}

.share-spacer {
  flex: 1;
}

.share-main {
  flex: 1;
  padding: 1.5rem 1.25rem 3rem;
}

.share-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  min-height: 40vh;
}

.share-hint {
  color: var(--p-text-muted-color);
  margin: 0;
}

.share-home-btn {
  margin-top: 0.5rem;
}

.share-content {
  max-width: 960px;
  margin: 0 auto;
}

.event-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.event-title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
}

.event-date {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}

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

.transfer-from,
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

.share-footer-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  padding: 1.25rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.7rem;
  background: var(--p-content-background);
  font-size: 0.95rem;
}
</style>
