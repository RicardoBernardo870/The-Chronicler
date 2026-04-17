import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import { useColorMode } from '@vueuse/core'
import '@/assets/styles/main.css'
import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
import ChroniclerPreset from '@/assets/styles/preset'

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

// Default to dark mode (low-light reading environments — constitution principle)
const colorMode = useColorMode({
  attribute: 'data-p-theme',
  modes: {
    dark: 'dark',
    light: 'light',
  },
})
colorMode.value = 'dark'

app.mount('#app')
