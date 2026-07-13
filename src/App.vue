<template>
  <div id="app">
    <!-- Demo Mode Action Banner -->
    <div v-if="isDemo" class="demo-banner">
      <div class="banner-badge">{{ t('common.demoMode') }}</div>
      <div class="banner-controls">
        <label>
          {{ t('geofence.simulatorTitle') }}:
          <select v-model="simulatedInside" @change="handleLocationChange">
            <option :value="true">{{ t('geofence.insideButton') }}</option>
            <option :value="false">{{ t('geofence.outsideButton') }}</option>
          </select>
        </label>
        
        <button v-if="!isLoggedIn" @click="quickAdminLogin" class="btn-quick-admin">
          ⚡ {{ t('login.signIn') }}
        </button>
        <span v-else class="admin-logged-in-label">
          {{ t('admin.welcomeBarber', { name: loggedInBarberName }) }}
        </span>
      </div>
    </div>

    <!-- Global App Header -->
    <header class="app-header glass-panel">
      <div class="logo-container" @click="goToHome">
        <img src="/pwa-192x192.png" alt="BarberFlow Logo" class="logo-img" />
        <span class="app-title">BarberFlow</span>
      </div>

      <nav class="app-nav">
        <!-- Language Selector -->
        <div class="lang-selector-nav">
          <select v-model="currentLanguage" @change="changeLang" class="lang-select-nav-item">
            <option value="en">EN</option>
            <option value="pt">PT</option>
          </select>
        </div>

        <!-- Show Join Queue link for clients, and Admin panel link for barbers -->
        <router-link to="/" class="nav-link" v-if="$route.path !== '/'">
          {{ t('common.joinQueue') }}
        </router-link>
        <router-link to="/login" class="nav-link" v-if="!isLoggedIn && $route.path !== '/login' && $route.path !== '/admin'">
          {{ t('common.staffLogin') }}
        </router-link>
        <router-link to="/admin" class="nav-link link-admin-nav" v-if="isLoggedIn && $route.path !== '/admin'">
          {{ t('common.adminPanel') }}
        </router-link>
      </nav>
    </header>

    <!-- Main Content Transition View -->
    <main class="app-body">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { setI18nLanguage, loadLocaleMessages, getInitialLocale, i18n } from './i18n';
import { 
  isDemoMode, 
  demoLocationState, 
  toggleDemoLocation,
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from './services/firebase';

const router = useRouter();
const { t, locale } = useI18n();

const isDemo = ref(isDemoMode);
const simulatedInside = ref(demoLocationState.isSimulatingInside);
const isLoggedIn = ref(false);
const loggedInBarberName = ref('');
const currentLanguage = ref(getInitialLocale());

let unsubscribeAuth: () => void = () => {};

// Watch active locale from i18n state to keep switcher in sync
watch(locale, (newVal) => {
  currentLanguage.value = newVal;
});

onMounted(() => {
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    isLoggedIn.value = !!user && !user.isAnonymous;
    loggedInBarberName.value = user?.displayName || 'Barber';
  });
});

onUnmounted(() => {
  unsubscribeAuth();
});

const changeLang = async () => {
  // Bug 1 fix: always load messages before activating a new locale
  await loadLocaleMessages(i18n, currentLanguage.value);
  setI18nLanguage(i18n, currentLanguage.value);
};

const handleLocationChange = () => {
  toggleDemoLocation(simulatedInside.value);
  // Reload current route component to trigger location checks
  router.go(0);
};

const quickAdminLogin = async () => {
  try {
    await signInWithEmailAndPassword(auth, 'marcos@barber.com', 'password123');
    router.push('/admin');
  } catch (err) {
    console.error('Quick login failed:', err);
  }
};

const goToHome = () => {
  router.push('/');
};
</script>

<style>
/* CSS Reset modifications for layout */
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Banner custom styling */
.banner-badge {
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.4);
  color: #fef08a;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.banner-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.banner-controls label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: #fed7aa;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-quick-admin {
  background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
  color: white !important;
  border: none !important;
  font-weight: 600 !important;
  padding: 4px 10px !important;
  border-radius: 4px !important;
  cursor: pointer;
  font-size: 0.78rem !important;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-quick-admin:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.admin-logged-in-label {
  font-size: 0.8rem;
  color: var(--accent-emerald);
  font-weight: 600;
}

/* Header customization */
.app-header {
  border-radius: 0 0 var(--radius-md) var(--radius-md) !important;
  margin: 0 auto;
  width: 100%;
  max-width: 1200px;
  border-top: none !important;
}

.app-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  transition: color 0.2s;
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--text-primary);
}

.link-admin-nav {
  color: var(--accent-gold);
  border-bottom: 2px solid var(--accent-gold);
  padding-bottom: 2px;
}

.router-link-active:not(.logo-container):not(.link-admin-nav) {
  color: var(--text-primary);
}

/* Language selector */
.lang-select-nav-item {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--panel-border);
  color: var(--text-primary);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-select-nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.lang-select-nav-item option {
  background-color: var(--bg-dark);
  color: var(--text-primary);
}

/* Mobile header layout */
@media (max-width: 480px) {
  .app-nav {
    gap: 10px;
  }

  .nav-link {
    font-size: 0.82rem;
  }
}

</style>
