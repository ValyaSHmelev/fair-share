<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import EmptyState from '@/components/EmptyState.vue'
import { useEventsStore } from '@/stores/events'
import { POPULAR_BANKS, type Participant } from '@/types/models'

const props = defineProps<{ id: string }>()
const store = useEventsStore()
const confirm = useConfirm()
const toast = useToast()

const event = computed(() => store.getEventById(props.id))

// Сентинел для варианта «Сам»: PrimeVue Select при modelValue === null показывает
// плейсхолдер, поэтому в UI используем ненулевое значение.
const SELF = 'self'

const bankOptions = POPULAR_BANKS.map((b) => ({ label: b, value: b }))

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<{
  name: string
  paidById: string
  sbpPhone: string
  bank: string
  recipient: string
}>({
  name: '',
  paidById: SELF,
  sbpPhone: '',
  bank: '',
  recipient: '',
})

// Варианты «кто платит»: «Сам» + все участники, кроме редактируемого.
const payerOptions = computed(() => [
  { label: 'Сам', value: SELF },
  ...(event.value?.participants
    .filter((p) => p.id !== editingId.value)
    .map((p) => ({ label: p.name, value: p.id })) ?? []),
])

function payerName(paidById: string | null): string | null {
  if (!paidById) return null
  return event.value?.participants.find((p) => p.id === paidById)?.name ?? null
}

function openCreate() {
  editingId.value = null
  form.name = ''
  form.paidById = SELF
  form.sbpPhone = ''
  form.bank = ''
  form.recipient = ''
  dialogVisible.value = true
}

function openEdit(p: Participant) {
  editingId.value = p.id
  form.name = p.name
  form.paidById = p.paidById ?? SELF
  form.sbpPhone = p.sbpPhone ?? ''
  form.bank = p.bank ?? ''
  form.recipient = p.recipient ?? ''
  dialogVisible.value = true
}

function submit() {
  const name = form.name.trim()
  if (!name) {
    toast.add({ severity: 'warn', summary: 'Введите имя участника', life: 2500 })
    return
  }
  const paidById = form.paidById === SELF ? null : form.paidById
  const payment = {
    sbpPhone: form.sbpPhone.trim(),
    bank: form.bank.trim(),
    recipient: form.recipient.trim(),
  }
  if (editingId.value) {
    store.updateParticipant(props.id, editingId.value, { name, paidById, ...payment })
  } else {
    store.addParticipant(props.id, name, paidById, payment)
  }
  dialogVisible.value = false
}

function removeParticipant(p: Participant) {
  confirm.require({
    header: 'Удалить участника?',
    message: `«${p.name}» будет удалён и убран из всех позиций расходов.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Отмена',
    acceptLabel: 'Удалить',
    acceptClass: 'p-button-danger',
    accept: () => {
      store.removeParticipant(props.id, p.id)
      toast.add({ severity: 'info', summary: 'Участник удалён', life: 2000 })
    },
  })
}
</script>

<template>
  <div v-if="event" class="fs-stack">
    <div class="fs-row fs-row-wrap">
      <h2 class="fs-section-title" style="margin: 0">Участники</h2>
      <div class="fs-spacer" />
      <Button label="Добавить участника" icon="pi pi-plus" @click="openCreate" />
    </div>

    <p class="fs-muted payer-hint">
      «Кто платит» — за кого этот участник переводит деньги. По умолчанию «Сам».
      Удобно для пар: например, парень платит за свою половинку — это сократит число переводов.
      Реквизиты (СБП, банк, получатель) опциональны и показываются в отчёте.
    </p>

    <EmptyState
      v-if="!event.participants.length"
      icon="pi-user-plus"
      title="Нет участников"
      description="Добавьте участников, чтобы делить на них расходы. Тёзки допустимы."
    >
      <Button label="Добавить участника" icon="pi pi-plus" @click="openCreate" />
    </EmptyState>

    <ul v-else class="list">
      <li v-for="p in event.participants" :key="p.id" class="list-item">
        <div class="item-main">
          <div class="item-head">
            <span class="item-name">{{ p.name }}</span>
            <Tag
              v-if="payerName(p.paidById)"
              :value="`платит ${payerName(p.paidById)}`"
              icon="pi pi-wallet"
              severity="info"
            />
          </div>
          <div v-if="p.sbpPhone || p.bank || p.recipient" class="item-payment fs-muted">
            <span v-if="p.sbpPhone"><i class="pi pi-phone" /> {{ p.sbpPhone }}</span>
            <span v-if="p.bank"><i class="pi pi-building" /> {{ p.bank }}</span>
            <span v-if="p.recipient"><i class="pi pi-user" /> {{ p.recipient }}</span>
          </div>
        </div>
        <div class="fs-spacer" />
        <Button
          icon="pi pi-pencil"
          text
          rounded
          severity="secondary"
          v-tooltip.bottom="'Редактировать'"
          @click="openEdit(p)"
        />
        <Button
          icon="pi pi-trash"
          text
          rounded
          severity="danger"
          v-tooltip.bottom="'Удалить'"
          @click="removeParticipant(p)"
        />
      </li>
    </ul>

    <Dialog
      v-model:visible="dialogVisible"
      :header="editingId ? 'Редактировать участника' : 'Новый участник'"
      modal
      :style="{ width: '32rem', maxWidth: '95vw' }"
    >
      <div class="fs-stack dialog-form">
        <div class="field">
          <label for="p-name">Имя участника <span class="req">*</span></label>
          <InputText
            id="p-name"
            v-model="form.name"
            placeholder="Например, Валентин"
            autofocus
            fluid
            @keyup.enter="submit"
          />
        </div>
        <div class="field">
          <label for="p-payer">Кто за него платит</label>
          <Select
            id="p-payer"
            v-model="form.paidById"
            :options="payerOptions"
            optionLabel="label"
            optionValue="value"
            fluid
          />
        </div>
        <div class="field">
          <label for="p-phone">Номер для перевода по СБП</label>
          <InputText
            id="p-phone"
            v-model="form.sbpPhone"
            placeholder="+7 900 000-00-00"
            fluid
          />
        </div>
        <div class="field">
          <label for="p-bank">Банк</label>
          <Select
            id="p-bank"
            v-model="form.bank"
            :options="bankOptions"
            optionLabel="label"
            optionValue="value"
            editable
            placeholder="Выберите или впишите банк"
            fluid
          />
        </div>
        <div class="field">
          <label for="p-recipient">Получатель</label>
          <InputText
            id="p-recipient"
            v-model="form.recipient"
            placeholder="Например, Валентин Ш."
            fluid
          />
          <small class="fs-muted">Как имя получателя высвечивается в приложении банка.</small>
        </div>
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
.list-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.6rem;
  background: var(--p-content-background);
}
.item-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.item-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.item-name {
  font-weight: 600;
}
.item-payment {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.85rem;
  font-size: 0.85rem;
}
.item-payment i {
  margin-right: 0.25rem;
}
.payer-hint {
  margin: 0;
  font-size: 0.875rem;
}
.dialog-form .field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.dialog-form label {
  font-size: 0.85rem;
  font-weight: 600;
}
.req {
  color: var(--p-red-400, #ef4444);
}
</style>
