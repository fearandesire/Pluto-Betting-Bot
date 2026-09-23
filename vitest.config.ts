import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Production runs in UTC (no TZ set); make date-formatting tests match it on any machine.
process.env.TZ = 'UTC'

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts', 'scripts/**/*.test.ts'],
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
