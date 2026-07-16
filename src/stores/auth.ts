import { defineStore } from "pinia";
import { ref } from "vue";
import type { AuthUser } from "@/types";
import { supabase } from "@/services/supabase";
import { clearAll } from "@/composables/useCache";

// supabase.auth.getSession() refreshes an expired access token over the
// network; with no connectivity supabase-js retries with backoff and the
// promise can stall for a long time. The router guard awaits initialize(),
// so an offline cold start (e.g. airplane mode after >1h away) would hang
// the whole app on a blank screen. Bound the wait and fall back to the last
// known user — server-side RLS still protects all data if the session was
// actually revoked.
const GET_SESSION_TIMEOUT_MS = 3000;

// Lightweight mirror of the signed-in user, maintained on every auth change,
// used only as the offline fallback above.
const USER_SNAPSHOT_KEY = "bookhero-auth-user";

const persistUserSnapshot = (u: AuthUser | null): void => {
  try {
    if (u) localStorage.setItem(USER_SNAPSHOT_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_SNAPSHOT_KEY);
  } catch {
    /* storage unavailable — snapshot is best-effort */
  }
};

const readUserSnapshot = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const loading = ref(false);
  const ready = ref(false);

  // Cached promise so initialize() is idempotent — safe to call from both
  // the router guard and App.vue without duplicating work or subscriptions.
  let _initPromise: Promise<void> | null = null;
  let _unsubscribe: (() => void) | null = null;

  const initialize = (): Promise<void> => {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
      loading.value = true;
      try {
        // Read persisted session from localStorage before any router guard
        // evaluates authStore.user. Raced against a timeout: if the token is
        // expired and we're offline, the refresh inside getSession() stalls.
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), GET_SESSION_TIMEOUT_MS),
          ),
        ]);
        if (result) {
          const session = result.data.session;
          user.value = session?.user
            ? { id: session.user.id, email: session.user.email ?? "" }
            : null;
          persistUserSnapshot(user.value);
        } else {
          // getSession stalled (offline token refresh) — trust the last known
          // user so the app boots; onAuthStateChange corrects it if the
          // refresh eventually completes.
          user.value = readUserSnapshot();
        }
        ready.value = true;
      } finally {
        loading.value = false;
      }

      // Subscribe AFTER ready=true so guard won't re-run with stale state
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        const newUser = session?.user
          ? { id: session.user.id, email: session.user.email ?? "" }
          : null;
        // Clear the SWR cache on every user identity change (FR-008 / SC-005).
        // This covers sign-out (id → null), sign-in (null → id), and
        // account switches (id-A → id-B). Clearing an empty cache is a no-op.
        if (user.value?.id !== newUser?.id) clearAll();
        user.value = newUser;
        persistUserSnapshot(newUser);
      });
      _unsubscribe = () => subscription.unsubscribe();
    })();
    return _initPromise;
  };

  // Call from App.vue onUnmounted to clean up the auth listener
  const dispose = () => {
    _unsubscribe?.();
    _unsubscribe = null;
    _initPromise = null;
    ready.value = false;
  };

  const signIn = async (email: string, password: string) => {
    loading.value = true;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } finally {
      loading.value = false;
    }
  };

  const signUp = async (email: string, password: string) => {
    loading.value = true;
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    } finally {
      loading.value = false;
    }
  };

  const sendMagicLink = async (email: string) => {
    loading.value = true;
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
    } finally {
      loading.value = false;
    }
  };

  const signOut = async () => {
    loading.value = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      user.value = null;
    } finally {
      loading.value = false;
    }
  };

  return {
    user,
    loading,
    ready,
    initialize,
    dispose,
    signIn,
    signUp,
    sendMagicLink,
    signOut,
  };
});
