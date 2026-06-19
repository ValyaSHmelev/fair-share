<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import AppHeader from '@/components/AppHeader.vue'

const route = useRoute()
const showHeader = computed(() => route.name !== 'login' && route.name !== 'register')
</script>

<template>
  <AppHeader v-if="showHeader" />
  <main v-if="showHeader" class="fs-page">
    <div class="fs-container">
      <RouterView />
    </div>
  </main>
  <RouterView v-else />
  <Toast position="bottom-right" />
  <ConfirmDialog />
</template>
