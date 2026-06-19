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
const loading = ref(false)
const googleLoading = ref(false)

const redirectTarget = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') ? r : '/'
})

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const canSubmit = computed(() => emailValid.value && password.value.length > 0)

function notifyError(err: unknown) {
  const message = err instanceof AuthError ? err.message : 'Не удалось войти. Попробуйте ещё раз.'
  toast.add({ severity: 'error', summary: 'Ошибка входа', detail: message, life: 4000 })
}

async function submit() {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  try {
    await auth.loginWithEmail(email.value.trim(), password.value)
    router.replace(redirectTarget.value)
  } catch (err) {
    notifyError(err)
  } finally {
    loading.value = false
  }
}

async function loginGoogle() {
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

const registerLink = computed(() => ({
  name: 'register',
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
      <h1 class="auth-title">Вход</h1>
      <p class="fs-muted auth-subtitle">Войдите, чтобы продолжить работу.</p>

      <form class="auth-form" @submit.prevent="submit">
        <div class="field">
          <label for="login-email">Email</label>
          <InputText
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            fluid
          />
        </div>
        <div class="field">
          <label for="login-password">Пароль</label>
          <Password
            inputId="login-password"
            v-model="password"
            :feedback="false"
            toggleMask
            autocomplete="current-password"
            fluid
          />
        </div>
        <Button
          type="submit"
          label="Войти"
          icon="pi pi-sign-in"
          :loading="loading"
          :disabled="!canSubmit"
          fluid
        />
      </form>

      <div class="auth-divider"><span>или</span></div>

      <Button
        label="Войти через Google"
        icon="pi pi-google"
        severity="secondary"
        outlined
        :loading="googleLoading"
        fluid
        @click="loginGoogle"
      />

      <p class="auth-foot">
        Нет аккаунта?
        <RouterLink :to="registerLink">Зарегистрироваться</RouterLink>
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
