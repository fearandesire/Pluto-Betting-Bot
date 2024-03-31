module.exports = {
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: 'tsconfig.json',
		tsconfigRootDir: __dirname,
		sourceType: 'module',
	},

	plugins: ['@typescript-eslint/eslint-plugin'],
	extends: [
		'plugin:@typescript-eslint/recommended',
		'plugin:prettier/recommended',
	],
	root: true,
	env: {
		node: true,
		jest: true,
	},
	ignorePatterns: ['.eslintrc.cjs', 'node_modules/**/*', 'dist/**/*'],
	rules: {
		'@typescript-eslint/interface-name-prefix': 'off',
		'@typescript-eslint/explicit-function-return-type':
			'off',
		'@typescript-eslint/explicit-module-boundary-types':
			'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'object-curly-newline': 'off',
	},
	settings: {
		'import/resolver': {
			node: {
				extensions: ['.js', '.jsx'],
			},
			alias: {
				extensions: [
					'.js',
					'.jsx',
					'.es6',
					'.coffee',
				],
				paths: [
					'./lib/**',
					'./utils/**/',
					'./',
					'./**',
				],
				map: [
					['#db', './database/dbindex.js'],
					['#utilBot', './utils/bot_res'],
					['#cache', './utils/cache'],
					[
						'#LogColor',
						'./utils/bot_res/consoleLog.js',
					],
					['#Logger', './utils/logging.js'],
					[
						'#FileRun',
						'./utils/bot_res/classes/FileRunning.js',
					],
					[
						'#embed',
						'./utils/bot_res/embeds/embedReply.js',
					],
					['#env', './lib/envInit.js'],
					[
						'#register',
						'./utils/db/registerUser.js',
					],
					['#utils', './utils'],
					['util', './utils'],
					[
						'#validateUser',
						'./utils/cmd_res/validateUser.js',
					],
					['#api', './utils/api'],
					['#utilDB', './utils/db'],
					['#utilBetOps', './utils/db/betOps'],
					[
						'#utilValidate',
						'./utils/db/validation',
					],
					[
						'#utilMatchups',
						'./utils/db/matchupOps',
					],
					[
						'#utilCurrency',
						'./utils/db/currency',
					],
					['#lib', './lib'],
					['#cmdUtil', './utils/cmd_res'],
					['#botUtil', './utils/bot_res'],
					[
						'#botClasses',
						'./utils/bot_res/classes',
					],
					[
						'@pluto-core-config',
						'./lib/PlutoConfig.js',
					],
					['#dateUtil', './utils/date'],
					['#cacheUtil', './utils/cache'],
					['@pluto-core', './dist/Pluto.js'],
					[
						'#winstonLogger',
						'./utils/logging.js',
					],
					[
						'#qBuilder',
						'./utils/db/queryBuilder.js',
					],
				],
			},
		},
	},
	overrides: [
		{
			files: ['**/*.test.js', '*.js', '*.mjs'],
			rules: {
				'no-console': 'off',
				'no-await-in-loop': 'off',
				'import/extensions': 'off',
				'import/no-unresolved': 'off',
				'import/prefer-default-export': 'off',
				'no-restricted-syntax': 'off',
				'no-use-before-define': 'off',
				'mocha/no-global-tests': 'off',
				'class-methods-use-this': 'off',
			},
		},
	],
}
