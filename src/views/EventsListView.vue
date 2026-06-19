<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { useEventsStore } from '@/stores/events'
import { CURRENCIES, type CurrencyCode, type FairEvent } from '@/types/models'
import { eventTotal } from '@/lib/calc'
import { formatDate, formatMoney } from '@/lib/format'
import EmptyState from '@/components/EmptyState.vue'

const store = useEventsStore()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()

const search = ref('')
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const currencyOptions = Object.values(CURRENCIES).map((c) => ({
  label: `${c.symbol} ${c.label}`,
  value: c.code,
}))

const form = reactive<{ name: string; date: Date | null; currency: CurrencyCode }>({
  name: '',
  date: null,
  currency: 'RUB',
})

const sortedEvents = computed(() => {
  const q = search.value.trim().toLowerCase()
  return [...store.events]
    .filter((e) => !q || e.name.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
})

function openCreate() {
  editingId.value = null
  form.name = ''
  form.date = null
  form.currency = 'RUB'
  dialogVisible.value = true
}

function openEdit(event: FairEvent) {
  editingId.value = event.id
  form.name = event.name
  form.date = event.date ? new Date(event.date) : null
  form.currency = event.currency
  dialogVisible.value = true
}

function submit() {
  const name = form.name.trim()
  if (!name) {
    toast.add({ severity: 'warn', summary: 'Введите название', life: 2500 })
    return
  }
  const dateIso = form.date ? form.date.toISOString() : null
  if (editingId.value) {
    store.updateEvent(editingId.value, { name, date: dateIso, currency: form.currency })
    toast.add({ severity: 'success', summary: 'Мероприятие обновлено', life: 2000 })
    dialogVisible.value = false
  } else {
    const created = store.createEvent({ name, date: dateIso, currency: form.currency })
    dialogVisible.value = false
    router.push({ name: 'event-participants', params: { id: created.id } })
  }
}

function openEvent(event: FairEvent) {
  router.push({ name: 'event-participants', params: { id: event.id } })
}

function duplicate(event: FairEvent) {
  const clone = store.duplicateEvent(event.id)
  if (clone) toast.add({ severity: 'success', summary: 'Создана копия', life: 2000 })
}

function confirmDelete(event: FairEvent) {
  confirm.require({
    header: 'Удалить мероприятие?',
    message: `«${event.name}» будет удалено безвозвратно.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Отмена',
    acceptLabel: 'Удалить',
    acceptClass: 'p-button-danger',
    accept: () => {
      store.deleteEvent(event.id)
      toast.add({ severity: 'info', summary: 'Мероприятие удалено', life: 2000 })
    },
  })
}

function summary(event: FairEvent) {
  return {
    total: formatMoney(eventTotal(event), event.currency),
    participants: event.participants.length,
    expenses: event.expenses.length,
  }
}
</script>

<template>
  <div class="fs-stack">
    <div class="fs-row fs-row-wrap">
      <h1 class="fs-title">Мероприятия</h1>
      <div class="fs-spacer" />
      <Button label="Создать" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div v-if="!store.ready" class="fs-loading">
      <i class="pi pi-spin pi-spinner" />
      <span>Загрузка…</span>
    </div>

    <template v-else>
    <IconField v-if="store.events.length" class="search-field">
      <InputIcon class="pi pi-search" />
      <InputText v-model="search" placeholder="Поиск по названию" fluid />
    </IconField>

    <EmptyState
      v-if="!store.events.length"
      icon="pi-calendar-plus"
      title="Пока нет мероприятий"
      description="Создайте первое мероприятие, добавьте участников и расходы — FairShare посчитает, кто сколько должен."
    >
      <Button label="Создать первое мероприятие" icon="pi pi-plus" @click="openCreate" />
    </EmptyState>

    <EmptyState
      v-else-if="!sortedEvents.length"
      icon="pi-search"
      title="Ничего не найдено"
      description="Попробуйте изменить запрос."
    />

    <div v-else class="events-grid">
      <Card v-for="event in sortedEvents" :key="event.id" class="event-card">
        <template #title>
          <div class="card-title-row" @click="openEvent(event)">
            <span class="card-name">{{ event.name }}</span>
          </div>
        </template>
        <template #subtitle>
          <span class="fs-muted">{{ formatDate(event.date) || 'Без даты' }}</span>
        </template>
        <template #content>
          <div class="card-body" @click="openEvent(event)">
            <div class="card-total">{{ summary(event).total }}</div>
            <div class="card-tags">
              <Tag :value="`${summary(event).participants} уч.`" severity="secondary" />
              <Tag :value="`${summary(event).expenses} поз.`" severity="secondary" />
              <Tag :value="CURRENCIES[event.currency].symbol" severity="info" />
            </div>
          </div>
        </template>
        <template #footer>
          <div class="card-actions">
            <Button
              label="Открыть"
              icon="pi pi-arrow-right"
              size="small"
              @click="openEvent(event)"
            />
            <div class="fs-spacer" />
            <Button
              icon="pi pi-pencil"
              severity="secondary"
              text
              rounded
              size="small"
              v-tooltip.bottom="'Переименовать'"
              @click="openEdit(event)"
            />
            <Button
              icon="pi pi-copy"
              severity="secondary"
              text
              rounded
              size="small"
              v-tooltip.bottom="'Дублировать'"
              @click="duplicate(event)"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              size="small"
              v-tooltip.bottom="'Удалить'"
              @click="confirmDelete(event)"
            />
          </div>
        </template>
      </Card>
    </div>
    </template>

    <Dialog
      v-model:visible="dialogVisible"
      :header="editingId ? 'Редактировать мероприятие' : 'Новое мероприятие'"
      modal
      :style="{ width: '28rem', maxWidth: '95vw' }"
    >
      <div class="fs-stack dialog-form">
        <div class="field">
          <label for="ev-name">Название</label>
          <InputText
            id="ev-name"
            v-model="form.name"
            placeholder="Например, Шашлыки на даче"
            autofocus
            fluid
            @keyup.enter="submit"
          />
        </div>
        <div class="field">
          <label for="ev-date">Дата (необязательно)</label>
          <DatePicker id="ev-date" v-model="form.date" dateFormat="dd.mm.yy" showButtonBar fluid />
        </div>
        <div class="field">
          <label for="ev-cur">Валюта</label>
          <Select
            id="ev-cur"
            v-model="form.currency"
            :options="currencyOptions"
            optionLabel="label"
            optionValue="value"
            fluid
          />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="dialogVisible = false" />
        <Button :label="editingId ? 'Сохранить' : 'Создать'" icon="pi pi-check" @click="submit" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.search-field {
  max-width: 360px;
  width: 100%;
}
.fs-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 3rem 0;
  color: var(--p-text-muted-color);
}
.fs-loading .pi-spinner {
  font-size: 1.4rem;
}
.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.event-card {
  cursor: default;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.event-card:hover {
  transform: translateY(-2px);
}
.card-title-row,
.card-body {
  cursor: pointer;
}
.card-name {
  font-size: 1.1rem;
  font-weight: 700;
}
.card-total {
  font-size: 1.5rem;
  font-weight: 800;
  margin-bottom: 0.6rem;
}
.card-tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.card-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.dialog-form .field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.dialog-form label {
  font-weight: 600;
  font-size: 0.9rem;
}
</style>
