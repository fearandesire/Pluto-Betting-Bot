module.exports = {
	env: {
		node: true,
		browser: true,
		es2021: true,
	},
	plugins: ['mocha'],
	extends: ['airbnb-base', 'plugin:mocha/recommended', 'prettier'],
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
	},
	rules: {
		'mocha/no-skipped-tests': 'error',
		'mocha/no-exclusive-tests': 'error',
		'no-misleading-character-class': 'error',
		'import/prefer-default-export': 'off',
	},
	settings: {
		'mocha/additionalCustomNames': [
			{ name: 'describeModule', type: 'suite', interfaces: ['BDD'] },
			{ name: 'testModule', type: 'testCase', interfaces: ['TDD'] },
		],
		'import/resolver': {
			alias: {
				extensions: ['.js', '.jsx', '.es6', '.coffee'],
				paths: ['./lib/**', './utils/**/', './', './**'],
				map: [
					['#db', './Database/dbindex.js'],
					['#utilBot', './utils/bot_res'],
					['#cache', './utils/cache'],
					['#LogColor', './utils/bot_res/consoleLog.js'],
					['#Logger', './utils/logging.js'],
					['#FileRun', './utils/bot_res/classes/FileRunning.js'],
					['#embed', './utils/bot_res/embeds/embedReply.js'],
					['#env', './lib/envInit.js'],
					['#register', './utils/db/registerUser.js'],
					['#utils', './utils'],
					['util', './utils'],
					['#validateUser', './utils/cmd_res/validateUser.js'],
					['#api', './utils/api'],
					['#utilDB', './utils/db'],
					['#utilBetOps', './utils/db/betOps'],
					['#utilValidate', './utils/db/validation'],
					['#utilMatchups', './utils/db/matchupOps'],
					['#utilCurrency', './utils/db/currency'],
					['#lib', './lib'],
					['#cmdUtil', './utils/cmd_res'],
					['#botUtil', './utils/bot_res'],
					['#botClasses', './utils/bot_res/classes'],
					['#config', './lib/PlutoConfig.js'],
					['#dateUtil', './utils/date'],
					['#cacheUtil', './utils/cache'],
					['#main', './Pluto.mjs'],
					['#winstonLogger', './utils/logging.js'],
					['#mem', './utils/bot_res/memUse.js'],
					['#qBuilder', './utils/db/queryBuilder.js'],
				],
			},
		},

		overrides: [
			{
				files: ['*.js'],
				rules: {
					'import/extensions': 'off',
					'import/prefer-default-export': 'off',
					'no-restricted-syntax': 'off',
					'no-use-before-define': 'off',
				},
			},
		],
	},
}
