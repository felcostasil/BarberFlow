<template>
  <div class="admin-settings">
    <div class="settings-grid">
      <!-- PANEL 1: SHOP CONFIGURATION -->
      <div class="settings-column">
        <div class="column-header">
          <h3>{{ t('settings.shopConfig') }}</h3>
          <span class="sub-header-desc">{{ t('settings.shopConfigDesc') }}</span>
        </div>

        <div class="column-body glass-panel padding-box">
          <form @submit.prevent="saveShopConfig" class="settings-form">
            <div class="form-group">
              <label for="shopName">{{ t('settings.shopName') }}</label>
              <input 
                id="shopName"
                v-model="shopConfig.shop_name" 
                type="text" 
                class="form-input" 
                required
                :disabled="savingConfig"
              />
            </div>

            <div class="form-row">
              <div class="form-group col-6">
                <label for="shopLat">{{ t('settings.latitude') }}</label>
                <input 
                  id="shopLat"
                  v-model.number="shopConfig.latitude" 
                  type="number" 
                  step="0.000001" 
                  class="form-input" 
                  required
                  :disabled="savingConfig"
                />
              </div>
              <div class="form-group col-6">
                <label for="shopLng">{{ t('settings.longitude') }}</label>
                <input 
                  id="shopLng"
                  v-model.number="shopConfig.longitude" 
                  type="number" 
                  step="0.000001" 
                  class="form-input" 
                  required
                  :disabled="savingConfig"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="shopRadius">{{ t('settings.radius') }}</label>
              <input 
                id="shopRadius"
                v-model.number="shopConfig.radius_meters" 
                type="number" 
                class="form-input" 
                required
                :disabled="savingConfig"
              />
            </div>

            <div class="alert-box">
              <MapPin :size="18" class="color-gold" />
              <p>{{ t('settings.configHelp') }}</p>
            </div>

            <button 
              type="submit" 
              class="btn btn-primary btn-full font-outfit"
              :disabled="savingConfig"
            >
              <Save :size="16" />
              {{ savingConfig ? t('settings.saving') : t('settings.saveConfig') }}
            </button>
          </form>
        </div>
      </div>

      <!-- PANEL 2: TEAM MANAGEMENT (CRUD) -->
      <div class="settings-column">
        <div class="column-header">
          <h3>{{ t('settings.teamManagement') }}</h3>
          <span class="sub-header-desc">{{ t('settings.teamManagementDesc') }}</span>
        </div>

        <div class="column-body glass-panel padding-box">
          <!-- Add Barber Form -->
          <div class="add-barber-section">
            <h4>{{ t('settings.addNewBarber') }}</h4>
            <form @submit.prevent="addBarber" class="settings-form mt-12">
              <div class="form-group">
                <label for="newBarberName">{{ t('settings.fullName') }}</label>
                <input 
                  id="newBarberName"
                  v-model="newBarber.name" 
                  type="text" 
                  placeholder="e.g. Felipe Santos" 
                  class="form-input" 
                  required
                  :disabled="addingBarber"
                />
              </div>
              
              <div class="form-group">
                <label for="newBarberEmail">{{ t('login.emailLabel') }}</label>
                <input 
                  id="newBarberEmail"
                  v-model="newBarber.email" 
                  type="email" 
                  placeholder="felipe@barber.com" 
                  class="form-input" 
                  required
                  :disabled="addingBarber"
                />
              </div>

              <div class="form-group">
                <label for="newBarberPassword">{{ t('settings.password') }}</label>
                <input 
                  id="newBarberPassword"
                  v-model="newBarber.password" 
                  type="password" 
                  :placeholder="t('settings.passwordHint')" 
                  class="form-input" 
                  required
                  minlength="6"
                  :disabled="addingBarber"
                />
              </div>

              <button 
                type="submit" 
                class="btn btn-success btn-full font-outfit btn-sm"
                :disabled="addingBarber"
              >
                <UserPlus :size="16" />
                {{ addingBarber ? t('settings.creatingAccount') : t('settings.register') }}
              </button>
            </form>
          </div>

          <div class="divider"></div>

          <!-- Barbers List -->
          <div class="barbers-list-section">
            <h4>{{ t('settings.activeStaff', { count: barbersList.length }) }}</h4>
            <div class="staff-list mt-12">
              <div v-if="barbersList.length === 0" class="empty-text">
                <p>{{ t('settings.noBarbers') }}</p>
              </div>
              <div 
                v-for="b in barbersList" 
                :key="b.id" 
                class="staff-row glass-panel"
              >
                <div class="staff-info">
                  <span class="staff-name">{{ b.name }}</span>
                  <span class="staff-email">{{ b.email }}</span>
                </div>
                <div class="staff-actions">
                  <span class="badge" :class="b.status === 'active' ? 'badge-emerald' : 'badge-rose'">
                    {{ b.status === 'active' ? t('admin.statusAvailable') : t('admin.statusAway') }}
                  </span>
                  <!-- Prevent self deletion -->
                  <button 
                    v-if="b.id !== currentUserId" 
                    @click="deleteBarber(b)" 
                    class="btn-delete"
                    :title="t('settings.removeBarberTitle')"
                  >
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Save, UserPlus, Trash2, MapPin } from '@lucide/vue';
import { 
  db, 
  auth, 
  doc, 
  updateDoc, 
  collection, 
  onSnapshot,
  isDemoMode
} from '../services/firebase';

