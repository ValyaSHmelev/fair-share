<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
</script>

<template>
  <EmptyState
    icon="pi-compass"
    title="Страница не найдена"
    description="Возможно, мероприятие было удалено или ссылка неверна."
  >
    <Button label="На главную" icon="pi pi-home" @click="router.push('/')" />
  </EmptyState>
</template>
