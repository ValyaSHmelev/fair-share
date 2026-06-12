<script setup lang="ts">
import { computed } from 'vue'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import type { Participant } from '@/types/models'

const props = defineProps<{
  participants: Participant[]
  modelValue: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const selected = computed({
  get: () => props.modelValue,
  set: (v: string[]) => emit('update:modelValue', v),
})

function selectAll() {
  selected.value = props.participants.map((p) => p.id)
}
function clearAll() {
  selected.value = []
}
</script>

<template>
  <div class="picker">
    <div class="picker-toolbar">
      <span class="fs-muted">Выбрано: {{ selected.length }} из {{ participants.length }}</span>
      <div class="fs-spacer" />
      <Button label="Все" size="small" text @click="selectAll" />
      <Button label="Снять" size="small" text severity="secondary" @click="clearAll" />
    </div>
    <div class="picker-list">
      <label v-for="p in participants" :key="p.id" class="picker-item">
        <Checkbox v-model="selected" :value="p.id" />
        <span>{{ p.name }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.picker-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}
.picker-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.4rem;
  max-height: 240px;
  overflow-y: auto;
}
.picker-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.5rem;
  cursor: pointer;
}
.picker-item:hover {
  border-color: var(--p-primary-color);
}
</style>
