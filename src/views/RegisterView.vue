<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import { useAuthStore } from '@/stores/auth'
import { AuthError } from '@/lib/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const email = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const googleLoading = ref(false)

const redirectTarget = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') ? r : '/'
})

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const passwordValid = computed(() => password.value.length >= 6)
const passwordsMatch = computed(() => password.value === confirm.value)
const canSubmit = computed(() => emailValid.value && passwordValid.value && passwordsMatch.value)

function notifyError(err: unknown) {
  const message = err instanceof AuthError ? err.message : 'Не удалось зарегистрироваться. Попробуйте ещё раз.'
  toast.add({ severity: 'error', summary: 'Ошибка регистрации', detail: message, life: 4000 })
}

async function submit() {
  if (loading.value) return
  if (!emailValid.value) {
    toast.add({ severity: 'warn', summary: 'Проверьте email', life: 3000 })
    return
  }
  if (!passwordValid.value) {
    toast.add({ severity: 'warn', summary: 'Пароль должен быть не короче 6 символов', life: 3000 })
    return
  }
  if (!passwordsMatch.value) {
    toast.add({ severity: 'warn', summary: 'Пароли не совпадают', life: 3000 })
    return
  }
  loading.value = true
  try {
    await auth.registerWithEmail(email.value.trim(), password.value)
    router.replace(redirectTarget.value)
  } catch (err) {
    notifyError(err)
  } finally {
    loading.value = false
  }
}

async function registerGoogle() {
  if (googleLoading.value) return
  googleLoading.value = true
  try {
    await auth.loginWithGoogle()
    router.replace(redirectTarget.value)
  } catch (err) {
    notifyError(err)
  } finally {
    googleLoading.value = false
  }
}

const loginLink = computed(() => ({
  name: 'login',
  query: route.query.redirect ? { redirect: route.query.redirect } : undefined,
}))
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand">
        <span class="brand-mark">FS</span>
        <span class="brand-name">FairShare</span>
      </div>
      <h1 class="auth-title">Регистрация</h1>
      <p class="fs-muted auth-subtitle">Создайте аккаунт, чтобы начать.</p>

      <form class="auth-form" @submit.prevent="submit">
        <div class="field">
          <label for="reg-email">Email</label>
          <InputText
            id="reg-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            fluid
          />
        </div>
        <div class="field">
          <label for="reg-password">Пароль</label>
          <Password
            inputId="reg-password"
            v-model="password"
            toggleMask
            autocomplete="new-password"
            promptLabel="Введите пароль"
            weakLabel="Слабый"
            mediumLabel="Средний"
            strongLabel="Надёжный"
            fluid
          />
        </div>
        <div class="field">
          <label for="reg-confirm">Повтор пароля</label>
          <Password
            inputId="reg-confirm"
            v-model="confirm"
            :feedback="false"
            toggleMask
            autocomplete="new-password"
            fluid
          />
          <small v-if="confirm.length > 0 && !passwordsMatch" class="field-error">
            Пароли не совпадают.
          </small>
        </div>
        <Button
          type="submit"
          label="Зарегистрироваться"
          icon="pi pi-user-plus"
          :loading="loading"
          :disabled="!canSubmit"
          fluid
        />
      </form>

      <div class="auth-divider"><span>или</span></div>

      <Button
        label="Регистрация через Google"
        icon="pi pi-google"
        severity="secondary"
        outlined
        :loading="googleLoading"
        fluid
        @click="registerGoogle"
      />

      <p class="auth-foot">
        Уже есть аккаунт?
        <RouterLink :to="loginLink">Войти</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
}
.auth-card {
  width: 100%;
  max-width: 22rem;
  padding: 1.75rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.9rem;
  background: var(--p-content-background);
}
.auth-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 1.25rem;
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
.auth-title {
  margin: 0 0 0.25rem;
  font-size: 1.4rem;
}
.auth-subtitle {
  margin: 0 0 1.25rem;
  font-size: 0.9rem;
}
.auth-form {
  display: grid;
  gap: 1rem;
  margin-bottom: 1rem;
}
.field {
  display: grid;
  gap: 0.4rem;
}
.field label {
  font-size: 0.85rem;
  font-weight: 600;
}
.field-error {
  color: var(--p-red-400, #ef4444);
  font-size: 0.8rem;
}
.auth-divider {
  position: relative;
  text-align: center;
  margin: 1rem 0;
}
.auth-divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--p-content-border-color);
}
.auth-divider span {
  position: relative;
  padding: 0 0.6rem;
  background: var(--p-content-background);
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}
.auth-foot {
  margin: 1.25rem 0 0;
  text-align: center;
  font-size: 0.9rem;
}
</style>
