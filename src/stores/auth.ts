import { defineStore } from "pinia";
import { ref } from "vue";
import type { AuthUser } from "@/types";
import { supabase } from "@/services/supabase";
import { clearAll } from "@/composables/useCache";

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
        // Read persisted session from localStorage synchronously before any
        // router guard evaluates authStore.user
        const {
          data: { session },
        } = await supabase.auth.getSession();
        user.value = session?.user
          ? { id: session.user.id, email: session.user.email ?? "" }
          : null;
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
