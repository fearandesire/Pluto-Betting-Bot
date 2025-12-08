#!/usr/bin/env node

import { execSync } from 'node:child_process';

try {
	const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACMR', {
		encoding: 'utf-8',
	})
		.split('\n')
		.filter(Boolean)
		.filter((file) => /\.(js|ts|jsx|tsx)$/.test(file));

	if (stagedFiles.length === 0) {
		process.exit(0);
	}

	const modifiedFiles = execSync('git diff --name-only', { encoding: 'utf-8' })
		.split('\n')
		.filter(Boolean)
		.filter((file) => /\.(js|ts|jsx|tsx)$/.test(file));

	const filesToStage = stagedFiles.filter((file) => modifiedFiles.includes(file));

	if (filesToStage.length > 0) {
		for (const file of filesToStage) {
			execSync(`git add "${file}"`, { stdio: 'inherit' });
		}
	}
} catch (error) {
	console.error('Error staging formatted files:', error.message);
	process.exit(1);
}
