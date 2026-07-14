<template>
  <div class="active-wait-screen">
    <div v-if="loading" class="loading-state glass-panel">
      <RefreshCw class="spin color-gold" :size="36" />
      <p>{{ t('waitScreen.loading') }}</p>
    </div>

    <div v-else-if="!ticket" class="error-state glass-panel">
      <AlertTriangle class="color-rose" :size="48" />
      <h2>{{ t('waitScreen.notFoundTitle') }}</h2>
      <p>{{ t('waitScreen.notFoundDesc') }}</p>
      <button @click="goHome" class="btn btn-primary">{{ t('common.goHome') }}</button>
    </div>

    <!-- Active States -->
    <div v-else class="status-container">
      
      <!-- STATE 1: WAITING -->
      <div v-if="ticket.status === 'waiting'" class="status-card glass-panel state-waiting">
        <div class="status-header">
          <span class="badge badge-gold pulse-ring">{{ t('waitScreen.statusWaiting') }}</span>
          <h2>{{ ticket.customer_name }}</h2>
          <p class="subtitle">{{ t('waitScreen.subtitleWaiting') }}</p>
        </div>

        <div class="queue-position-ring">
          <div class="ring-content">
            <span class="position-number">{{ formatOrdinal(position) }}</span>
            <span class="position-label">{{ t('waitScreen.inLine') }}</span>
          </div>
        </div>

        <div class="wait-stats">
          <div class="stat-item">
            <span class="stat-label">{{ t('waitScreen.estWait') }}</span>
            <span class="stat-value">{{ estimatedWaitTime }} {{ t('common.minutes') }}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-label">{{ t('waitScreen.preferences') }}</span>
            <span class="stat-value text-truncate">{{ preferenceSummary }}</span>
          </div>
        </div>

        <div class="alert-box">
          <Clock :size="18" class="color-gold" />
          <p>{{ t('waitScreen.alertWaiting') }}</p>
        </div>

        <div class="actions">
          <button @click="cancelTicket" class="btn btn-secondary btn-full" :disabled="cancelling">
            {{ cancelling ? t('waitScreen.cancelling') : t('waitScreen.cancelSpot') }}
          </button>
        </div>
      </div>

      <!-- STATE 2: SERVING -->
      <div v-else-if="ticket.status === 'serving'" class="status-card glass-panel state-serving">
        <div class="sparkle-glow"></div>
        <div class="status-header">
          <span class="badge badge-emerald">{{ t('waitScreen.statusServing') }}</span>
          <h2>{{ t('waitScreen.servingTitle') }}</h2>
          <p class="subtitle">{{ t('waitScreen.servingSubtitle') }}</p>
        </div>

        <div class="serving-icon-wrap">
          <Scissors :size="48" class="color-emerald animate-cut" />
        </div>

        <div class="barber-assigned-box">
          <p>{{ t('waitScreen.assignedBarber') }}</p>
          <h3>{{ ticket.assigned_barber || 'Your Barber' }}</h3>
        </div>

        <div class="alert-box alert-success">
          <CheckCircle :size="18" class="color-emerald" />
          <p>{{ t('waitScreen.alertServing') }}</p>
        </div>
      </div>

      <!-- STATE 3: DONE -->
      <div v-else-if="ticket.status === 'done'" class="status-card glass-panel state-done">
        <div class="status-header">
          <span class="badge badge-blue">{{ t('waitScreen.statusDone') }}</span>
          <h2>{{ t('waitScreen.doneTitle') }}</h2>
          <p class="subtitle">{{ t('waitScreen.doneSubtitle') }}</p>
        </div>

        <div class="completed-icon-wrap">
          <Smile :size="64" class="color-blue" />
        </div>

        <p class="done-desc">
          {{ t('waitScreen.doneDesc') }}
        </p>

        <div class="actions">
          <button @click="goHome" class="btn btn-primary btn-full">{{ t('waitScreen.checkinAgain') }}</button>
        </div>
      </div>

      <!-- STATE 4: CANCELLED -->
      <div v-else-if="ticket.status === 'cancelled'" class="status-card glass-panel state-cancelled">
        <div class="status-header">
          <span class="badge badge-rose">{{ t('waitScreen.statusCancelled') }}</span>
          <h2>{{ t('waitScreen.cancelledTitle') }}</h2>
          <p class="subtitle">{{ t('waitScreen.cancelledSubtitle') }}</p>
        </div>

        <div class="cancelled-icon-wrap">
          <Trash2 :size="64" class="color-rose" />
        </div>

        <p class="cancelled-desc">
          {{ t('waitScreen.cancelledDesc') }}
        </p>

        <div class="actions">
          <button @click="goHome" class="btn btn-primary btn-full">{{ t('waitScreen.returnCheckin') }}</button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  Scissors, 
  CheckCircle, 
  Smile, 
  Trash2 
} from '@lucide/vue';
import { 
  db, 
  doc, 
  onSnapshot, 
  updateDoc, 
  collection, 
  query, 
  where,
  signOut,
  auth
} from '../services/firebase';

