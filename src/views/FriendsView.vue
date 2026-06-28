<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ProgressSpinner from 'primevue/progressspinner'
import EmptyState from '@/components/EmptyState.vue'
import { useFriendsStore } from '@/stores/friends'
import { POPULAR_BANKS, type Friend } from '@/types/models'

const store = useFriendsStore()
const confirm = useConfirm()
const toast = useToast()

const bankOptions = POPULAR_BANKS.map((b) => ({ label: b, value: b }))

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<{ name: string; sbpPhone: string; bank: string; recipient: string }>({
  name: '',
  sbpPhone: '',
  bank: '',
  recipient: '',
})

function openCreate() {
  editingId.value = null
  form.name = ''
  form.sbpPhone = ''
  form.bank = ''
  form.recipient = ''
  dialogVisible.value = true
}

function openEdit(f: Friend) {
  editingId.value = f.id
  form.name = f.name
  form.sbpPhone = f.sbpPhone
  form.bank = f.bank
  form.recipient = f.recipient
  dialogVisible.value = true
}

function submit() {
  const name = form.name.trim()
  if (!name) {
    toast.add({ severity: 'warn', summary: 'Введите имя друга', life: 2500 })
    return
  }
  const payload = {
    name,
    sbpPhone: form.sbpPhone.trim(),
    bank: form.bank.trim(),
    recipient: form.recipient.trim(),
  }
  if (editingId.value) {
    store.updateFriend(editingId.value, payload)
  } else {
    store.addFriend(payload)
  }
  dialogVisible.value = false
}

function removeFriend(f: Friend) {
  confirm.require({
    header: 'Удалить друга?',
    message: `«${f.name}» будет удалён из списка друзей. На уже созданные мероприятия это не повлияет.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Отмена',
    acceptLabel: 'Удалить',
    acceptClass: 'p-button-danger',
    accept: () => {
      store.removeFriend(f.id)
      toast.add({ severity: 'info', summary: 'Друг удалён', life: 2000 })
    },
  })
}
</script>

<template>
  <div class="fs-stack">
    <div class="fs-row fs-row-wrap">
      <h1 class="fs-title" style="margin: 0">Друзья</h1>
      <div class="fs-spacer" />
      <Button label="Добавить друга" icon="pi pi-plus" @click="openCreate" />
    </div>

    <p class="fs-muted block-hint">
      Сохраните друзей с реквизитами один раз — и быстро добавляйте их в любое мероприятие
      кнопкой «Выбрать из друзей». Список доступен только вам.
    </p>

    <div v-if="!store.ready" class="friends-loading">
      <ProgressSpinner style="width: 2.5rem; height: 2.5rem" strokeWidth="4" />
    </div>

    <template v-else>
      <EmptyState
        v-if="!store.friends.length"
        icon="pi-users"
        title="Список друзей пуст"
        description="Добавьте друзей, чтобы не вводить их данные заново в каждом мероприятии."
      >
        <Button label="Добавить друга" icon="pi pi-plus" @click="openCreate" />
      </EmptyState>

      <ul v-else class="list">
        <li v-for="f in store.friends" :key="f.id" class="list-item">
          <div class="item-main">
            <span class="item-name">{{ f.name }}</span>
            <div v-if="f.sbpPhone || f.bank || f.recipient" class="item-payment fs-muted">
              <span v-if="f.sbpPhone"><i class="pi pi-phone" /> {{ f.sbpPhone }}</span>
              <span v-if="f.bank"><i class="pi pi-building" /> {{ f.bank }}</span>
              <span v-if="f.recipient"><i class="pi pi-user" /> {{ f.recipient }}</span>
            </div>
          </div>
          <div class="fs-spacer" />
          <Button
            icon="pi pi-pencil"
            text
            rounded
            severity="secondary"
            v-tooltip.bottom="'Редактировать'"
            @click="openEdit(f)"
          />
          <Button
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            v-tooltip.bottom="'Удалить'"
            @click="removeFriend(f)"
          />
        </li>
      </ul>
    </template>

    <Dialog
      v-model:visible="dialogVisible"
      :header="editingId ? 'Редактировать друга' : 'Новый друг'"
      modal
      :style="{ width: '32rem', maxWidth: '95vw' }"
    >
      <div class="fs-stack dialog-form">
        <div class="field">
          <label for="f-name">Имя <span class="req">*</span></label>
          <InputText
            id="f-name"
            v-model="form.name"
            placeholder="Например, Валентин"
            autofocus
            fluid
            @keyup.enter="submit"
          />
        </div>
        <div class="field">
          <label for="f-phone">Номер для перевода по СБП</label>
          <InputText id="f-phone" v-model="form.sbpPhone" placeholder="+7 900 000-00-00" fluid />
        </div>
        <div class="field">
          <label for="f-bank">Банк</label>
          <Select
            id="f-bank"
            v-model="form.bank"
            :options="bankOptions"
            optionLabel="label"
            optionValue="value"
            editable
            placeholder="Выберите банк"
            fluid
          />
        </div>
        <div class="field">
          <label for="f-recipient">Получатель</label>
          <InputText id="f-recipient" v-model="form.recipient" placeholder="Например, Валентин Ш." fluid />
          <small class="fs-muted">Как имя получателя высвечивается в приложении банка.</small>
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="dialogVisible = false" />
        <Button :label="editingId ? 'Сохранить' : 'Добавить'" icon="pi pi-check" @click="submit" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.block-hint {
  margin: 0;
  font-size: 0.875rem;
}
.friends-loading {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
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
.item-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.item-name {
  font-weight: 600;
}
.item-payment {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.85rem;
  font-size: 0.85rem;
}
.item-payment i {
  margin-right: 0.25rem;
}
.dialog-form .field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.dialog-form label {
  font-size: 0.85rem;
  font-weight: 600;
}
.req {
  color: var(--p-red-400, #ef4444);
}
</style>