// Since we may need to dynamically create auth accounts in real Firebase mode, 
// import standard firebase scripts to build secondary app instances:
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const currentUserId = auth.currentUser?.uid;
const { t } = useI18n();

const shopConfig = reactive({
  shop_name: '',
  latitude: 0,
  longitude: 0,
  radius_meters: 50
});

const newBarber = reactive({
  name: '',
  email: '',
  password: ''
});

const barbersList = ref<any[]>([]);
const savingConfig = ref(false);
const addingBarber = ref(false);

let unsubscribeConfig: () => void = () => {};
let unsubscribeBarbers: () => void = () => {};

onMounted(() => {
  // Subscribe to config (single document shop)
  const configRef = doc(db, 'config', 'shop');
  unsubscribeConfig = onSnapshot(configRef, (docSnap: any) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      shopConfig.shop_name = data.shop_name;
      // Handle Firebase GeoPoint mapping vs Mock mapping
      if (data.geo_center) {
        shopConfig.latitude = data.geo_center.latitude || data.geo_center.lat || 0;
        shopConfig.longitude = data.geo_center.longitude || data.geo_center.lng || 0;
      }
      shopConfig.radius_meters = data.radius_meters;
    }
  });

  // Subscribe to barbers
  unsubscribeBarbers = onSnapshot(collection(db, 'barbers'), (snapshot: any) => {
    const list: any[] = [];
    snapshot.docs.forEach((docSnap: any) => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    barbersList.value = list;
  });
});

onUnmounted(() => {
  unsubscribeConfig();
  unsubscribeBarbers();
});

const saveShopConfig = async () => {
  savingConfig.value = true;
  try {
    const configRef = doc(db, 'config', 'shop');
    
    // In real firebase, we'll write a real GeoPoint
    let geoCenter: any = { latitude: shopConfig.latitude, longitude: shopConfig.longitude };
    if (!isDemoMode) {
      // Import GeoPoint dynamically from firebase
      const { GeoPoint } = await import('firebase/firestore');
      geoCenter = new GeoPoint(shopConfig.latitude, shopConfig.longitude);
    }

    await updateDoc(configRef, {
      shop_name: shopConfig.shop_name,
      geo_center: geoCenter,
      radius_meters: shopConfig.radius_meters
    });
    alert(t('settings.saveSuccess'));
  } catch (err) {
    console.error('Error saving config:', err);
    alert(t('settings.saveFailed'));
  } finally {
    savingConfig.value = false;
  }
};

