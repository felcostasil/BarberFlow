<template>
  <div class="admin-queue">
    <!-- Barber Availability Toggle -->
    <div class="barber-profile-card glass-panel" v-if="currentBarber">
      <div class="barber-details">
        <div class="avatar bg-accent-gold"><User :size="22" /></div>
        <div class="barber-text">
          <h3>{{ t('admin.welcomeBarber', { name: currentBarber.name }) }}</h3>
          <p>{{ currentBarber.email }}</p>
        </div>
      </div>
      <div class="status-toggle-wrap">
        <span class="badge" :class="currentBarber.status === 'active' ? 'badge-emerald' : 'badge-rose'">
          {{ currentBarber.status === 'active' ? t('admin.statusAvailable') : t('admin.statusAway') }}
        </span>
        <button 
          @click="toggleAvailability" 
          :class="['btn', 'btn-sm', currentBarber.status === 'active' ? 'btn-danger' : 'btn-success']"
          :disabled="updatingStatus"
        >
          {{ currentBarber.status === 'active' ? t('admin.goBreak') : t('admin.goActive') }}
        </button>
      </div>
    </div>

    <div v-if="currentBarber && currentBarber.status === 'away'" class="away-alert glass-panel">
      <AlertTriangle class="color-rose animate-pulse" :size="32" />
      <div>
        <h4>{{ t('admin.awayAlertTitle') }}</h4>
        <p>{{ t('admin.awayAlertDesc') }}</p>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="queue-grid" v-if="currentBarber">
      
      <!-- COLUMN 1: YOUR ACTIVE MATCH QUEUE -->
      <div class="queue-column">
        <div class="column-header">
          <h3>{{ t('admin.matchQueueTitle', { count: matchedQueue.length }) }}</h3>
          <span class="sub-header-desc">{{ t('admin.matchQueueDesc') }}</span>
        </div>

        <div class="column-body glass-panel">
          <!-- Call Next Button -->
          <div class="call-next-container" v-if="matchedQueue.length > 0">
            <button 
              @click="callNextClient" 
              class="btn btn-primary btn-full btn-lg font-outfit"
              :disabled="currentBarber.status === 'away' || calling"
            >
              <component :is="calling ? RefreshCw : Scissors" :class="{ 'spin': calling }" :size="20" />
              {{ calling ? t('admin.calling') : t('admin.callNext') }}
            </button>
          </div>

          <div v-if="matchedQueue.length === 0" class="empty-list">
            <Users :size="40" class="color-muted" />
            <p>{{ t('admin.emptyMatched') }}</p>
          </div>

          <div v-else class="tickets-list">
            <div 
              v-for="(ticket, index) in matchedQueue" 
              :key="ticket.id" 
              class="ticket-row glass-panel"
            >
              <div class="ticket-index">#{{ index + 1 }}</div>
              <div class="ticket-main">
                <span class="client-name">{{ ticket.customer_name }}</span>
                <span class="wait-time">{{ t('admin.joined', { time: formatTimeAgo(ticket.created_at) }) }}</span>
                <span class="pref-badge badge badge-blue" v-if="ticket.preferred_barbers.length === 0">
                  {{ t('admin.prefFirstAvailable') }}
                </span>
                <span class="pref-badge badge badge-gold" v-else>
                  {{ t('admin.prefPreferred') }}
                </span>
              </div>
              <div class="ticket-actions">
                <button 
                  @click="callClient(ticket)" 
                  class="btn btn-sm btn-success" 
                  :title="t('admin.call')"
                  :disabled="currentBarber.status === 'away' || calling"
                >
                  {{ t('admin.call') }}
                </button>
                <button 
                  @click="cancelClient(ticket)" 
                  class="btn btn-sm btn-danger" 
                  :title="t('admin.absent')"
                >
                  {{ t('admin.absent') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- COLUMN 2: ACTIVE SERVICE & OVERVIEW -->
      <div class="queue-column">
        <!-- Section: Active Service -->
        <div class="column-header">
          <h3>{{ t('admin.currentServiceTitle') }}</h3>
          <span class="sub-header-desc">{{ t('admin.currentServiceDesc') }}</span>
        </div>

        <div class="column-body glass-panel padding-box">
          <div v-if="!currentServing" class="empty-service">
            <Scissors :size="36" class="color-muted" />
            <p>{{ t('admin.emptyServing') }}</p>
          </div>
          
          <div v-else class="serving-card">
            <div class="sparkle-glow"></div>
            <div class="serving-header">
              <span class="badge badge-emerald pulse-ring">{{ t('admin.inService') }}</span>
              <h2>{{ currentServing.customer_name }}</h2>
              <p class="serving-time">{{ t('admin.started', { time: formatTimeAgo(currentServing.created_at) }) }}</p>
            </div>
            
            <div class="serving-actions">
              <button 
                @click="finishService(currentServing)" 
                class="btn btn-success btn-full"
                :disabled="completing"
              >
                <CheckCircle :size="18" />
                {{ t('admin.finishService') }}
              </button>
              <button 
                @click="cancelClient(currentServing)" 
                class="btn btn-secondary btn-full color-rose"
              >
                {{ t('admin.cancelMarkAbsent') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Section: Global Shop Overview -->
        <div class="column-header margin-top-section">
          <h3>{{ t('admin.shopOverviewTitle') }}</h3>
          <span class="sub-header-desc">{{ t('admin.shopOverviewDesc') }}</span>
        </div>

        <div class="column-body glass-panel compact-body">
          <div v-if="globalQueue.length === 0" class="empty-list text-center">
            <p class="color-muted">{{ t('admin.emptyGlobal') }}</p>
          </div>
          <div v-else class="global-tickets">
            <div 
              v-for="ticketItem in globalQueue" 
              :key="ticketItem.id" 
              class="global-ticket-item"
            >
              <div class="global-ticket-left">
                <span class="gt-name">{{ ticketItem.customer_name }}</span>
                <span class="gt-time">{{ t('admin.joined', { time: formatTime(ticketItem.created_at) }) }}</span>
              </div>
              <div class="global-ticket-right">
                <span v-if="ticketItem.status === 'serving'" class="badge badge-emerald">
                  {{ t('admin.servingBy', { barber: ticketItem.assigned_barber || t('admin.barberFallback') }) }}
                </span>
                <span v-else-if="ticketItem.status === 'waiting'" class="badge badge-gold">
                  {{ t('waitScreen.statusWaiting') }}
                </span>
                <span v-else-if="ticketItem.status === 'done'" class="badge badge-blue">
                  {{ t('waitScreen.statusDone') }}
                </span>
                <span v-else class="badge badge-rose">
                  {{ t('waitScreen.statusCancelled') }}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- Loading state while auth resolves (fixes bug #4 blank screen on mobile) -->
    <div v-else-if="!isAuthReady" class="auth-loading glass-panel">
      <RefreshCw class="spin color-gold" :size="32" />
      <p>{{ t('common.loading') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { 
  User, 
  AlertTriangle, 
  Scissors, 
  CheckCircle, 
  RefreshCw, 
  Users 
} from '@lucide/vue';
import { 
  db, 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc
} from '../services/firebase';
import { useBarberAuth } from '../composables/useBarberAuth';
import { useTimeUtils } from '../utils/timeUtils';
import type { Barber, Ticket } from '../types/index';

const { t } = useI18n();
const { formatTimeAgo, formatTime } = useTimeUtils();

// Reactive auth composable — resolves bugs #3 and #4
// currentUser updates immediately when auth state changes (no stale reads)
const { currentUser, isAuthReady } = useBarberAuth();

const currentBarber = ref<Barber | null>(null);
const globalQueue = ref<Ticket[]>([]); 

const updatingStatus = ref(false);
const calling = ref(false);
const completing = ref(false);

let unsubscribeBarbers: () => void = () => {};
let unsubscribeQueue: () => void = () => {};

// Set up Firestore listeners whenever the authenticated user changes.
// This replaces the onMounted pattern that caused bugs #3 and #4.
watch(currentUser, (user) => {
  // Tear down existing listeners first to prevent leaks on user switch
  unsubscribeBarbers();
  unsubscribeQueue();

  const currentUid = user?.uid;
  if (!currentUid || user?.isAnonymous) {
    currentBarber.value = null;
    globalQueue.value = [];
    return;
  }

  // Listen to barbers list
  unsubscribeBarbers = onSnapshot(collection(db, 'barbers'), (snapshot: any) => {
    const list: Barber[] = [];
    snapshot.docs.forEach((docSnap: any) => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Update current barber reactively
    const found = list.find(b => b.id === currentUid);
    currentBarber.value = found || null;
  });

  // Listen to all queue tickets
  unsubscribeQueue = onSnapshot(collection(db, 'queue'), (snapshot: any) => {
    const list: Ticket[] = [];
    snapshot.docs.forEach((docSnap: any) => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    globalQueue.value = list;
  });
}, { immediate: true });

onUnmounted(() => {
  unsubscribeBarbers();
  unsubscribeQueue();
});

// Matchmaking algorithm for barber's personal queue
const matchedQueue = computed(() => {
  if (!currentBarber.value) return [];
  const barberId = currentBarber.value.id;

  return globalQueue.value
    .filter(t => 
      t.status === 'waiting' && 
      (t.preferred_barbers.includes(barberId) || t.preferred_barbers.length === 0)
    )
    .sort((a, b) => a.created_at - b.created_at);
});

// Check if currently serving a client
const currentServing = computed(() => {
  if (!currentBarber.value) return null;
  
  return globalQueue.value.find(t => 
    t.status === 'serving' && 
    t.assigned_barber === currentBarber.value?.name
  ) || null;
});

// Actions
const toggleAvailability = async () => {
  if (!currentBarber.value || updatingStatus.value) return;

  updatingStatus.value = true;
  try {
    const newStatus = currentBarber.value.status === 'active' ? 'away' : 'active';
    const barberRef = doc(db, 'barbers', currentBarber.value.id);
    await updateDoc(barberRef, { status: newStatus });
  } catch (err) {
    console.error('Error toggling availability:', err);
    alert(t('admin.statusToggleFailed'));
  } finally {
    updatingStatus.value = false;
  }
};

const callClient = async (ticket: Ticket) => {
  if (!currentBarber.value || calling.value) return;
  if (currentBarber.value.status === 'away') {
    alert(t('admin.callWhileAwayError'));
    return;
  }

  calling.value = true;
  try {
    const ticketRef = doc(db, 'queue', ticket.id);
    await updateDoc(ticketRef, {
      status: 'serving',
      assigned_barber: currentBarber.value.name
    });
  } catch (err) {
    console.error('Error calling client:', err);
    alert(t('admin.callFailed'));
  } finally {
    calling.value = false;
  }
};

const callNextClient = () => {
  if (matchedQueue.value.length === 0) return;
  callClient(matchedQueue.value[0]);
};

const finishService = async (ticket: Ticket) => {
  if (completing.value) return;

  completing.value = true;
  try {
    const ticketRef = doc(db, 'queue', ticket.id);
    await updateDoc(ticketRef, { status: 'done' });
  } catch (err) {
    console.error('Error finishing service:', err);
    alert(t('admin.finishFailed'));
  } finally {
    completing.value = false;
  }
};

const cancelClient = async (ticket: Ticket) => {
  if (!confirm(t('admin.absentConfirm', { name: ticket.customer_name }))) return;

  try {
    const ticketRef = doc(db, 'queue', ticket.id);
    await updateDoc(ticketRef, { status: 'cancelled' });
  } catch (err) {
    console.error('Error cancelling client:', err);
    alert(t('admin.cancelFailed'));
  }
};
</script>

<style scoped>
.admin-queue {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Auth loading placeholder */
.auth-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 40px;
  text-align: center;
}

.barber-profile-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  flex-wrap: wrap;
  gap: 16px;
}

.barber-details {
  display: flex;
  align-items: center;
  gap: 16px;
}

.barber-text h3 {
  font-size: 1.2rem;
  font-weight: 700;
}

.barber-text p {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.status-toggle-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.status-toggle-wrap .badge {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.away-alert {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-color: rgba(244, 63, 94, 0.2);
  background: rgba(244, 63, 94, 0.03);
}

.away-alert h4 {
  color: var(--accent-rose);
  font-size: 1rem;
  margin-bottom: 2px;
}

.away-alert p {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.animate-pulse {
  animation: pulseWarning 1.5s infinite;
}

@keyframes pulseWarning {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
}

.queue-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 24px;
}

@media (max-width: 992px) {
  .queue-grid {
    grid-template-columns: 1fr;
  }
}

.queue-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.column-header h3 {
  font-size: 1.15rem;
  font-weight: 700;
}

.sub-header-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.column-body {
  flex: 1;
  min-height: 350px;
}

.padding-box {
  padding: 24px;
}

.compact-body {
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

.call-next-container {
  padding: 16px;
  border-bottom: 1px solid var(--panel-border);
}

.font-outfit {
  font-family: var(--font-heading);
}

.empty-list,
.empty-service {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 250px;
  color: var(--text-secondary);
  gap: 12px;
}

.empty-list p,
.empty-service p {
  font-size: 0.9rem;
}

.tickets-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 600px;
  overflow-y: auto;
}

.ticket-row {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;
  background: rgba(255, 255, 255, 0.02);
  flex-wrap: wrap;
}

.ticket-index {
  font-family: var(--font-heading);
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--accent-gold);
  min-width: 32px;
}

.ticket-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 100px;
}

.client-name {
  font-size: 0.95rem;
  font-weight: 600;
}

.wait-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.pref-badge {
  align-self: flex-start;
  font-size: 0.65rem;
}

.ticket-actions {
  display: flex;
  gap: 8px;
}

/* Serving card */
.serving-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  position: relative;
}

.serving-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.serving-header h2 {
  font-size: 1.6rem;
  margin-top: 8px;
}

.serving-time {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.serving-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.margin-top-section {
  margin-top: 16px;
}

/* Global list */
.global-tickets {
  padding: 8px 0;
  display: flex;
  flex-direction: column;
}

.global-ticket-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--panel-border);
  gap: 8px;
}

.global-ticket-item:last-child {
  border-bottom: none;
}

.global-ticket-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.gt-name {
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gt-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.global-ticket-right .badge {
  font-size: 0.65rem;
  white-space: nowrap;
}

/* Responsive mobile adjustments */
@media (max-width: 640px) {
  .barber-profile-card {
    padding: 16px 20px;
  }

  .barber-text h3 {
    font-size: 1rem;
  }

  .ticket-row {
    padding: 12px;
  }

  .ticket-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .global-ticket-item {
    padding: 10px 16px;
  }
}

/* Shared color helpers */
.color-gold { color: var(--accent-gold); }
.color-rose { color: var(--accent-rose); }
.color-muted { color: var(--text-muted); }
.text-center { text-align: center; }

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Sparkle glow for serving card */
.sparkle-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 50% -20%, var(--accent-emerald-glow) 0%, transparent 60%);
  pointer-events: none;
}
</style>
