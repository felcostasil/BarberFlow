<template>
  <div class="admin-view main-content">
    <div class="admin-dashboard-header">
      <div class="dashboard-title-section">
        <h1>{{ t('admin.operations') }}</h1>
        <p>{{ t('admin.tagline') }}</p>
      </div>

      <div class="header-actions">
        <!-- Tab Switchers -->
        <div class="tabs-navigation glass-panel">
          <button 
            @click="activeTab = 'queue'"
            :class="['tab-btn', activeTab === 'queue' ? 'active-tab' : '']"
          >
            <Users :size="16" />
            {{ t('admin.tabQueue') }}
          </button>
          <button 
            @click="activeTab = 'settings'"
            :class="['tab-btn', activeTab === 'settings' ? 'active-tab' : '']"
          >
            <Settings :size="16" />
            {{ t('admin.tabSettings') }}
          </button>
        </div>

        <!-- Log Out -->
        <button @click="handleLogout" class="btn btn-secondary logout-btn">
          <LogOut :size="16" />
          {{ t('common.logout') }}
        </button>
      </div>
    </div>

    <!-- Active View -->
    <div class="dashboard-body">
      <transition name="fade" mode="out-in">
        <component :is="activeComponent" />
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Users, Settings, LogOut } from '@lucide/vue';
import AdminQueue from '../components/AdminQueue.vue';
import AdminSettings from '../components/AdminSettings.vue';
import { auth, signOut } from '../services/firebase';

const router = useRouter();
const { t } = useI18n();

const activeTab = ref<'queue' | 'settings'>('queue');

const activeComponent = computed(() => {
  return activeTab.value === 'queue' ? AdminQueue : AdminSettings;
});

const handleLogout = async () => {
  if (!confirm(t('admin.logoutConfirm'))) return;
  
  try {
    await signOut(auth);
    router.push('/login');
  } catch (err) {
    console.error('Logout failed:', err);
    alert(t('admin.logoutFailed'));
  }
};
</script>

<style scoped>
.admin-view {
  max-width: 1200px !important;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.admin-dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  flex-wrap: wrap;
}

.dashboard-title-section h1 {
  font-size: 1.8rem;
  background: linear-gradient(135deg, var(--text-primary) 40%, var(--accent-gold));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.dashboard-title-section p {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tabs-navigation {
  display: flex;
  padding: 4px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 768px) {
  .admin-dashboard-header {
    gap: 16px;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .dashboard-title-section h1 {
    font-size: 1.5rem;
  }
}

@media (max-width: 480px) {
  .dashboard-title-section h1 {
    font-size: 1.3rem;
  }

  .header-actions {
    gap: 8px;
  }

  .logout-btn {
    padding: 6px 12px !important;
    font-size: 0.8rem !important;
  }
}


.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.active-tab {
  background: rgba(255, 255, 255, 0.08);
  color: var(--accent-gold) !important;
  box-shadow: var(--shadow-sm);
}

.logout-btn {
  padding: 8px 16px;
  font-size: 0.85rem;
}

.dashboard-body {
  margin-top: 8px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
