<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import ProgressSpinner from 'primevue/progressspinner'
import { useAuthStore } from '@/stores/auth'
import { AuthError } from '@/lib/auth'
import { getUserProfile, saveUserProfile } from '@/lib/firestore'
import { createEmptyProfile, type PaymentMethod, type UserProfile } from '@/types/models'

const auth = useAuthStore()
const toast = useToast()

const methodOptions: { label: string; value: PaymentMethod }[] = [
  { label: 'СБП', value: 'sbp' },
  { label: 'Карта', value: 'card' },
]

const displayName = ref(auth.user?.displayName ?? '')
const profile = ref<UserProfile>(createEmptyProfile())
const loading = ref(true)
const saving = ref(false)

const nameValid = computed(() => displayName.value.trim().length > 0)
const isSbp = computed(() => profile.value.paymentMethod === 'sbp')

onMounted(async () => {
  const uid = auth.user?.uid
  if (!uid) {
    loading.value = false
    return
  }
  try {
    profile.value = await getUserProfile(uid)
  } catch {
    toast.add({ severity: 'error', summary: 'Не удалось загрузить профиль', life: 4000 })
  } finally {
    displayName.value = auth.user?.displayName ?? displayName.value
    loading.value = false
  }
})

async function save() {
  const uid = auth.user?.uid
  if (!uid || saving.value) return
  if (!nameValid.value) {
    toast.add({ severity: 'warn', summary: 'Укажите имя', life: 3000 })
    return
  }
  saving.value = true
  try {
    const trimmed = displayName.value.trim()
    if (trimmed !== (auth.user?.displayName ?? '')) {
      await auth.updateDisplayName(trimmed)
    }
    await saveUserProfile(uid, profile.value)
    toast.add({ severity: 'success', summary: 'Профиль сохранён', life: 2000 })
  } catch (err) {
    const message = err instanceof AuthError ? err.message : 'Не удалось сохранить профиль.'
    toast.add({ severity: 'error', summary: 'Ошибка', detail: message, life: 4000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fs-stack profile">
    <h1 class="fs-title">Профиль</h1>

    <div v-if="loading" class="profile-loading">
      <ProgressSpinner style="width: 2.5rem; height: 2.5rem" strokeWidth="4" />
    </div>

    <form v-else class="profile-form" @submit.prevent="save">
      <section class="profile-block">
        <h2 class="fs-section-title">Основное</h2>
        <div class="field">
          <label for="display-name">Отображаемое имя</label>
          <InputText
            id="display-name"
            v-model="displayName"
            placeholder="Например, Валентин Шмелёв"
            :invalid="!nameValid"
          />
          <small v-if="auth.user?.email" class="fs-muted">{{ auth.user.email }}</small>
        </div>
      </section>

      <section class="profile-block">
        <h2 class="fs-section-title">Реквизиты для перевода</h2>
        <p class="fs-muted block-hint">
          Эти данные помогут участникам перевести вам деньги по итогам мероприятия.
        </p>

        <div class="field">
          <label>Способ перевода</label>
          <SelectButton
            v-model="profile.paymentMethod"
            :options="methodOptions"
            optionLabel="label"
            optionValue="value"
            :allowEmpty="false"
          />
        </div>

        <template v-if="isSbp">
          <div class="field">
            <label for="phone">Номер телефона</label>
            <InputText id="phone" v-model="profile.phone" placeholder="+7 900 000-00-00" />
          </div>
          <div class="field">
            <label for="bank">Банк</label>
            <InputText id="bank" v-model="profile.bank" placeholder="Например, Т-Банк" />
          </div>
        </template>

        <template v-else>
          <div class="field">
            <label for="card">Номер карты</label>
            <InputText id="card" v-model="profile.cardNumber" placeholder="0000 0000 0000 0000" />
          </div>
        </template>

        <div class="field">
          <label for="recipient">Получатель</label>
          <InputText id="recipient" v-model="profile.recipient" placeholder="Например, Валентин Ш." />
          <small class="fs-muted">Как имя получателя высвечивается в приложении банка.</small>
        </div>
      </section>

      <div class="profile-actions">
        <Button
          type="submit"
          label="Сохранить"
          icon="pi pi-check"
          :loading="saving"
          :disabled="!nameValid"
        />
      </div>
    </form>
  </div>
</template>

<style scoped>
.profile {
  max-width: 640px;
}
.profile-loading {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}
.profile-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.profile-block {
  padding: 1.1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.7rem;
  background: var(--p-content-background);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.block-hint {
  margin: -0.4rem 0 0;
  font-size: 0.875rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.field label {
  font-size: 0.85rem;
  font-weight: 600;
}
.field :deep(.p-inputtext) {
  width: 100%;
}
.profile-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
