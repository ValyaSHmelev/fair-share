import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Unsubscribe } from 'firebase/firestore'
import type { Friend, ID } from '@/types/models'
import { subscribeFriends, saveFriendDoc, deleteFriendDoc } from '@/lib/firestore'
import { newId } from '@/lib/io'

export const useFriendsStore = defineStore('friends', () => {
  const friends = ref<Friend[]>([])
  const lastError = ref<string | null>(null)
  // Загружен ли список друзей текущего пользователя (получен первый снапшот).
  const ready = ref<boolean>(false)

  let boundUid: string | null = null
  let unsubscribe: Unsubscribe | null = null

  function nowIso(): string {
    return new Date().toISOString()
  }

  /** Подписывается на друзей пользователя. Вызывается при входе (из main.ts). */
  function bindUser(uid: string): void {
    if (boundUid === uid) return
    unbind()
    boundUid = uid
    ready.value = false
    unsubscribe = subscribeFriends(
      uid,
      (list) => {
        friends.value = list
        ready.value = true
        lastError.value = null
      },
      (err) => {
        console.error('Не удалось загрузить друзей из Firestore:', err)
        lastError.value = 'Не удалось загрузить список друзей.'
        ready.value = true
      },
    )
  }

  /** Отписывается и очищает локальное состояние. Вызывается при выходе. */
  function unbind(): void {
    unsubscribe?.()
    unsubscribe = null
    boundUid = null
    friends.value = []
    ready.value = false
    lastError.value = null
  }

  /** Записывает документ друга в Firestore (fire-and-forget с обработкой ошибок). */
  function persistFriend(friend: Friend): void {
    if (!boundUid) return
    saveFriendDoc(boundUid, friend).catch((err) => {
      console.error('Не удалось сохранить друга в Firestore:', err)
      lastError.value = 'Не удалось сохранить данные в облаке.'
    })
  }

  function getFriendById(id: ID): Friend | undefined {
    return friends.value.find((f) => f.id === id)
  }

  function addFriend(payload: {
    name: string
    sbpPhone?: string
    bank?: string
    recipient?: string
  }): Friend | undefined {
    const name = payload.name.trim()
    if (!name) return undefined
    const friend: Friend = {
      id: newId(),
      name,
      sbpPhone: (payload.sbpPhone ?? '').trim(),
      bank: (payload.bank ?? '').trim(),
      recipient: (payload.recipient ?? '').trim(),
      createdAt: nowIso(),
    }
    friends.value.push(friend)
    persistFriend(friend)
    return friend
  }

  function updateFriend(
    id: ID,
    patch: Partial<Pick<Friend, 'name' | 'sbpPhone' | 'bank' | 'recipient'>>,
  ): void {
    const friend = getFriendById(id)
    if (!friend) return
    if (patch.name !== undefined) friend.name = patch.name.trim()
    if (patch.sbpPhone !== undefined) friend.sbpPhone = patch.sbpPhone.trim()
    if (patch.bank !== undefined) friend.bank = patch.bank.trim()
    if (patch.recipient !== undefined) friend.recipient = patch.recipient.trim()
    persistFriend(friend)
  }

  function removeFriend(id: ID): void {
    const idx = friends.value.findIndex((f) => f.id === id)
    if (idx < 0) return
    friends.value.splice(idx, 1)
    if (boundUid) {
      deleteFriendDoc(boundUid, id).catch((err) => {
        console.error('Не удалось удалить друга в Firestore:', err)
        lastError.value = 'Не удалось удалить данные в облаке.'
      })
    }
  }

  return {
    friends,
    lastError,
    ready,
    bindUser,
    unbind,
    getFriendById,
    addFriend,
    updateFriend,
    removeFriend,
  }
})
