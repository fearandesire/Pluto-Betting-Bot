import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts'],
		alias: {
			'@khronos-index': path.resolve(__dirname, './src/openapi/khronos/index.ts'),
			'@kh-openapi': path.resolve(__dirname, './src/openapi/khronos/index.ts'),
			'@pluto-config': path.resolve(__dirname, './src/lib/PlutoConfig.ts'),
			'#lib': path.resolve(__dirname, './src/lib'),
		},
	},
	resolve: {
		alias: {
			'@khronos-index': path.resolve(__dirname, './src/openapi/khronos/index.ts'),
			'@kh-openapi': path.resolve(__dirname, './src/openapi/khronos/index.ts'),
			'@pluto-config': path.resolve(__dirname, './src/lib/PlutoConfig.ts'),
			'#lib': path.resolve(__dirname, './src/lib'),
		},
	},
})
