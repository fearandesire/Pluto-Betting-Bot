module.exports = {
	extends: ['@commitlint/config-conventional'],
	ignores: [
		(message) => message.includes('Merge branch'),
		(message) => message.includes('Merge pull request'),
		(message) => /^(fixup|squash)!/.test(message),
		(message) => message.includes('Signed-off-by: dependabot[bot]'),
		(message) => message.includes('chore(release):'),
		// PR-style subject line (e.g. "Replace X with Y in Z (#392)") without conventional type
		(message) => {
			const firstLine = (message || '').split('\n')[0] ?? '';
			const endsWithPrRef = /\(#\d+\)\s*$/.test(firstLine);
			const hasConventionalType = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]*\))?!?:\s/.test(firstLine);
			return endsWithPrRef && !hasConventionalType;
		},
	],
	rules: {
		'type-enum': [
			2,
			'always',
			[
				'feat',
				'fix',
				'docs',
				'style',
				'refactor',
				'perf',
				'test',
				'build',
				'ci',
				'chore',
				'revert',
				'hotfix',
				'patch',
			],
		],
		'subject-empty': [2, 'never'],
		'subject-case': [2, 'never', ['upper-case', 'pascal-case']],
		'header-max-length': [2, 'always', 100],
		'body-max-line-length': [1, 'always', 100],
	},
}
