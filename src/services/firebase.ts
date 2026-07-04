import { reactive } from 'vue';
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword as fbSignIn,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  signInAnonymously as fbSignInAnonymously,
  type Auth
} from 'firebase/auth';
import {
  getFirestore,
  collection as fbCollection,
  doc as fbDoc,
  addDoc as fbAddDoc,
  updateDoc as fbUpdateDoc,
  onSnapshot as fbOnSnapshot,
  query as fbQuery,
  where as fbWhere,
  orderBy as fbOrderBy,
  getDocs as fbGetDocs,
  getDoc as fbGetDoc,
  type Firestore,
  GeoPoint
} from 'firebase/firestore';

// ---------------------------------------------------------
// ENVIRONMENT DETECT & CONFIG
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const isMockMode = !firebaseConfig.apiKey;

// Initialize real Firebase if config is present
let realApp: any = null;
let realAuth: Auth | null = null;
let realDb: Firestore | null = null;

if (!isMockMode) {
  realApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  realAuth = getAuth(realApp);
  realDb = getFirestore(realApp);
}

// Export GeoPoint
export { GeoPoint };

// ---------------------------------------------------------
// MOCK ENGINE STATE
// ---------------------------------------------------------
interface MockUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
}

interface MockBarber {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'away';
}

interface MockQueueItem {
  id: string;
  customer_name: string;
  preferred_barbers: string[];
  status: 'waiting' | 'serving' | 'done' | 'cancelled';
  created_at: number; // timestamp ms
  assigned_barber?: string; // barber name or ID
}

interface MockConfig {
  shop_name: string;
  geo_center: { latitude: number; longitude: number };
  radius_meters: number;
}

// LocalStorage helpers
const STORAGE_PREFIX = 'barberflow_mock_';
const loadStorage = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(STORAGE_PREFIX + key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
};

const saveStorage = <T>(key: string, value: T) => {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
};

// Seed default mock data
const defaultBarbers: MockBarber[] = [
  { id: 'barber_1', name: 'Marcos Silva', email: 'marcos@barber.com', status: 'active' },
  { id: 'barber_2', name: 'Thiago Costa', email: 'thiago@barber.com', status: 'active' },
  { id: 'barber_3', name: 'Felipe Santos', email: 'felipe@barber.com', status: 'away' }
];

const defaultQueue: MockQueueItem[] = [
  {
    id: 'client_seed_1',
    customer_name: 'Daniel Lima',
    preferred_barbers: ['barber_1'],
    status: 'waiting',
    created_at: Date.now() - 30 * 60 * 1000 // 30 mins ago
  },
  {
    id: 'client_seed_2',
    customer_name: 'Gabriela M.',
    preferred_barbers: [], // No preference
    status: 'waiting',
    created_at: Date.now() - 15 * 60 * 1000 // 15 mins ago
  },
  {
    id: 'client_seed_3',
    customer_name: 'Lucas Souza',
    preferred_barbers: ['barber_1', 'barber_2'], // Multi
    status: 'waiting',
    created_at: Date.now() - 5 * 60 * 1000 // 5 mins ago
  }
];

const defaultConfig: MockConfig = {
  shop_name: 'Barbearia Premium Flow',
  geo_center: { latitude: -23.55052, longitude: -46.633308 },
  radius_meters: 50
};

// Reactive mock database state
const mockDbState = reactive({
  barbers: loadStorage<MockBarber[]>('barbers', defaultBarbers),
  queue: loadStorage<MockQueueItem[]>('queue', defaultQueue),
  config: loadStorage<MockConfig>('config', defaultConfig)
});

// Watch database state changes to persist them
const syncToStorage = () => {
  saveStorage('barbers', mockDbState.barbers);
  saveStorage('queue', mockDbState.queue);
  saveStorage('config', mockDbState.config);
  triggerSubscribers();
};

// Subscriber system for reactive onSnapshot calls
type SubscriberCallback = (snapshot: any) => void;
const docSubscribers = new Map<string, Set<SubscriberCallback>>();
const querySubscribers = new Map<string, Set<{ constraints: any[]; callback: SubscriberCallback }>>();

