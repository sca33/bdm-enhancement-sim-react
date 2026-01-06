import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [react(), tailwindcss()],
	base: '/bdm-enhancement-sim-react/',
	resolve: {
		alias: {
			'@': '/src',
		},
	},
	build: {
		target: 'esnext',
		minify: 'esbuild',
	},
})
