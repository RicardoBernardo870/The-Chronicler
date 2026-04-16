<template>
  <div class="auth-page">
    <div class="auth-card glass-surface">
      <!-- Logo / Brand -->
      <div class="auth-brand">
        <i class="pi pi-book auth-brand__icon" />
        <h1 class="auth-brand__title">The Chronicler</h1>
        <p class="auth-brand__subtitle">Your AI reading companion</p>
      </div>

      <!-- Tab switcher -->
      <div class="auth-tabs">
        <button
          class="auth-tab"
          :class="{ 'auth-tab--active': mode === 'signin' }"
          @click="mode = 'signin'"
        >Sign in</button>
        <button
          class="auth-tab"
          :class="{ 'auth-tab--active': mode === 'signup' }"
          @click="mode = 'signup'"
        >Sign up</button>
      </div>

      <!-- Error banner -->
      <Message v-if="errorMsg" severity="error" :closable="false" class="auth-error">
        {{ errorMsg }}
      </Message>

      <!-- Success banner (magic link sent) -->
      <Message v-if="magicLinkSent" severity="success" :closable="false">
        Magic link sent! Check your email.
      </Message>

      <!-- Email / Password form -->
      <form v-if="!magicLinkSent" class="auth-form" @submit.prevent="handleSubmit">
        <div class="auth-field">
          <label for="email">Email</label>
          <InputText
            id="email"
            v-model="email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
            fluid
          />
        </div>

        <div v-if="mode !== 'magic'" class="auth-field">
          <label for="password">Password</label>
          <InputText
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
            required
            fluid
          />
        </div>

        <Button
          type="submit"
          :label="submitLabel"
          :loading="authStore.loading"
          fluid
          class="auth-submit"
        />
      </form>

      <!-- Magic link toggle -->
      <button
        v-if="!magicLinkSent"
        class="auth-magic-toggle"
        type="button"
        @click="toggleMagicLink"
      >
        {{ mode === 'magic' ? '← Back to password sign in' : 'Sign in with magic link instead' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()

type Mode = 'signin' | 'signup' | 'magic'
const mode = ref<Mode>('signin')
const email = ref('')
const password = ref('')
const errorMsg = ref('')
const magicLinkSent = ref(false)

const submitLabel = computed(() => {
  if (mode.value === 'magic') return 'Send magic link'
  if (mode.value === 'signup') return 'Create account'
  return 'Sign in'
})

const toggleMagicLink = () => {
  mode.value = mode.value === 'magic' ? 'signin' : 'magic'
  errorMsg.value = ''
}

const handleSubmit = async () => {
  errorMsg.value = ''
  try {
    if (mode.value === 'magic') {
      await authStore.sendMagicLink(email.value)
      magicLinkSent.value = true
    } else if (mode.value === 'signup') {
      await authStore.signUp(email.value, password.value)
      await router.push('/')
    } else {
      await authStore.signIn(email.value, password.value)
      await router.push('/')
    }
  } catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.auth-brand {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.auth-brand__icon {
  font-size: 2.5rem;
  opacity: 0.85;
}

.auth-brand__title {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.auth-brand__subtitle {
  font-size: 0.875rem;
  opacity: 0.5;
}

.auth-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 3px;
  gap: 3px;
}

.auth-tab {
  flex: 1;
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
  opacity: 0.5;
}

.auth-tab--active {
  background: rgba(255, 255, 255, 0.12);
  opacity: 1;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.auth-field label {
  font-size: 0.8125rem;
  font-weight: 500;
  opacity: 0.65;
}

.auth-submit {
  margin-top: 0.25rem;
}

.auth-magic-toggle {
  background: none;
  border: none;
  color: inherit;
  font-size: 0.8125rem;
  opacity: 0.5;
  cursor: pointer;
  text-align: center;
  text-decoration: underline;
  text-underline-offset: 3px;
  padding: 0;
  transition: opacity 0.2s;
}

.auth-magic-toggle:hover {
  opacity: 0.8;
}

.auth-error {
  margin: 0;
}
</style>