const triggerSubscribers = () => {
  // Document subscribers
  docSubscribers.forEach((callbacks, path) => {
    const data = getMockDocDataByPath(path);
    callbacks.forEach((cb) => cb({
      id: path.split('/').pop(),
      exists: () => data !== null,
      data: () => data
    }));
  });

  // Query/Collection subscribers
  querySubscribers.forEach((subs, collectionName) => {
    subs.forEach(({ constraints, callback }) => {
      const docs = getMockCollectionDocs(collectionName, constraints);
      callback({
        docs: docs.map((d) => ({
          id: d.id,
          data: () => d,
          exists: () => true
        }))
      });
    });
  });
};

const getMockDocDataByPath = (path: string): any => {
  const parts = path.split('/');
  const collection = parts[0];
  const id = parts[1];

  if (collection === 'config') {
    return mockDbState.config;
  }
  if (collection === 'barbers') {
    return mockDbState.barbers.find((b) => b.id === id) || null;
  }
  if (collection === 'queue') {
    return mockDbState.queue.find((q) => q.id === id) || null;
  }
  return null;
};

const getMockCollectionDocs = (collectionName: string, constraints: any[] = []): any[] => {
  let list: any[] = [];
  if (collectionName === 'barbers') {
    list = [...mockDbState.barbers];
  } else if (collectionName === 'queue') {
    list = [...mockDbState.queue];
  } else if (collectionName === 'config') {
    list = [mockDbState.config];
  }

  // Simple filter application
  constraints.forEach((c: any) => {
    if (c.type === 'where') {
      const { field, op, value } = c;
      list = list.filter((item) => {
        const itemVal = item[field];
        if (Array.isArray(itemVal) && op === 'array-contains') {
          return itemVal.includes(value);
        }
        if (op === '==') return itemVal === value;
        if (op === 'in' && Array.isArray(value)) return value.includes(itemVal);
        return true;
      });
    }
    if (c.type === 'orderBy') {
      const { field, direction } = c;
      list.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
  });

  return list;
};

// Mock Auth State
const mockAuthState = reactive({
  currentUser: loadStorage<MockUser | null>('current_user', null)
});

const authCallbacks = new Set<(user: MockUser | null) => void>();

const setMockUser = (user: MockUser | null) => {
  mockAuthState.currentUser = user;
  saveStorage('current_user', user);
  authCallbacks.forEach((cb) => cb(user));
};

// ---------------------------------------------------------
// EXPORTED FIREBASE API
// ---------------------------------------------------------

export const auth = !isMockMode ? realAuth! : ({
  currentUser: mockAuthState.currentUser
} as any);

export const db = !isMockMode ? realDb! : ({} as any);

export const isDemoMode = isMockMode;

// Geolocation simulator for Demo mode (Inside / Outside shop coordinates)
export const demoLocationState = reactive({
  isSimulatingInside: loadStorage<boolean>('sim_inside', true)
});

export const toggleDemoLocation = (inside: boolean) => {
  demoLocationState.isSimulatingInside = inside;
  saveStorage('sim_inside', inside);
};

// Auth Functions
export const signInWithEmailAndPassword = async (_authInstance: any, email: string, pass: string): Promise<any> => {
  if (!isMockMode) {
    return fbSignIn(realAuth!, email, pass);
  }

  // For Demo Mode, let's look up the email in our mock barbers
  const barber = mockDbState.barbers.find((b) => b.email.toLowerCase() === email.toLowerCase());
  if (barber) {
    const user: MockUser = {
      uid: barber.id,
      email: barber.email,
      displayName: barber.name,
      isAnonymous: false
    };
    setMockUser(user);
    return { user };
  } else {
    throw new Error('AuthError: User not found in barber database.');
  }
};

export const signInAnonymously = async (_authInstance: any): Promise<any> => {
  if (!isMockMode) {
    return fbSignInAnonymously(realAuth!);
  }

  const anonId = 'anon_' + Math.random().toString(36).substring(2, 11);
  const user: MockUser = {
    uid: anonId,
    email: null,
    displayName: 'Cliente Anônimo',
    isAnonymous: true
  };
  setMockUser(user);
  return { user };
};

export const signOut = async (_authInstance: any): Promise<void> => {
  if (!isMockMode) {
    return fbSignOut(realAuth!);
  }
  setMockUser(null);
};

export const onAuthStateChanged = (_authInstance: any, callback: (user: any) => void): (() => void) => {
  if (!isMockMode) {
    return fbOnAuthStateChanged(realAuth!, callback);
  }
  authCallbacks.add(callback);
  // Immediate trigger
  callback(mockAuthState.currentUser);
  return () => {
    authCallbacks.delete(callback);
  };
};

// Firestore Functions
export const doc = (_dbInstance: any, collectionName: string, docId?: string): any => {
  if (!isMockMode) {
    return fbDoc(realDb!, collectionName, docId || '');
  }
  return {
    type: 'doc',
    path: `${collectionName}/${docId}`,
    collectionName,
    id: docId
  };
};

export const collection = (_dbInstance: any, collectionName: string): any => {
  if (!isMockMode) {
    return fbCollection(realDb!, collectionName);
  }
  return {
    type: 'collection',
    collectionName
  };
};

export const query = (collectionRef: any, ...constraints: any[]): any => {
  if (!isMockMode) {
    return fbQuery(collectionRef, ...constraints);
  }
  return {
    type: 'query',
    collectionName: collectionRef.collectionName,
    constraints
  };
};

export const where = (field: string, op: string, value: any): any => {
  if (!isMockMode) {
    return fbWhere(field, op as any, value);
  }
  return { type: 'where', field, op, value };
};

export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc'): any => {
  if (!isMockMode) {
    return fbOrderBy(field, direction);
  }
  return { type: 'orderBy', field, direction };
};

