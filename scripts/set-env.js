import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
const envPath = resolve(__dirname, '../.env');
let envFileContent = '';

try {
    envFileContent = readFileSync(envPath, 'utf8');
} catch (error) {
    console.warn('Warning: .env file not found. Using empty environment variables.');
}

// Parse .env content manually
let apiKey = '';
// Match API_KEY=value, handling optional spaces around =, and optional quotes
// Capture group 1 is the key
const apiKeyMatch = envFileContent.match(/API_KEY\s*=\s*["']?([^"'\n\r]+)["']?/);

if (apiKeyMatch && apiKeyMatch[1]) {
    apiKey = apiKeyMatch[1].trim();
    console.log(`Found API Key: ${apiKey.substring(0, 5)}...`);
} else {
    console.log('No API_KEY found in .env content');
    if (envFileContent) {
        console.log('File content length: ', envFileContent.length);
        console.log('First 50 chars: ', envFileContent.substring(0, 50).replace(/\n/g, '\\n'));
    }
}

// If not in .env, check actual process.env (for CI/CD)
if (!apiKey && process.env.API_KEY) {
    apiKey = process.env.API_KEY;
    console.log('Found API Key in process.env');
}

const targetPath = resolve(__dirname, '../src/environments/environment.ts');

const envConfigFile = `export const environment = {
  production: false,
  apiKey: '${apiKey}'
};
`;

writeFileSync(targetPath, envConfigFile);

console.log(`Output generated at ${targetPath}`);