const props = defineProps<{
  clientId: string;
}>();

const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const cancelling = ref(false);

import type { Ticket, Barber } from '../types/index';

const ticket = ref<Ticket | null>(null);
const activeQueue = ref<Ticket[]>([]);
const barbers = ref<Barber[]>([]);

let unsubscribeTicket: () => void = () => {};
let unsubscribeQueue: () => void = () => {};
let unsubscribeBarbers: () => void = () => {};



onMounted(() => {
  // Subscribe to this specific ticket
  const ticketRef = doc(db, 'queue', props.clientId);
  unsubscribeTicket = onSnapshot(ticketRef, (docSnap: any) => {
    loading.value = false;
    if (docSnap.exists()) {
      ticket.value = { id: docSnap.id, ...docSnap.data() };
    } else {
      ticket.value = null;
    }
  });

  // Subscribe to entire waiting queue
  const queueQuery = query(collection(db, 'queue'), where('status', '==', 'waiting'));
  unsubscribeQueue = onSnapshot(queueQuery, (snapshot: any) => {
    const list: Ticket[] = [];
    snapshot.docs.forEach((doc: any) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    activeQueue.value = list;
  });

  // Subscribe to barbers to translate barber IDs to names
  const barbersQuery = collection(db, 'barbers');
  unsubscribeBarbers = onSnapshot(barbersQuery, (snapshot: any) => {
    const list: Barber[] = [];
    snapshot.docs.forEach((doc: any) => {
      list.push({ id: doc.id, ...doc.data() } as Barber);
    });
    barbers.value = list;
  });
});

onUnmounted(() => {
  unsubscribeTicket();
  unsubscribeQueue();
  unsubscribeBarbers();
});

// Dynamic queue position algorithm
const position = computed(() => {
  const myTicket = ticket.value;
  if (!myTicket || myTicket.status !== 'waiting') return 0;

  // Sort queue chronologically
  const waitingClients = [...activeQueue.value].sort((a, b) => a.created_at - b.created_at);
  
  const myIndex = waitingClients.findIndex(q => q.id === myTicket.id);
  if (myIndex === -1) return 1;

  // If client chose "First Available", they compete with everyone ahead of them
  if (myTicket.preferred_barbers.length === 0) {
    return myIndex + 1;
  }

  // If client has preferences, they compete only with clients who:
  // - also have "First Available" (empty array)
  // - have overlapping preferred barbers
  const myPrefs = myTicket.preferred_barbers;
  let clientsAhead = 0;

  for (let i = 0; i < myIndex; i++) {
    const other = waitingClients[i];
    const otherPrefs = other.preferred_barbers;
    const overlaps = otherPrefs.length === 0 || otherPrefs.some(p => myPrefs.includes(p));
    if (overlaps) {
      clientsAhead++;
    }
  }

  return clientsAhead + 1;
});

const estimatedWaitTime = computed(() => {
  const pos = position.value;
  if (pos <= 0) return 0;
  
  const myPrefs = ticket.value?.preferred_barbers || [];
  if (myPrefs.length > 0) {
    const preferredBarbers = barbers.value.filter(b => myPrefs.includes(b.id));
    const totalAvgTime = preferredBarbers.reduce((sum, b) => sum + (b.average_service_time ?? 20), 0);
    const avgTime = preferredBarbers.length > 0 ? (totalAvgTime / preferredBarbers.length) : 20;
    
    return Math.round((pos * avgTime) / preferredBarbers.length);
  } else {
    const active = barbers.value.filter(b => b.status === 'active');
    const activeCount = active.length || 1;
    const totalAvgTime = active.reduce((sum, b) => sum + (b.average_service_time ?? 20), 0);
    const avgTime = active.length > 0 ? (totalAvgTime / active.length) : 20;

    return Math.round((pos * avgTime) / activeCount);
  }
});

const preferenceSummary = computed(() => {
  const myPrefs = ticket.value?.preferred_barbers || [];
  if (myPrefs.length === 0) return t('waitScreen.firstAvailable');
  
  const names = myPrefs.map(id => {
    const barber = barbers.value.find(b => b.id === id);
    return barber ? barber.name.split(' ')[0] : 'Barber';
  });
  return names.join(', ');
});

const formatOrdinal = (n: number): string => {
  const pr = new Intl.PluralRules('en-US', { type: 'ordinal' });
  const rule = pr.select(n);
  const suffix = ({
    one: 'st',
    two: 'nd',
    few: 'rd',
    other: 'th'
  } as Record<string, string>)[rule] || 'th';
  return `${n}${suffix}`;
};

const cancelTicket = async () => {
  if (!ticket.value || cancelling.value) return;
  if (!confirm(t('waitScreen.cancelConfirm'))) return;

  cancelling.value = true;
  try {
    const ticketRef = doc(db, 'queue', props.clientId);
    await updateDoc(ticketRef, { status: 'cancelled' });
  } catch (err) {
    console.error('Error cancelling ticket:', err);
    alert('Failed to cancel ticket. Please try again.');
  } finally {
    cancelling.value = false;
  }
};

const goHome = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Sign out error:', err);
  }
  router.push('/');
};
</script>

