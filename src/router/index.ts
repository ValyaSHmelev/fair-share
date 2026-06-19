import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'events',
    component: () => import('@/views/EventsListView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
  },
  {
    path: '/events/:id',
    component: () => import('@/views/EventDetailView.vue'),
    props: true,
    children: [
      { path: '', redirect: { name: 'event-participants' } },
      {
        path: 'participants',
        name: 'event-participants',
        component: () => import('@/views/ParticipantsTab.vue'),
        props: true,
      },
      {
        path: 'expenses',
        name: 'event-expenses',
        component: () => import('@/views/ExpensesTab.vue'),
        props: true,
      },
      {
        path: 'report',
        name: 'event-report',
        component: () => import('@/views/ReportTab.vue'),
        props: true,
      },
    ],
  },
  {
    path: '/share',
    name: 'shared-report',
    component: () => import('@/views/SharedReportView.vue'),
    meta: { public: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) {
    await auth.init()
  }

  const isPublic = to.matched.some((r) => r.meta.public)

  if (!isPublic && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (auth.isAuthenticated && (to.name === 'login' || to.name === 'register')) {
    const redirect = to.query.redirect
    return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : { name: 'events' }
  }

  return true
})
