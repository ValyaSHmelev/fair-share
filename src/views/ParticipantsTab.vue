<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import EmptyState from '@/components/EmptyState.vue'
import { useEventsStore } from '@/stores/events'
import type { Participant } from '@/types/models'

const props = defineProps<{ id: string }>()
const store = useEventsStore()
const confirm = useConfirm()
const toast = useToast()

const event = computed(() => store.getEventById(props.id))

// Сентинел для варианта «Сам»: PrimeVue Select при modelValue === null показывает
// плейсхолдер, поэтому в UI используем ненулевое значение.
const SELF = 'self'

const newName = ref('')
const newPaidById = ref<string>(SELF)

// Варианты «кто платит» при добавлении нового участника — «Сам» + уже добавленные.
const newPayerOptions = computed(() => [
  { label: 'Сам', value: SELF },
  ...(event.value?.participants.map((p) => ({ label: p.name, value: p.id })) ?? []),
])

// Варианты «кто платит» для существующего участника — «Сам» + все, кроме него самого.
function payerOptions(participantId: string) {
  return [
    { label: 'Сам', value: SELF },
    ...(event.value?.participants
      .filter((p) => p.id !== participantId)
      .map((p) => ({ label: p.name, value: p.id })) ?? []),
  ]
}

function payerName(paidById: string | null): string | null {
  if (!paidById) return null
  return event.value?.participants.find((p) => p.id === paidById)?.name ?? null
}

function setPaidBy(participantId: string, value: string) {
  store.setPaidBy(props.id, participantId, value === SELF ? null : value)
}

function addParticipant() {
  const name = newName.value.trim()
  if (!name) return
  store.addParticipant(props.id, name, newPaidById.value === SELF ? null : newPaidById.value)
  newName.value = ''
  newPaidById.value = SELF
}

const editingId = ref<string | null>(null)
const editName = ref('')

function startEdit(p: Participant) {
  editingId.value = p.id
  editName.value = p.name
}
function saveEdit() {
  if (editingId.value && editName.value.trim()) {
    store.renameParticipant(props.id, editingId.value, editName.value)
  }
  editingId.value = null
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
    <!-- Добавление участника -->
    <section>
      <h2 class="fs-section-title">Участники</h2>
      <div class="add-row">
        <InputText
          v-model="newName"
          placeholder="Имя участника"
          fluid
          @keyup.enter="addParticipant"
        />
        <Select
          v-model="newPaidById"
          :options="newPayerOptions"
          optionLabel="label"
          optionValue="value"
          class="payer-select"
          v-tooltip.bottom="'Кто платит за этого участника'"
        />
        <Button label="Добавить" icon="pi pi-plus" @click="addParticipant" />
      </div>
      <p class="fs-muted payer-hint">
        «Кто платит» — за кого этот участник переводит деньги. По умолчанию «Сам».
        Удобно для пар: например, парень платит за свою половинку — это сократит число переводов.
      </p>

      <EmptyState
        v-if="!event.participants.length"
        icon="pi-user-plus"
        title="Нет участников"
        description="Добавьте участников, чтобы делить на них расходы. Тёзки допустимы."
      />

      <ul v-else class="list">
        <li v-for="p in event.participants" :key="p.id" class="list-item">
          <template v-if="editingId === p.id">
            <InputText
              v-model="editName"
              fluid
              autofocus
              @keyup.enter="saveEdit"
              @keyup.escape="editingId = null"
            />
            <Button icon="pi pi-check" text rounded @click="saveEdit" />
            <Button icon="pi pi-times" text rounded severity="secondary" @click="editingId = null" />
          </template>
          <template v-else>
            <span class="item-name">{{ p.name }}</span>
            <Tag
              v-if="payerName(p.paidById)"
              :value="`платит ${payerName(p.paidById)}`"
              icon="pi pi-wallet"
              severity="info"
            />
            <div class="fs-spacer" />
            <Select
              :modelValue="p.paidById ?? SELF"
              :options="payerOptions(p.id)"
              optionLabel="label"
              optionValue="value"
              class="payer-select"
              v-tooltip.bottom="'Кто платит за этого участника'"
              @update:modelValue="(v: string) => setPaidBy(p.id, v)"
            />
            <Button
              icon="pi pi-pencil"
              text
              rounded
              severity="secondary"
              v-tooltip.bottom="'Переименовать'"
              @click="startEdit(p)"
            />
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              v-tooltip.bottom="'Удалить'"
              @click="removeParticipant(p)"
            />
          </template>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.add-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.add-row :deep(.p-inputtext) {
  flex: 1;
}
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
.item-name {
  font-weight: 600;
}
.payer-select {
  min-width: 9rem;
}
.payer-hint {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
}
@media (max-width: 640px) {
  .payer-select {
    min-width: 7rem;
  }
}
</style>