<style scoped>
.active-wait-screen {
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
  padding: 0 4px;
}

.loading-state,
.error-state {
  padding: 40px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.color-gold {
  color: var(--accent-gold);
}

.status-card {
  padding: 30px 24px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.status-header {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.status-header h2 {
  font-size: 1.8rem;
  margin-top: 4px;
}

.subtitle {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.queue-position-ring {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: 4px solid var(--accent-gold-glow);
  border-top-color: var(--accent-gold);
  margin: 0 auto 30px auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-gold);
  animation: rotateRing 8s linear infinite;
}

.ring-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: rotate(0deg);
  animation: counterRotateRing 8s linear infinite;
}

@keyframes rotateRing {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes counterRotateRing {
  from { transform: rotate(0deg); }
  to { transform: rotate(-360deg); }
}

.position-number {
  font-family: var(--font-heading);
  font-size: 2.8rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
}

.position-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.wait-stats {
  display: flex;
  justify-content: space-around;
  background: rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  padding: 16px;
  margin-bottom: 24px;
  border: 1px solid var(--panel-border);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 45%;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: 700;
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-divider {
  width: 1px;
  background: var(--panel-border);
}

.alert-box {
  display: flex;
  gap: 12px;
  background: rgba(234, 179, 8, 0.05);
  border: 1px solid rgba(234, 179, 8, 0.15);
  border-radius: var(--radius-sm);
  padding: 16px;
  text-align: left;
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.5;
}

.alert-success {
  background: rgba(16, 185, 129, 0.05) !important;
  border-color: rgba(16, 185, 129, 0.15) !important;
}

/* Serving card style additions */
.state-serving {
  border-color: var(--accent-emerald) !important;
}

.sparkle-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 50% -20%, var(--accent-emerald-glow) 0%, transparent 60%);
  pointer-events: none;
}

.serving-icon-wrap {
  width: 96px;
  height: 96px;
  background: var(--accent-emerald-glow);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px auto;
  box-shadow: 0 0 30px rgba(16, 185, 129, 0.2);
}

.animate-cut {
  animation: cutAction 1.2s ease-in-out infinite;
}

@keyframes cutAction {
  0% { transform: scale(1); }
  50% { transform: scale(1.15) rotate(-10deg); }
  100% { transform: scale(1); }
}

.barber-assigned-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--panel-border);
  padding: 16px;
  border-radius: var(--radius-sm);
  margin-bottom: 24px;
}

.barber-assigned-box p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.barber-assigned-box h3 {
  font-size: 1.4rem;
  color: var(--accent-emerald);
}

/* Completed card styling */
.completed-icon-wrap {
  margin: 20px auto 30px auto;
  width: 96px;
  height: 96px;
  background: var(--accent-blue-glow);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.done-desc,
.cancelled-desc {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin-bottom: 30px;
  line-height: 1.6;
}

/* Cancelled styling */
.cancelled-icon-wrap {
  margin: 20px auto 30px auto;
  width: 96px;
  height: 96px;
  background: var(--accent-rose-glow);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(244, 63, 94, 0.2);
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .status-card {
    padding: 24px 16px;
  }

  .queue-position-ring {
    width: 130px;
    height: 130px;
  }

  .position-number {
    font-size: 2.2rem;
  }

  .status-header h2 {
    font-size: 1.5rem;
  }

  .serving-icon-wrap,
  .completed-icon-wrap,
  .cancelled-icon-wrap {
    width: 76px;
    height: 76px;
  }

  .wait-stats {
    padding: 12px;
  }

  .stat-value {
    font-size: 1rem;
  }
}

</style>