const addBarber = async () => {
  if (newBarber.password.length < 6) return;

  addingBarber.value = true;
  try {
    let newUid = '';

    if (isDemoMode) {
      // Simple Mock implementation
      newUid = 'barber_' + Math.random().toString(36).substring(2, 9);
      
      // In Mock Mode, we also add directly using doc update mock
      const newDocRef = doc(db, 'barbers', newUid);
      await updateDoc(newDocRef, {
        name: newBarber.name,
        email: newBarber.email,
        status: 'active'
      });
    } else {
      // Real Firebase client secondary app login workaround:
      // Read current Firebase config from environment variables
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };

      // Create a temporary secondary Firebase application so that we don't log out current user
      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryAppCreator');
      const secondaryAuth = getAuth(secondaryApp);
      
      try {
        const credential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          newBarber.email, 
          newBarber.password
        );
        newUid = credential.user.uid;
      } finally {
        await deleteApp(secondaryApp);
      }

      // Store in firestore collection
      const barberDocRef = doc(db, 'barbers', newUid);
      await updateDoc(barberDocRef, {
        name: newBarber.name,
        email: newBarber.email,
        status: 'active'
      });
    }

    // Reset Form
    newBarber.name = '';
    newBarber.email = '';
    newBarber.password = '';
    alert(t('settings.registerSuccess'));
  } catch (err: any) {
    console.error('Error creating barber:', err);
    alert(t('settings.registerFailed', { error: err.message || err }));
  } finally {
    addingBarber.value = false;
  }
};

const deleteBarber = async (barber: any) => {
  if (!confirm(t('settings.deleteConfirm', { name: barber.name }))) return;

  try {
    // In Firestore, we delete the document. For simplicity in our mock structure, 
    // we can delete the barber from mock db by deleting or updating mock db.
    // Let's call firebase delete or update:
    if (isDemoMode) {
      const idx = barbersList.value.findIndex(b => b.id === barber.id);
      if (idx !== -1) {
        // We'll update the mock localstorage directly
        const stored = localStorage.getItem('barberflow_mock_barbers');
        if (stored) {
          const list = JSON.parse(stored).filter((b: any) => b.id !== barber.id);
          localStorage.setItem('barberflow_mock_barbers', JSON.stringify(list));
        }
        // Force refresh mock db
        window.location.reload();
      }
    } else {
      const { deleteDoc } = await import('firebase/firestore');
      const barberDocRef = doc(db, 'barbers', barber.id);
      await deleteDoc(barberDocRef);
      alert(t('settings.deleteSuccess'));
    }
  } catch (err) {
    console.error('Error deleting barber:', err);
    alert(t('settings.deleteFailed'));
  }
};
</script>

<style scoped>
.admin-settings {
  display: flex;
  flex-direction: column;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 992px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

.settings-column {
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

.padding-box {
  padding: 24px;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.col-6 {
  flex: 1;
}

.alert-box {
  display: flex;
  gap: 12px;
  background: rgba(234, 179, 8, 0.05);
  border: 1px solid rgba(234, 179, 8, 0.15);
  border-radius: var(--radius-sm);
  padding: 12px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.add-barber-section h4,
.barbers-list-section h4 {
  font-family: var(--font-heading);
  font-size: 1rem;
  font-weight: 600;
  border-left: 3px solid var(--accent-gold);
  padding-left: 8px;
}

.mt-12 {
  margin-top: 12px;
}

.divider {
  height: 1px;
  background: var(--panel-border);
  margin: 24px 0;
}

.staff-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.staff-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.01);
}

.staff-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.staff-name {
  font-size: 0.9rem;
  font-weight: 600;
}

.staff-email {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.staff-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.staff-actions .badge {
  font-size: 0.65rem;
}

.btn-delete {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-delete:hover {
  color: var(--accent-rose);
  background: rgba(244, 63, 94, 0.08);
}

.empty-text {
  color: var(--text-muted);
  font-size: 0.85rem;
  text-align: center;
  padding: 20px;
}
</style>
