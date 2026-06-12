<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import Button from 'primevue/button'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const router = useRouter()

function goSettings() {
  router.push({ name: 'settings' })
}
</script>

<template>
  <header class="app-header">
    <div class="fs-container header-inner">
      <RouterLink to="/" class="brand">
        <span class="brand-mark">FS</span>
        <span class="brand-name">FairShare</span>
      </RouterLink>
      <div class="fs-spacer" />
      <Button
        :icon="settings.theme === 'dark' ? 'pi pi-moon' : 'pi pi-sun'"
        severity="secondary"
        text
        rounded
        :aria-label="settings.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'"
        v-tooltip.bottom="settings.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'"
        @click="settings.toggleTheme()"
      />
      <Button
        icon="pi pi-cog"
        severity="secondary"
        text
        rounded
        aria-label="Настройки"
        v-tooltip.bottom="'Настройки'"
        @click="goSettings"
      />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--p-content-background);
  border-bottom: 1px solid var(--p-content-border-color);
  backdrop-filter: blur(8px);
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  font-size: 1.15rem;
}

.brand-mark {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.6rem;
  background: linear-gradient(135deg, var(--p-primary-color), #22d3ee);
  color: #0b0e14;
  font-weight: 800;
  font-size: 0.85rem;
}
</style>
