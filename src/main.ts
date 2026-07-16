import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import '@/assets/styles/main.css'
import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
import ChroniclerPreset from '@/assets/styles/preset'

// Initialise theme from localStorage before Vue mounts — avoids flash of wrong theme.
// Defaults to 'dark' (low-light reading environments — constitution §UX).
import '@/composables/useAppTheme'

// The SW calls skipWaiting()/clients.claim(), so an updated worker takes over
// while the (stale, cache-served) page is still running — reload once so the
// user lands on the new build. `hadController` skips the very first install,
// where a reload would be pointless and jarring.
if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return
    reloaded = true
    window.location.reload()
  })
}

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ConfirmationService)
app.use(ToastService)
app.use(PrimeVue, {
  theme: {
    preset: ChroniclerPreset,
    options: {
      prefix: 'p',
      darkModeSelector: '[data-p-theme="dark"]',
      cssLayer: false,
    },
  },
})

app.mount('#app')
