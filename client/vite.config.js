import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Added comment to force Vite restart and clear import cache
export default defineConfig({
  plugins: [react()],
})