export const addDoc = async (collectionRef: any, data: any): Promise<any> => {
  if (!isMockMode) {
    return fbAddDoc(collectionRef, data);
  }

  const collectionName = collectionRef.collectionName;
  const newId = 'doc_' + Math.random().toString(36).substring(2, 11);
  const docData = { ...data, id: newId };

  if (collectionName === 'queue') {
    mockDbState.queue.push(docData);
  } else if (collectionName === 'barbers') {
    mockDbState.barbers.push(docData);
  }

  syncToStorage();
  return { id: newId };
};

export const updateDoc = async (docRef: any, data: any): Promise<void> => {
  if (!isMockMode) {
    return fbUpdateDoc(docRef, data);
  }

  const { path } = docRef;
  const [collectionName, docId] = path.split('/');

  if (collectionName === 'config') {
    mockDbState.config = { ...mockDbState.config, ...data };
  } else if (collectionName === 'barbers') {
    const idx = mockDbState.barbers.findIndex((b) => b.id === docId);
    if (idx !== -1) mockDbState.barbers[idx] = { ...mockDbState.barbers[idx], ...data };
  } else if (collectionName === 'queue') {
    const idx = mockDbState.queue.findIndex((q) => q.id === docId);
    if (idx !== -1) mockDbState.queue[idx] = { ...mockDbState.queue[idx], ...data };
  }

  syncToStorage();
};

export const getDoc = async (docRef: any): Promise<any> => {
  if (!isMockMode) {
    return fbGetDoc(docRef);
  }
  const data = getMockDocDataByPath(docRef.path);
  return {
    id: docRef.id,
    exists: () => data !== null,
    data: () => data
  };
};

export const getDocs = async (queryRef: any): Promise<any> => {
  if (!isMockMode) {
    return fbGetDocs(queryRef);
  }
  const collectionName = queryRef.collectionName;
  const constraints = queryRef.type === 'query' ? queryRef.constraints : [];
  const docs = getMockCollectionDocs(collectionName, constraints);

  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d,
      exists: () => true
    }))
  };
};

export const onSnapshot = (target: any, callback: SubscriberCallback): (() => void) => {
  if (!isMockMode) {
    return fbOnSnapshot(target, callback);
  }

  if (target.type === 'doc') {
    const path = target.path;
    if (!docSubscribers.has(path)) {
      docSubscribers.set(path, new Set());
    }
    docSubscribers.get(path)!.add(callback);

    // Initial trigger
    const currentData = getMockDocDataByPath(path);
    callback({
      id: target.id,
      exists: () => currentData !== null,
      data: () => currentData
    });

    return () => {
      docSubscribers.get(path)?.delete(callback);
    };
  } else {
    // Collection or Query snap
    const collectionName = target.collectionName;
    const constraints = target.type === 'query' ? target.constraints : [];

    if (!querySubscribers.has(collectionName)) {
      querySubscribers.set(collectionName, new Set());
    }
    const subObj = { constraints, callback };
    querySubscribers.get(collectionName)!.add(subObj);

    // Initial trigger
    const docs = getMockCollectionDocs(collectionName, constraints);
    callback({
      docs: docs.map((d) => ({
        id: d.id,
        data: () => d,
        exists: () => true
      }))
    });

    return () => {
      querySubscribers.get(collectionName)?.delete(subObj);
    };
  }
};
