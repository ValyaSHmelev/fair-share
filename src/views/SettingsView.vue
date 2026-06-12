<script setup lang="ts">
import { ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { useEventsStore } from '@/stores/events'
import { useSettingsStore, type ThemeMode } from '@/stores/settings'
import { parseImportFile } from '@/lib/io'
import { SCHEMA_VERSION, type ImportMode, type PersistedState } from '@/types/models'

const store = useEventsStore()
const settings = useSettingsStore()
const confirm = useConfirm()
const toast = useToast()

const themeOptions: { label: string; value: ThemeMode }[] = [
  { label: 'Тёмная', value: 'dark' },
  { label: 'Светлая', value: 'light' },
]

const fileInput = ref<HTMLInputElement | null>(null)
const importDialog = ref(false)
const pendingState = ref<PersistedState | null>(null)
const pendingCount = ref(0)

function exportData() {
  store.exportState()
  toast.add({ severity: 'success', summary: 'Данные выгружены', life: 2000 })
}

function triggerImport() {
  fileInput.value?.click()
}

function onFileChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const result = parseImportFile(String(reader.result))
    if (!result.ok || !result.state) {
      toast.add({ severity: 'error', summary: 'Ошибка импорта', detail: result.error, life: 4000 })
    } else {
      pendingState.value = result.state
      pendingCount.value = result.state.events.length
      importDialog.value = true
    }
    input.value = ''
  }
  reader.onerror = () => {
    toast.add({ severity: 'error', summary: 'Не удалось прочитать файл', life: 3000 })
    input.value = ''
  }
  reader.readAsText(file)
}

function doImport(mode: ImportMode) {
  if (!pendingState.value) return
  store.importState(pendingState.value, mode)
  importDialog.value = false
  pendingState.value = null
  toast.add({ severity: 'success', summary: 'Импорт завершён', life: 2000 })
}

function confirmClear() {
  confirm.require({
    header: 'Очистить все данные?',
    message: 'Все мероприятия будут безвозвратно удалены. Рекомендуем сначала сделать экспорт.',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Отмена',
    acceptLabel: 'Очистить всё',
    acceptClass: 'p-button-danger',
    accept: () => {
      confirm.require({
        header: 'Точно удалить всё?',
        message: 'Это действие нельзя отменить.',
        icon: 'pi pi-trash',
        rejectLabel: 'Отмена',
        acceptLabel: 'Да, удалить',
        acceptClass: 'p-button-danger',
        accept: () => {
          store.clearAll()
          toast.add({ severity: 'info', summary: 'Все данные удалены', life: 2500 })
        },
      })
    },
  })
}
</script>

<template>
  <div class="fs-stack settings">
    <h1 class="fs-title">Настройки</h1>

    <section class="settings-block">
      <h2 class="fs-section-title">Внешний вид</h2>
      <div class="fs-row fs-row-wrap">
        <span>Тема оформления</span>
        <div class="fs-spacer" />
        <SelectButton
          :modelValue="settings.theme"
          :options="themeOptions"
          optionLabel="label"
          optionValue="value"
          :allowEmpty="false"
          @update:modelValue="(v: ThemeMode) => v && (settings.theme = v)"
        />
      </div>
    </section>

    <section class="settings-block">
      <h2 class="fs-section-title">Данные</h2>
      <p class="fs-muted block-hint">
        Все данные хранятся локально в браузере. Делайте резервные копии через экспорт.
      </p>
      <div class="fs-row fs-row-wrap data-actions">
        <Button label="Экспортировать (JSON)" icon="pi pi-download" @click="exportData" />
        <Button
          label="Импортировать (JSON)"
          icon="pi pi-upload"
          severity="secondary"
          @click="triggerImport"
        />
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          hidden
          @change="onFileChosen"
        />
      </div>
      <p class="fs-muted count-line">Сейчас сохранено мероприятий: {{ store.events.length }}</p>
    </section>

    <section class="settings-block danger-block">
      <h2 class="fs-section-title">Опасная зона</h2>
      <Button
        label="Очистить все данные"
        icon="pi pi-trash"
        severity="danger"
        outlined
        @click="confirmClear"
      />
    </section>

    <p class="fs-muted version-line">Версия схемы данных: {{ SCHEMA_VERSION }}</p>

    <Dialog
      v-model:visible="importDialog"
      header="Импорт данных"
      modal
      :style="{ width: '30rem', maxWidth: '95vw' }"
    >
      <Message severity="info" :closable="false">
        В файле найдено мероприятий: {{ pendingCount }}. Выберите режим импорта.
      </Message>
      <div class="import-modes">
        <div class="import-mode">
          <strong>Заменить</strong>
          <p class="fs-muted">Текущие данные будут полностью заменены данными из файла.</p>
          <Button label="Заменить всё" severity="danger" outlined @click="doImport('replace')" />
        </div>
        <div class="import-mode">
          <strong>Объединить</strong>
          <p class="fs-muted">Мероприятия из файла добавятся к текущим (конфликты id решаются автоматически).</p>
          <Button label="Объединить" @click="doImport('merge')" />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="importDialog = false" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.settings {
  max-width: 640px;
}
.settings-block {
  padding: 1.1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.7rem;
  background: var(--p-content-background);
}
.block-hint {
  margin: 0 0 0.85rem;
  font-size: 0.875rem;
}
.data-actions {
  gap: 0.6rem;
}
.count-line {
  margin: 0.85rem 0 0;
  font-size: 0.85rem;
}
.danger-block {
  border-color: var(--p-red-400, #ef4444);
}
.version-line {
  font-size: 0.8rem;
  text-align: center;
}
.import-modes {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}
.import-mode {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.85rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.6rem;
}
.import-mode p {
  margin: 0;
  font-size: 0.85rem;
}
</style>
