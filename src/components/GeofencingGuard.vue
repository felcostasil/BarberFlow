<template>
  <div class="geofencing-guard">
    <!-- Simulator panel for Demo Mode -->
    <div v-if="isDemoMode" class="demo-location-simulator glass-panel">
      <div class="simulator-header">
        <span class="pulse-dot"></span>
        <p><strong>{{ t('geofence.simulatorTitle') }}</strong></p>
      </div>
      <p class="simulator-desc">
        {{ t('geofence.simulatorDesc') }}
      </p>
      <div class="simulator-toggle">
        <button 
          @click="setSimulation(true)" 
          :class="['btn', 'btn-sm', isSimulatingInside ? 'btn-gold' : 'btn-secondary']"
        >
          {{ t('geofence.insideButton') }}
        </button>
        <button 
          @click="setSimulation(false)" 
          :class="['btn', 'btn-sm', !isSimulatingInside ? 'btn-rose' : 'btn-secondary']"
        >
          {{ t('geofence.outsideButton') }}
        </button>
      </div>
    </div>

    <!-- Active geolocation verification status -->
    <div class="geo-status-card glass-panel" :class="{ 'status-locked': !isWithinGeofence && !checking }">
      <div class="status-header">
        <div class="icon-wrap" :class="isWithinGeofence ? 'icon-success' : 'icon-warning'">
          <component :is="statusIcon" class="status-svg" />
        </div>
        <div class="status-text">
          <h3>{{ statusTitle }}</h3>
          <p>{{ statusMessage }}</p>
        </div>
      </div>

      <div class="distance-info" v-if="calculatedDistance !== null">
        <div class="progress-track">
          <div 
            class="progress-fill" 
            :style="{ width: Math.min((calculatedDistance * 1000 / radiusMeters) * 100, 100) + '%' }"
            :class="isWithinGeofence ? 'fill-success' : 'fill-danger'"
          ></div>
        </div>
        <div class="distance-details">
          <span>{{ t('geofence.distance') }}: <strong>{{ formatDistance(calculatedDistance) }}</strong></span>
          <span>{{ t('geofence.target') }}: <strong>&le; {{ radiusMeters }}m</strong></span>
        </div>
      </div>

      <div class="card-footer" v-if="!isWithinGeofence || error">
        <button @click="verifyLocation" class="btn btn-secondary btn-full" :disabled="checking">
          <RefreshCw :class="{ 'spin': checking }" :size="16" />
          {{ t('geofence.recheck') }}
        </button>
      </div>
    </div>

    <!-- Fallback Modal for Denied / Failed Permissions -->
    <div class="modal-overlay" v-if="showErrorModal">
      <div class="modal-content glass-panel">
        <div class="modal-icon-wrap bg-rose-glow">
          <MapPinOff :size="32" class="color-rose" />
        </div>
        <h2>{{ t('geofence.modalTitle') }}</h2>
        <p class="modal-text">
          {{ t('geofence.modalDesc') }}
        </p>
        <div class="modal-instructions">
          <p><strong>{{ t('geofence.modalInstruction') }}</strong></p>
          <ul>
            <li>{{ t('geofence.modalStep1') }}</li>
            <li>{{ t('geofence.modalStep2') }}</li>
            <li>{{ t('geofence.modalStep3') }}</li>
          </ul>
        </div>
        <div class="modal-actions">
          <button @click="verifyLocation" class="btn btn-primary btn-full">
            <RefreshCw :size="16" />
            {{ t('geofence.modalRetry') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { 
  MapPin, 
  Lock, 
  RefreshCw, 
  MapPinOff 
} from '@lucide/vue';
import { 
  isDemoMode, 
  demoLocationState, 
  toggleDemoLocation 
} from '../services/firebase';

const props = defineProps<{
  shopCenter: { latitude: number; longitude: number };
  radiusMeters: number;
}>();

const emit = defineEmits<{
  (e: 'update:isAllowed', allowed: boolean): void;
}>();

const { t } = useI18n();

const checking = ref(false);
const calculatedDistance = ref<number | null>(null); // in km
const error = ref<string | null>(null);
const showErrorModal = ref(false);

const isSimulatingInside = computed(() => demoLocationState.isSimulatingInside);

const isWithinGeofence = computed(() => {
  if (isDemoMode) {
    return isSimulatingInside.value;
  }
  if (calculatedDistance.value === null) return false;
  return calculatedDistance.value * 1000 <= props.radiusMeters;
});

// Watch and emit allowed state
watch(isWithinGeofence, (newVal) => {
  emit('update:isAllowed', newVal);
}, { immediate: true });

// Dynamic header elements
const statusIcon = computed(() => {
  if (checking.value) return RefreshCw;
  return isWithinGeofence.value ? MapPin : Lock;
});

const statusTitle = computed(() => {
  if (checking.value) return t('geofence.verifying');
  return isWithinGeofence.value ? t('geofence.granted') : t('geofence.locked');
});

const statusMessage = computed(() => {
  if (checking.value) return t('geofence.verifyingDesc');
  if (error.value) return error.value;
  return isWithinGeofence.value 
    ? t('geofence.grantedDesc') 
    : t('geofence.lockedDesc');
});

// Haversine formula
const calculateHaversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const verifyLocation = () => {
  checking.value = true;
  error.value = null;
  showErrorModal.value = false;

  if (isDemoMode) {
    // Simulate coordinates
    setTimeout(() => {
      checking.value = false;
      if (isSimulatingInside.value) {
        calculatedDistance.value = 0.005; // 5 meters
      } else {
        calculatedDistance.value = 1.25; // 1.25 km
      }
    }, 600);
    return;
  }

  if (!navigator.geolocation) {
    error.value = 'Geolocation is not supported by this browser.';
    checking.value = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const clientLat = position.coords.latitude;
      const clientLng = position.coords.longitude;
      
      calculatedDistance.value = calculateHaversine(
        clientLat, 
        clientLng, 
        props.shopCenter.latitude, 
        props.shopCenter.longitude
      );
      checking.value = false;
    },
    (err) => {
      checking.value = false;
      if (err.code === err.PERMISSION_DENIED) {
        error.value = 'GPS permission denied by user.';
        showErrorModal.value = true;
      } else if (err.code === err.TIMEOUT) {
        error.value = 'GPS request timed out. Please try again.';
      } else {
        error.value = 'Unable to determine physical location.';
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    }
  );
};

const setSimulation = (inside: boolean) => {
  toggleDemoLocation(inside);
  verifyLocation();
};

const formatDistance = (dist: number): string => {
  const meters = dist * 1000;
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${dist.toFixed(2)} km`;
};

onMounted(() => {
  verifyLocation();
});
</script>

<style scoped>
.geofencing-guard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.demo-location-simulator {
  background: rgba(217, 119, 6, 0.08);
  border: 1px solid rgba(217, 119, 6, 0.2);
  padding: 16px;
  border-radius: var(--radius-md);
}

.simulator-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fbbf24;
  margin-bottom: 6px;
  font-size: 0.9rem;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: #fbbf24;
  border-radius: 50%;
  animation: simPulse 1.5s infinite;
}

@keyframes simPulse {
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
}

.simulator-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.simulator-toggle {
  display: flex;
  gap: 10px;
}

.simulator-toggle .btn {
  flex: 1;
  padding: 8px 12px;
  font-size: 0.8rem;
}

.btn-gold {
  background: var(--accent-gold);
  color: #000;
  font-weight: 600;
}

.btn-rose {
  background: var(--accent-rose);
  color: #fff;
  font-weight: 600;
}

.geo-status-card {
  padding: 24px;
}

.status-locked {
  border-color: rgba(244, 63, 94, 0.2);
  background: rgba(244, 63, 94, 0.02);
}

.status-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-success {
  background: var(--accent-emerald-glow);
  color: var(--accent-emerald);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.icon-warning {
  background: var(--accent-rose-glow);
  color: var(--accent-rose);
  border: 1px solid rgba(244, 63, 94, 0.2);
}

.status-svg {
  width: 24px;
  height: 24px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-text h3 {
  font-size: 1.15rem;
  margin-bottom: 2px;
}

.status-text p {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.distance-info {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--panel-border);
}

.progress-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s ease;
}

.fill-success {
  background: var(--accent-emerald);
}

.fill-danger {
  background: var(--accent-rose);
}

.distance-details {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.card-footer {
  margin-top: 16px;
}

.btn-full {
  width: 100%;
  justify-content: center;
}

/* Modal inside styles */
.modal-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.bg-rose-glow {
  background: var(--accent-rose-glow);
  border: 1px solid rgba(244, 63, 94, 0.2);
}

.color-rose {
  color: var(--accent-rose);
}

.modal-text {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin: 12px 0 20px 0;
  line-height: 1.6;
}

.modal-instructions {
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm);
  padding: 16px;
  text-align: left;
  margin-bottom: 24px;
  border: 1px solid var(--panel-border);
}

.modal-instructions p {
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.modal-instructions ul {
  padding-left: 20px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal-actions {
  display: flex;
  gap: 12px;
}
</style>
