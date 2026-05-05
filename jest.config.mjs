export default {
	testEnvironment: 'node',
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		// Strip .js extensions so ESM TypeScript imports resolve correctly
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: {
					// Override to CommonJS-compatible module for Jest transforms,
					// while keeping the src-level tsconfig for app code.
					module: 'ESNext',
					moduleResolution: 'Bundler',
				},
			},
		],
	},
	testMatch: ['**/__tests__/**/*.test.ts'],
}
