import fs from 'node:fs';
import path from 'node:path';

// Define __dirname
const __dirname = path.resolve();
const directoryPath = path.join(__dirname, 'src/openapi/khronos'); // Path to your generated code

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
			processDirectory(fullPath); // Recurse into directories
		} else if (fullPath.endsWith('.ts')) {
			addJsExtension(fullPath); // Process TypeScript files
		}
	}
}

processDirectory(directoryPath);

console.log('Finished processing files.');
