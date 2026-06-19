import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'

import App from './App.vue'
import { router } from './router'
import { registerSW } from 'virtual:pwa-register'
import { useAuthStore } from '@/stores/auth'
import { useEventsStore } from '@/stores/events'

import 'primeicons/primeicons.css'
import './assets/styles/main.css'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

// Привязываем облачные данные мероприятий к текущему пользователю.
const authStore = useAuthStore(pinia)
const eventsStore = useEventsStore(pinia)
authStore.init()
watch(
  () => authStore.user,
  (user) => {
    if (user) eventsStore.bindUser(user.uid)
    else eventsStore.unbind()
  },
  { immediate: true },
)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.fs-dark',
      cssLayer: false,
    },
  },
  locale: {
    dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
    dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    dayNamesMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    monthNames: [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
    ],
    monthNamesShort: [
      'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
      'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
    ],
    today: 'Сегодня',
    clear: 'Очистить',
    firstDayOfWeek: 1,
  },
})
app.use(ToastService)
app.use(ConfirmationService)
app.directive('tooltip', Tooltip)

app.mount('#app')

registerSW({ immediate: true })
