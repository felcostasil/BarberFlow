<template>
  <div class="client-check-in glass-panel">
    <div class="form-header">
      <h2>{{ t('checkin.title') }}</h2>
      <p>{{ t('checkin.desc') }}</p>
    </div>

    <form @submit.prevent="handleSubmit" class="check-in-form">
      <!-- Client Name -->
      <div class="form-group">
        <label for="customerName">{{ t('checkin.nameLabel') }}</label>
        <input 
          id="customerName"
          v-model="customerName"
          type="text" 
          :placeholder="t('checkin.namePlaceholder')" 
          class="form-input"
          required
          :disabled="submitting || !isAllowed"
        />
      </div>

      <!-- Barber Selection / Live Queues -->
      <div class="form-group">
        <label>{{ t('checkin.barberLabel') }}</label>
        <p class="section-hint">{{ t('checkin.barberDesc') }}</p>
        
        <!-- Live status list -->
        <div class="barbers-list">
          <!-- Option: First Available (Global Pool) -->
          <label class="barber-card-wrap">
            <input 
              type="checkbox" 
              :checked="isFirstAvailable" 
              @change="selectFirstAvailable"
              class="hidden-checkbox"
              :disabled="submitting || !isAllowed"
            />
            <div class="barber-card" :class="{ 'card-selected': isFirstAvailable }">
              <div class="barber-info">
                <span class="avatar bg-accent-blue"><Users :size="20" /></span>
                <div class="barber-meta">
                  <span class="barber-name">{{ t('checkin.firstAvailable') }}</span>
                  <span class="barber-sub">{{ t('checkin.firstAvailableDesc') }}</span>
                </div>
              </div>
              <div class="barber-stats">
                <span class="wait-badge badge badge-blue">
                  ~{{ globalWaitTime }} {{ t('common.minutes') }}
                </span>
                <span class="queue-length">{{ globalQueueCount }} {{ t('checkin.inLine') }}</span>
              </div>
            </div>
          </label>

          <!-- Individual Barbers -->
          <label 
            v-for="barber in activeBarbers" 
            :key="barber.id" 
            class="barber-card-wrap"
          >
            <input 
              type="checkbox" 
              :value="barber.id" 
              v-model="selectedBarberIds" 
              @change="handleBarberChange"
              class="hidden-checkbox"
              :disabled="submitting || !isAllowed"
            />
            <div class="barber-card" :class="{ 'card-selected': selectedBarberIds.includes(barber.id) && !isFirstAvailable }">
              <div class="barber-info">
                <span class="avatar bg-accent-gold"><User :size="20" /></span>
                <div class="barber-meta">
                  <span class="barber-name">{{ barber.name }}</span>
                  <span class="barber-sub" :class="barber.status === 'active' ? 'color-emerald' : 'color-muted'">
                    {{ barber.status === 'active' ? t('admin.statusAvailable') : t('admin.statusAway') }}
                  </span>
                </div>
              </div>
              <div class="barber-stats">
                <span class="wait-badge badge badge-gold">
                  ~{{ getBarberWaitTime(barber.id) }} {{ t('common.minutes') }}
                </span>
                <span class="queue-length">{{ getBarberQueueCount(barber.id) }} {{ t('checkin.inLine') }}</span>
              </div>
            </div>
          </label>
        </div>
      </div>

      <div class="form-actions">
        <button 
          type="submit" 
          class="btn btn-primary btn-full btn-lg" 
          :disabled="submitting || !isAllowed || !customerName.trim()"
        >
          <span v-if="submitting">{{ t('checkin.submitting') }}</span>
          <span v-else>{{ t('checkin.confirmButton') }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { User, Users } from '@lucide/vue';
import { 
  db, 
  auth,
  signInAnonymously, 
  collection, 
  onSnapshot, 
  setDoc,
  doc,
  query, 
  where
} from '../services/firebase';

const props = defineProps<{
  isAllowed: boolean;
}>();

const router = useRouter();
const { t } = useI18n();

const customerName = ref('');
const selectedBarberIds = ref<string[]>([]);
const isFirstAvailable = ref(true); // Default to first available
const submitting = ref(false);

import type { Barber, QueueItem } from '../types/index';

const activeBarbers = ref<Barber[]>([]);
const activeQueue = ref<QueueItem[]>([]);

let unsubscribeBarbers: () => void = () => {};
let unsubscribeQueue: () => void = () => {};



// Filter only active barbers
const barbersQuery = query(collection(db, 'barbers'), where('status', '==', 'active'));
const queueQuery = query(collection(db, 'queue'), where('status', 'in', ['waiting', 'serving']));

onMounted(() => {
  unsubscribeBarbers = onSnapshot(barbersQuery, (snapshot: any) => {
    const list: Barber[] = [];
    snapshot.docs.forEach((doc: any) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    activeBarbers.value = list;
  });

  unsubscribeQueue = onSnapshot(queueQuery, (snapshot: any) => {
    const list: QueueItem[] = [];
    snapshot.docs.forEach((doc: any) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    activeQueue.value = list;
  });
});

onUnmounted(() => {
  unsubscribeBarbers();
  unsubscribeQueue();
});

// Calculate queue lengths
const getBarberQueueCount = (barberId: string): number => {
  return activeQueue.value.filter(item => 
    item.status === 'waiting' && 
    (item.preferred_barbers.includes(barberId) || item.preferred_barbers.length === 0)
  ).length;
};

const getBarberWaitTime = (barberId: string): number => {
  const barber = activeBarbers.value.find(b => b.id === barberId);
  const avgTime = barber?.average_service_time ?? 20;
  return getBarberQueueCount(barberId) * avgTime;
};

// Global pool stats
const globalQueueCount = computed(() => {
  return activeQueue.value.filter(item => item.status === 'waiting').length;
});

const globalWaitTime = computed(() => {
  const active = activeBarbers.value;
  const activeCount = active.length || 1;
  const totalAvgTime = active.reduce((sum, b) => sum + (b.average_service_time ?? 20), 0);
  const avgTime = active.length > 0 ? (totalAvgTime / active.length) : 20;

  return Math.round((globalQueueCount.value * avgTime) / activeCount);
});

// Selection handlers
const selectFirstAvailable = (e: Event) => {
  const target = e.target as HTMLInputElement;
  isFirstAvailable.value = target.checked;
  if (target.checked) {
    selectedBarberIds.value = [];
  }
};

const handleBarberChange = () => {
  if (selectedBarberIds.value.length > 0) {
    isFirstAvailable.value = false;
  } else {
    isFirstAvailable.value = true;
  }
};

// Submit form
const handleSubmit = async () => {
  if (!customerName.value.trim() || !props.isAllowed) return;

  submitting.value = true;
  try {
    // Authenticate client anonymously
    const { user } = await signInAnonymously(auth);
    
    // Create queue ticket using user.uid as the document ID
    // so the clientId in the URL matches the Firestore document path
    const ticketData = {
      customer_name: customerName.value.trim(),
      preferred_barbers: isFirstAvailable.value ? [] : [...selectedBarberIds.value],
      status: 'waiting',
      created_at: Date.now()
    };

    await setDoc(doc(db, 'queue', user.uid), ticketData);
    
    // Redirect to waiting room
    router.push({ name: 'ClientWait', params: { clientId: user.uid } });
  } catch (err) {
    console.error('Error joining queue:', err);
    alert('Failed to join the queue. Please try again.');
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.client-check-in {
  padding: 30px;
}

.form-header {
  margin-bottom: 24px;
}

.form-header h2 {
  font-size: 1.5rem;
  margin-bottom: 6px;
  background: linear-gradient(135deg, var(--text-primary) 30%, var(--accent-gold));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.form-header p {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.check-in-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: -4px;
}

.barbers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.barber-card-wrap {
  cursor: pointer;
  width: 100%;
}

.hidden-checkbox {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.barber-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--panel-border);
  transition: all 0.2s ease;
}

.barber-card-wrap:hover .barber-card {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  transform: translateX(2px);
}

.card-selected {
  border-color: var(--accent-gold) !important;
  background: rgba(234, 179, 8, 0.05) !important;
}

.barber-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bg-accent-gold {
  background: var(--accent-gold-glow);
  color: var(--accent-gold);
  border: 1px solid rgba(234, 179, 8, 0.2);
}

.bg-accent-blue {
  background: var(--accent-blue-glow);
  color: var(--accent-blue);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.barber-meta {
  display: flex;
  flex-direction: column;
}

.barber-name {
  font-size: 0.95rem;
  font-weight: 600;
}

.barber-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.color-emerald {
  color: var(--accent-emerald) !important;
}

.color-muted {
  color: var(--text-muted) !important;
}

.barber-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.wait-badge {
  font-size: 0.7rem;
}

.queue-length {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.btn-lg {
  padding: 14px 28px;
  font-size: 1rem;
}

@media (max-width: 480px) {
  .barber-card {
    padding: 14px 12px;
  }

  .barber-name {
    font-size: 0.88rem;
  }

  .wait-badge {
    font-size: 0.72rem;
  }

  .queue-length {
    font-size: 0.72rem;
  }

  .barber-stats {
    gap: 3px;
  }

  .btn-lg {
    padding: 13px 20px;
    font-size: 0.95rem;
  }
}

</style>
