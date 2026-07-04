<template>
  <div class="login-view main-content">
    <div class="login-container glass-panel">
      <div class="login-header">
        <div class="lock-wrap"><Lock :size="24" /></div>
        <h2>{{ t('login.title') }}</h2>
        <p>{{ t('login.desc') }}</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="email">{{ t('login.emailLabel') }}</label>
          <input 
            id="email"
            v-model="email"
            type="email" 
            placeholder="marcos@barber.com" 
            class="form-input" 
            required 
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="password">{{ t('login.passwordLabel') }}</label>
          <input 
            id="password"
            v-model="password"
            type="password" 
            placeholder="••••••••" 
            class="form-input" 
            required 
            :disabled="loading"
          />
        </div>

        <div class="error-banner" v-if="error">
          <AlertCircle :size="16" />
          <span>{{ error }}</span>
        </div>

        <button type="submit" class="btn btn-primary btn-full" :disabled="loading">
          <RefreshCw class="spin" :size="16" v-if="loading" />
          <span v-else>{{ t('login.signIn') }}</span>
        </button>
      </form>

      <!-- Preseeded credentials panel for Demo Mode -->
      <div v-if="isDemoMode" class="demo-credentials-box">
        <div class="d-header">
          <span class="d-badge">{{ t('login.demoTitle') }}</span>
        </div>
        <p>{{ t('login.demoDesc') }}</p>
        <ul>
          <li><strong>Email:</strong> marcos@barber.com</li>
          <li><strong>Email:</strong> thiago@barber.com</li>
          <li><strong>Email:</strong> felipe@barber.com</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Lock, AlertCircle, RefreshCw } from '@lucide/vue';
import { auth, signInWithEmailAndPassword, isDemoMode } from '../services/firebase';

const router = useRouter();
const { t } = useI18n();

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

const handleLogin = async () => {
  loading.value = true;
  error.value = null;

  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
    router.push('/admin');
  } catch (err: any) {
    console.error('Login error:', err);
    if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
      error.value = t('login.wrongPassword');
    } else {
      error.value = t('login.authFailed');
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-view {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.login-container {
  width: 100%;
  max-width: 420px;
  padding: 40px 30px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.login-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.lock-wrap {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--accent-gold-glow);
  color: var(--accent-gold);
  border: 1px solid rgba(234, 179, 8, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.login-header h2 {
  font-size: 1.5rem;
}

.login-header p {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(244, 63, 94, 0.08);
  border: 1px solid rgba(244, 63, 94, 0.2);
  border-radius: var(--radius-sm);
  color: var(--accent-rose);
  font-size: 0.82rem;
}

.demo-credentials-box {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  padding: 16px;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.d-header {
  margin-bottom: 8px;
}

.d-badge {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.25);
  color: #60a5fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.demo-credentials-box ul {
  margin-top: 8px;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
