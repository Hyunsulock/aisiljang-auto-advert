import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { resolve } from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [viteReact(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  esbuild: {
    // production에서도 React DevTools 사용 가능하도록 설정
    drop: [], // console, debugger 제거 안함
  },
  build: {
    minify: 'esbuild',
    sourcemap: true, // 소스맵 생성으로 디버깅 용이
  },
})
