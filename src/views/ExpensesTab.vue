<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import EmptyState from '@/components/EmptyState.vue'
import ParticipantPicker from '@/components/ParticipantPicker.vue'
import { useEventsStore } from '@/stores/events'
import type { Expense } from '@/types/models'
import { CURRENCIES } from '@/types/models'
import { previewSharePerPerson } from '@/lib/calc'
import { formatMoney } from '@/lib/format'

const props = defineProps<{ id: string }>()
const store = useEventsStore()
const confirm = useConfirm()
const toast = useToast()

const event = computed(() => store.getEventById(props.id))
const currency = computed(() => event.value?.currency ?? 'RUB')
const symbol = computed(() => CURRENCIES[currency.value].symbol)

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<{ title: string; price: number | null; participantIds: string[] }>({
  title: '',
  price: null,
  participantIds: [],
})

const previewShare = computed(() => {
  if (!form.price || form.participantIds.length === 0) return 0
  return previewSharePerPerson(form.price, form.participantIds.length)
})

function participantNames(ids: string[]): string[] {
  const map = new Map(event.value?.participants.map((p) => [p.id, p.name]))
  return ids.map((id) => map.get(id) ?? '?')
}

function openCreate() {
  if (!event.value?.participants.length) {
    toast.add({
      severity: 'warn',
      summary: 'Сначала добавьте участников',
      detail: 'Перейдите на вкладку «Участники».',
      life: 3000,
    })
    return
  }
  editingId.value = null
  form.title = ''
  form.price = null
  form.participantIds = event.value.participants.map((p) => p.id)
  dialogVisible.value = true
}

function openEdit(expense: Expense) {
  editingId.value = expense.id
  form.title = expense.title
  form.price = expense.price
  form.participantIds = [...expense.participantIds]
  dialogVisible.value = true
}

function submit() {
  const title = form.title.trim()
  if (!title) {
    toast.add({ severity: 'warn', summary: 'Введите наименование', life: 2500 })
    return
  }
  if (form.price === null || form.price <= 0) {
    toast.add({ severity: 'warn', summary: 'Введите корректную цену', life: 2500 })
    return
  }
  const payload = { title, price: form.price, participantIds: form.participantIds }
  if (editingId.value) {
    store.updateExpense(props.id, editingId.value, payload)
  } else {
    store.addExpense(props.id, payload)
  }
  dialogVisible.value = false
}

function removeExpense(expense: Expense) {
  confirm.require({
    header: 'Удалить позицию?',
    message: `«${expense.title}» будет удалена.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Отмена',
    acceptLabel: 'Удалить',
    acceptClass: 'p-button-danger',
    accept: () => store.removeExpense(props.id, expense.id),
  })
}

function sharePerPerson(expense: Expense): number {
  return previewSharePerPerson(expense.price, expense.participantIds.length)
}
</script>

<template>
  <div v-if="event" class="fs-stack">
    <div class="fs-row fs-row-wrap">
      <h2 class="fs-section-title" style="margin: 0">Позиции расходов</h2>
      <div class="fs-spacer" />
      <Button label="Добавить позицию" icon="pi pi-plus" @click="openCreate" />
    </div>

    <Message v-if="!event.participants.length" severity="warn" :closable="false">
      Сначала добавьте участников на вкладке «Участники».
    </Message>

    <EmptyState
      v-else-if="!event.expenses.length"
      icon="pi-receipt"
      title="Нет позиций"
      description="Добавьте, что покупали, укажите цену и отметьте, на кого делить."
    >
      <Button label="Добавить позицию" icon="pi pi-plus" @click="openCreate" />
    </EmptyState>

    <ul v-else class="list">
      <li v-for="ex in event.expenses" :key="ex.id" class="expense-item">
        <div class="expense-main">
          <div class="expense-title">{{ ex.title }}</div>
          <div class="expense-sub fs-muted">
            <span v-if="ex.participantIds.length">
              {{ participantNames(ex.participantIds).join(', ') }}
            </span>
            <span v-else class="warn-text">ни на кого не разделено</span>
          </div>
        </div>
        <div class="expense-figures">
          <div class="expense-price">{{ formatMoney(ex.price, currency) }}</div>
          <div v-if="ex.participantIds.length" class="fs-muted expense-share">
            {{ formatMoney(sharePerPerson(ex), currency) }} × {{ ex.participantIds.length }}
          </div>
        </div>
        <div class="expense-actions">
          <Button
            icon="pi pi-pencil"
            text
            rounded
            severity="secondary"
            v-tooltip.bottom="'Редактировать'"
            @click="openEdit(ex)"
          />
          <Button
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            v-tooltip.bottom="'Удалить'"
            @click="removeExpense(ex)"
          />
        </div>
      </li>
    </ul>

    <Dialog
      v-model:visible="dialogVisible"
      :header="editingId ? 'Редактировать позицию' : 'Новая позиция'"
      modal
      :style="{ width: '32rem', maxWidth: '95vw' }"
    >
      <div class="fs-stack dialog-form">
        <div class="field">
          <label for="ex-title">Наименование</label>
          <InputText
            id="ex-title"
            v-model="form.title"
            placeholder="Например, мясо"
            autofocus
            fluid
          />
        </div>
        <div class="field">
          <label for="ex-price">Цена</label>
          <InputNumber
            id="ex-price"
            v-model="form.price"
            :min="0"
            :maxFractionDigits="2"
            :suffix="' ' + symbol"
            placeholder="0"
            fluid
          />
        </div>
        <div class="field">
          <label>На кого делить</label>
          <ParticipantPicker
            :participants="event.participants"
            v-model="form.participantIds"
          />
        </div>
        <Message
          v-if="form.participantIds.length && previewShare > 0"
          severity="info"
          :closable="false"
        >
          По {{ formatMoney(previewShare, currency) }} с человека ({{ form.participantIds.length }} уч.)
        </Message>
        <Message v-else-if="!form.participantIds.length" severity="warn" :closable="false">
          Не выбран ни один участник — позиция не попадёт в итоги.
        </Message>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="dialogVisible = false" />
        <Button :label="editingId ? 'Сохранить' : 'Добавить'" icon="pi pi-check" @click="submit" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.expense-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.6rem;
  background: var(--p-content-background);
}
.expense-main {
  flex: 1;
  min-width: 0;
}
.expense-title {
  font-weight: 600;
}
.expense-sub {
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.warn-text {
  color: var(--p-orange-400, #f59e0b);
}
.expense-figures {
  text-align: right;
  white-space: nowrap;
}
.expense-price {
  font-weight: 700;
}
.expense-share {
  font-size: 0.8rem;
}
.expense-actions {
  display: flex;
  gap: 0.1rem;
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
@media (max-width: 640px) {
  .expense-sub {
    white-space: normal;
  }
}
</style>
