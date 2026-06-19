import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

const googleProvider = new GoogleAuthProvider()

export class AuthError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Некорректный адрес электронной почты.',
  'auth/user-disabled': 'Учётная запись отключена.',
  'auth/user-not-found': 'Пользователь с таким email не найден.',
  'auth/wrong-password': 'Неверный email или пароль.',
  'auth/invalid-credential': 'Неверный email или пароль.',
  'auth/email-already-in-use': 'Этот email уже зарегистрирован.',
  'auth/weak-password': 'Пароль слишком простой (минимум 6 символов).',
  'auth/too-many-requests': 'Слишком много попыток. Повторите позже.',
  'auth/popup-closed-by-user': 'Окно входа было закрыто.',
  'auth/cancelled-popup-request': 'Запрос входа отменён.',
  'auth/popup-blocked': 'Браузер заблокировал всплывающее окно входа.',
  'auth/network-request-failed': 'Ошибка сети. Проверьте подключение.',
}

function toAuthError(err: unknown): AuthError {
  const code = (err as { code?: string })?.code ?? 'auth/unknown'
  const message = ERROR_MESSAGES[code] ?? 'Не удалось выполнить операцию. Попробуйте ещё раз.'
  return new AuthError(code, message)
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  } catch (err) {
    throw toAuthError(err)
  }
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const name = displayName?.trim()
    if (name) {
      await updateProfile(cred.user, { displayName: name })
    }
    return cred.user
  } catch (err) {
    throw toAuthError(err)
  }
}

export async function loginWithGoogle(): Promise<User> {
  try {
    const cred = await signInWithPopup(auth, googleProvider)
    return cred.user
  } catch (err) {
    throw toAuthError(err)
  }
}

export async function updateDisplayName(displayName: string): Promise<User> {
  const user = auth.currentUser
  if (!user) {
    throw new AuthError('auth/no-current-user', 'Пользователь не авторизован.')
  }
  try {
    await updateProfile(user, { displayName: displayName.trim() })
    return user
  } catch (err) {
    throw toAuthError(err)
  }
}

export async function logout(): Promise<void> {
  try {
    await signOut(auth)
  } catch (err) {
    throw toAuthError(err)
  }
}
