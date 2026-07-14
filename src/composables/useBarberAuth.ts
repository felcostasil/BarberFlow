import { ref, onMounted, onUnmounted } from 'vue';
import { auth, onAuthStateChanged } from '../services/firebase';

/**
 * Reactive composable that tracks the currently authenticated barber user.
 *
 * Resolves bugs #3 and #4:
 * - Bug #3: Previously, AdminQueue read auth.currentUser directly in onMounted,
 *   which is not reactive. When a different barber logged in, the component
 *   retained the old user's data without a page refresh.
 * - Bug #4: On mobile, there was a race condition where onMounted ran before
 *   the auth state had propagated, causing currentUser to be null and the
 *   component to silently skip all Firestore subscriptions.
 *
 * By using onAuthStateChanged, the component reacts correctly to auth
 * state changes both on initial load and on subsequent logins.
 */
export function useBarberAuth() {
  const currentUser = ref<any>(null);
  const isAuthReady = ref(false);

  let unsubscribe: () => void = () => {};

  onMounted(() => {
    unsubscribe = onAuthStateChanged(auth, (user) => {
      currentUser.value = user;
      isAuthReady.value = true;
    });
  });

  onUnmounted(() => {
    unsubscribe();
  });

  return { currentUser, isAuthReady };
}
