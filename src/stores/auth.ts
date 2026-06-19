import { defineStore } from 'pinia'
import { computed, ref, triggerRef } from 'vue'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import * as authApi from '@/lib/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(auth.currentUser)
  const ready = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const displayName = computed(() => user.value?.displayName || user.value?.email || '')

  let readyResolve: (() => void) | null = null
  const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve
  })
  let initialized = false

  function init(): Promise<void> {
    if (initialized) return readyPromise
    initialized = true
    onAuthStateChanged(auth, (u) => {
      user.value = u
      if (!ready.value) {
        ready.value = true
        readyResolve?.()
      }
    })
    return readyPromise
  }

  async function loginWithEmail(email: string, password: string): Promise<void> {
    user.value = await authApi.loginWithEmail(email, password)
  }

  async function registerWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<void> {
    user.value = await authApi.registerWithEmail(email, password, displayName)
    triggerRef(user)
  }

  async function loginWithGoogle(): Promise<void> {
    user.value = await authApi.loginWithGoogle()
  }

  async function updateDisplayName(name: string): Promise<void> {
    user.value = await authApi.updateDisplayName(name)
    triggerRef(user)
  }

  async function logout(): Promise<void> {
    await authApi.logout()
    user.value = null
  }

  return {
    user,
    ready,
    isAuthenticated,
    displayName,
    init,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    updateDisplayName,
    logout,
  }
})
