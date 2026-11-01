import {
  defineConfig,
  minimal2023Preset as preset,
} from '@vite-pwa/assets-generator/config'

// Generates the PWA icons (favicon, apple-touch-icon, 64/192/512 px, maskable) from public/logo.svg
export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset,
  images: ['public/logo.svg'],
})
