import { execSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Get git commit hash at build time
const getGitHash = () => {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim()
	} catch {
		return 'dev'
	}
}

export default defineConfig({
	plugins: [react(), tailwindcss()],
	base: '/bdm-enhancement-sim-react/',
	resolve: {
		alias: {
			'@': '/src',
		},
	},
	define: {
		__BUILD_VERSION__: JSON.stringify(getGitHash()),
		__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
	},
	build: {
		target: 'esnext',
		minify: 'esbuild',
	},
	worker: {
		format: 'es',
	},
})
