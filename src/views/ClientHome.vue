<template>
  <div class="client-home main-content">
    <div class="shop-welcome" v-if="shopName">
      <span class="welcome-tag">{{ t('common.welcome') }}</span>
      <h1>{{ shopName }}</h1>
      <p class="tagline">{{ t('common.tagline') }}</p>
    </div>
    
    <div class="shop-welcome-loading" v-else>
      <RefreshCw class="spin color-gold" :size="32" />
      <p>{{ t('common.loading') }}</p>
    </div>

    <!-- Active geofence checking -->
    <div class="onboarding-panels" v-if="shopCenter && !checkingActiveTicket">
      <GeofencingGuard 
        :shop-center="shopCenter" 
        :radius-meters="radiusMeters" 
        v-model:is-allowed="isAllowed"
      />
      
      <div class="checkin-container">
        <ClientCheckIn :is-allowed="isAllowed" />
      </div>
    </div>

    <!-- Loading ticket check state -->
    <div class="shop-welcome-loading" v-else-if="checkingActiveTicket">
      <RefreshCw class="spin color-gold" :size="32" />
      <p>{{ t('common.loading') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { RefreshCw } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import GeofencingGuard from '../components/GeofencingGuard.vue';
import ClientCheckIn from '../components/ClientCheckIn.vue';
import { db, doc, onSnapshot, auth, onAuthStateChanged, getDoc } from '../services/firebase';

const { t } = useI18n();
const router = useRouter();

const shopName = ref('');
const shopCenter = ref<{ latitude: number; longitude: number } | null>(null);
const radiusMeters = ref(50);
const isAllowed = ref(false);
const checkingActiveTicket = ref(true);

let unsubscribe: () => void = () => {};
let unsubscribeAuth: () => void = () => {};

onMounted(() => {
  // Subscribe to auth state changes to check for an active queue ticket
  unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    if (user && user.isAnonymous) {
      try {
        const ticketRef = doc(db, 'queue', user.uid);
        const ticketSnap = await getDoc(ticketRef);
        if (ticketSnap.exists()) {
          const ticketData = ticketSnap.data();
          if (ticketData && (ticketData.status === 'waiting' || ticketData.status === 'serving')) {
            router.push({ name: 'ClientWait', params: { clientId: user.uid } });
            return;
          }
        }
      } catch (err) {
        console.error('Error checking active ticket:', err);
      }
    }
    checkingActiveTicket.value = false;
  });

  const configRef = doc(db, 'config', 'shop');
  unsubscribe = onSnapshot(configRef, (docSnap: any) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      shopName.value = data.shop_name;
      radiusMeters.value = data.radius_meters;
      
      if (data.geo_center) {
        shopCenter.value = {
          latitude: data.geo_center.latitude || data.geo_center.lat || 0,
          longitude: data.geo_center.longitude || data.geo_center.lng || 0
        };
      }
    }
  });
});

onUnmounted(() => {
  unsubscribe();
  unsubscribeAuth();
});
</script>

<style scoped>
.client-home {
  max-width: 800px !important;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.shop-welcome {
  text-align: center;
}

.welcome-tag {
  font-family: var(--font-heading);
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: var(--accent-gold);
  font-weight: 700;
}

.shop-welcome h1 {
  font-size: 2.2rem;
  margin: 4px 0 8px 0;
  background: linear-gradient(135deg, var(--text-primary) 35%, var(--accent-gold));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tagline {
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.shop-welcome-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  text-align: center;
}

.onboarding-panels {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 30px;
  align-items: start;
}

@media (max-width: 768px) {
  .onboarding-panels {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .shop-welcome h1 {
    font-size: 1.7rem;
  }

  .onboarding-panels {
    gap: 20px;
  }
}

.color-gold {
  color: var(--accent-gold);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

</style>
