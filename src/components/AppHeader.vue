<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import { useToast } from 'primevue/usetoast'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'

const settings = useSettingsStore()
const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

function goSettings() {
  router.push({ name: 'settings' })
}

const userMenu = ref<InstanceType<typeof Menu> | null>(null)
const userMenuItems = ref<MenuItem[]>([
  {
    label: 'Выйти',
    icon: 'pi pi-sign-out',
    command: () => void handleLogout(),
  },
])

function toggleUserMenu(event: Event) {
  userMenu.value?.toggle(event)
}

async function handleLogout() {
  try {
    await auth.logout()
    router.replace({ name: 'login' })
  } catch {
    toast.add({ severity: 'error', summary: 'Не удалось выйти', life: 3000 })
  }
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
      <template v-if="auth.isAuthenticated">
        <Button
          class="user-button"
          icon="pi pi-user"
          severity="secondary"
          text
          rounded
          :aria-label="auth.displayName || 'Пользователь'"
          v-tooltip.bottom="auth.displayName"
          @click="toggleUserMenu"
        />
        <Menu ref="userMenu" :model="userMenuItems" :popup="true">
          <template #start>
            <div v-if="auth.displayName" class="user-menu-head">
              <span class="user-menu-name">{{ auth.displayName }}</span>
            </div>
          </template>
        </Menu>
      </template>
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

.user-menu-head {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--p-content-border-color);
  max-width: 16rem;
}

.user-menu-name {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
