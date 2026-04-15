import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AuthUser } from '@/types'
import { supabase } from '@/services/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)

  async function initialize() {
    loading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        user.value = { id: session.user.id, email: session.user.email ?? '' }
      }
    } finally {
      loading.value = false
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user
        ? { id: session.user.id, email: session.user.email ?? '' }
        : null
    })
  }

  async function signIn(email: string, password: string) {
    loading.value = true
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } finally {
      loading.value = false
    }
  }

  async function signUp(email: string, password: string) {
    loading.value = true
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
    } finally {
      loading.value = false
    }
  }

  async function sendMagicLink(email: string) {
    loading.value = true
    try {
      const { error } = await supabase.auth.signInWithOtp({ email })
      if (error) throw error
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    loading.value = true
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      user.value = null
    } finally {
      loading.value = false
    }
  }

  return { user, loading, initialize, signIn, signUp, sendMagicLink, signOut }
})
