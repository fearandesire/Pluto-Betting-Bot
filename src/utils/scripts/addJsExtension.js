import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.resolve();
const TARGET_DIRS = ['src/openapi/khronos', 'src/openapi/goracle'];

function addJsExtension(filePath) {
	const data = fs.readFileSync(filePath, 'utf8');
	const result = data.replace(/from '(.*)';/g, (match, p1) => {
		if (p1.startsWith('.') && !p1.endsWith('.js')) {
			return `from '${p1}.js';`;
		}
		return match;
	});

	fs.writeFileSync(filePath, result, 'utf8');
}

function processDirectory(directory) {
	for (const file of fs.readdirSync(directory)) {
		const fullPath = path.join(directory, file);
		if (fs.statSync(fullPath).isDirectory()) {
			processDirectory(fullPath);
		} else if (fullPath.endsWith('.ts')) {
			addJsExtension(fullPath);
		}
	}
}

for (const dir of TARGET_DIRS) {
	const fullDir = path.join(__dirname, dir);
	if (!fs.existsSync(fullDir)) continue;
	processDirectory(fullDir);
}

console.log('Finished processing files.');
