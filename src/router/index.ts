import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
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
