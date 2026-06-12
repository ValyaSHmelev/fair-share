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

const newName = ref('')
const newGroupName = ref('')

const groupOptions = computed(() => [
  { label: 'Без группы', value: null },
  ...(event.value?.groups.map((g) => ({ label: g.name, value: g.id })) ?? []),
])

function groupName(groupId: string | null): string | null {
  if (!groupId) return null
  return event.value?.groups.find((g) => g.id === groupId)?.name ?? null
}

function addParticipant() {
  const name = newName.value.trim()
  if (!name) return
  store.addParticipant(props.id, name)
  newName.value = ''
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

function addGroup() {
  const name = newGroupName.value.trim()
  if (!name) return
  store.addGroup(props.id, name)
  newGroupName.value = ''
}

function removeGroup(groupId: string, name: string) {
  confirm.require({
    header: 'Удалить группу?',
    message: `Группа «${name}» будет удалена. Участники останутся, но без группы.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Отмена',
    acceptLabel: 'Удалить',
    acceptClass: 'p-button-danger',
    accept: () => store.removeGroup(props.id, groupId),
  })
}

function setGroup(participantId: string, groupId: string | null) {
  store.assignToGroup(props.id, participantId, groupId)
}

function membersCount(groupId: string): number {
  return event.value?.participants.filter((p) => p.groupId === groupId).length ?? 0
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
        <Button label="Добавить" icon="pi pi-plus" @click="addParticipant" />
      </div>

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
              v-if="groupName(p.groupId)"
              :value="groupName(p.groupId)!"
              severity="success"
            />
            <div class="fs-spacer" />
            <Select
              :modelValue="p.groupId"
              :options="groupOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Группа"
              class="group-select"
              @update:modelValue="(v: string | null) => setGroup(p.id, v)"
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

    <!-- Группы -->
    <section>
      <h2 class="fs-section-title">Группы (пары)</h2>
      <p class="fs-muted group-hint">
        Группы не меняют расчёт по людям — они показывают суммарный итог по паре/компании в отчёте.
      </p>
      <div class="add-row">
        <InputText
          v-model="newGroupName"
          placeholder="Название группы, напр. «Валя и Маша»"
          fluid
          @keyup.enter="addGroup"
        />
        <Button label="Добавить" icon="pi pi-plus" severity="secondary" @click="addGroup" />
      </div>

      <p v-if="!event.groups.length" class="fs-muted">Групп пока нет.</p>
      <ul v-else class="list">
        <li v-for="g in event.groups" :key="g.id" class="list-item">
          <span class="item-name">{{ g.name }}</span>
          <Tag :value="`${membersCount(g.id)} уч.`" severity="secondary" />
          <div class="fs-spacer" />
          <Button
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            v-tooltip.bottom="'Удалить группу'"
            @click="removeGroup(g.id, g.name)"
          />
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
.group-select {
  min-width: 9rem;
}
.group-hint {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
}
@media (max-width: 640px) {
  .group-select {
    min-width: 7rem;
  }
}
</style>
