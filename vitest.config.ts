import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts'],
		alias: {
			'@pluto-config': path.resolve(__dirname, './src/lib/PlutoConfig.ts'),
			'#lib': path.resolve(__dirname, './src/lib'),
		},
	},
	resolve: {
		alias: {
			'@pluto-config': path.resolve(__dirname, './src/lib/PlutoConfig.ts'),
			'#lib': path.resolve(__dirname, './src/lib'),
		},
	},
})
