import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function findRootDir(currentPath: string): string {
	const packagePath = join(currentPath, 'package.json');
	try {
		// Try to read package.json to verify it exists
		readFileSync(packagePath);
		return currentPath;
	} catch {
		const parentDir = dirname(currentPath);
		// If we've reached the root directory and still haven't found package.json
		if (parentDir === currentPath) {
			throw new Error('Could not find project root directory');
		}
		return findRootDir(parentDir);
	}
}

function getPackageVersion(): string {
	try {
		const currentDir = dirname(fileURLToPath(import.meta.url));
		const rootDir = findRootDir(currentDir);
		const packagePath = join(rootDir, 'package.json');
		const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
		return packageJson.version;
	} catch (error) {
		if (error instanceof Error) {
			console.error('Error reading package version:', error.message);
		}
		return 'unknown';
	}
}

export const APP_VERSION = getPackageVersion();
