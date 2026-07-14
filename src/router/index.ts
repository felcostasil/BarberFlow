import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { nextTick } from 'vue';
import { auth, onAuthStateChanged } from '../services/firebase';
import { i18n, loadLocaleMessages, setI18nLanguage, getInitialLocale } from '../i18n';

// Helper to wait for Auth initialization
const getCurrentUser = (): Promise<any> => {
  return new Promise((resolve) => {
    let unsubscribe: () => void;
    let isSync = true;
    unsubscribe = onAuthStateChanged(auth, (user) => {
      resolve(user);
      if (!isSync) {
        if (unsubscribe) unsubscribe();
      } else {
        queueMicrotask(() => {
          if (unsubscribe) unsubscribe();
        });
      }
    });
    isSync = false;
  });
};

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'ClientHome',
    component: () => import('../views/ClientHome.vue')
  },
  {
    path: '/wait/:clientId',
    name: 'ClientWait',
    component: () => import('../views/ClientWait.vue'),
    props: true
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/Admin.vue'),
    meta: { requiresAuth: true }
  },
  // Fallback redirect
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Guard router transitions
router.beforeEach(async (to, _from, next) => {
  // Determine current locale and dynamically load JSON translation chunk
  const locale = getInitialLocale();
  await loadLocaleMessages(i18n, locale);
  setI18nLanguage(i18n, locale);
  // Let Vue's reactivity flush the new messages before rendering
  await nextTick();

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  
  if (requiresAuth) {
    const currentUser = await getCurrentUser();
    
    // If not logged in, or is logged in as an anonymous user (client), send to login
    if (!currentUser || currentUser.isAnonymous) {
      next({ name: 'Login' });
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;
