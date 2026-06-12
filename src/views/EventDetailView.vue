<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useEventsStore } from '@/stores/events'
import { CURRENCIES } from '@/types/models'
import { eventTotal } from '@/lib/calc'
import { formatDate, formatMoney } from '@/lib/format'

const props = defineProps<{ id: string }>()
const store = useEventsStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const event = computed(() => store.getEventById(props.id))

watchEffect(() => {
  if (!event.value) {
    toast.add({ severity: 'warn', summary: 'Мероприятие не найдено', life: 2500 })
    router.replace('/')
  }
})

const tabs = [
  { label: 'Участники', icon: 'pi pi-users', name: 'event-participants' },
  { label: 'Расходы', icon: 'pi pi-receipt', name: 'event-expenses' },
  { label: 'Отчёт', icon: 'pi pi-chart-bar', name: 'event-report' },
]

function isActive(name: string) {
  return route.name === name
}

function go(name: string) {
  router.push({ name, params: { id: props.id } })
}
</script>

<template>
  <div v-if="event" class="fs-stack">
    <div class="detail-head">
      <Button
        icon="pi pi-arrow-left"
        severity="secondary"
        text
        rounded
        v-tooltip.bottom="'К списку'"
        @click="router.push('/')"
      />
      <div class="head-info">
        <h1 class="fs-title">{{ event.name }}</h1>
        <div class="fs-row fs-row-wrap head-meta">
          <span class="fs-muted">{{ formatDate(event.date) || 'Без даты' }}</span>
          <Tag :value="formatMoney(eventTotal(event), event.currency)" severity="info" />
          <span class="fs-muted">{{ CURRENCIES[event.currency].label }}</span>
        </div>
      </div>
    </div>

    <nav class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.name"
        type="button"
        class="tab-btn"
        :class="{ active: isActive(tab.name) }"
        @click="go(tab.name)"
      >
        <i :class="tab.icon" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <RouterView />
  </div>
</template>

<style scoped>
.detail-head {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.head-info {
  flex: 1;
}
.head-meta {
  margin-top: 0.3rem;
  gap: 0.6rem;
}
.tab-bar {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--p-content-border-color);
  overflow-x: auto;
}
.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.7rem 1rem;
  border: none;
  background: transparent;
  color: var(--p-text-muted-color);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.tab-btn:hover {
  color: var(--p-text-color);
}
.tab-btn.active {
  color: var(--p-primary-color);
  border-bottom-color: var(--p-primary-color);
}
</style>
