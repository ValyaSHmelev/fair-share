<script setup lang="ts">
import { RouterView } from 'vue-router'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import AppHeader from '@/components/AppHeader.vue'
</script>

<template>
  <AppHeader />
  <main class="fs-page">
    <div class="fs-container">
      <RouterView />
    </div>
  </main>
  <Toast position="bottom-right" />
  <ConfirmDialog />
</template>
