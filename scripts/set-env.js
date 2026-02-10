import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Prioritize process.env (Vercel's way)
let apiKey = process.env.API_KEY || '';

// 2. Fallback to .env (Local way)
if (!apiKey) {
    const envPath = resolve(__dirname, '../.env');
    try {
        const envFileContent = readFileSync(envPath, 'utf8');
        const apiKeyMatch = envFileContent.match(/API_KEY\s*=\s*["']?([^"'\n\r]+)["']?/);
        if (apiKeyMatch && apiKeyMatch[1]) {
            apiKey = apiKeyMatch[1].trim();
            console.log(`Found API Key in .env: ${apiKey.substring(0, 5)}...`);
        }
    } catch (error) {
        // .env not found, which is normal on Vercel
    }
}

if (apiKey) {
    console.log(`Final API Key set: ${apiKey.substring(0, 5)}...`);
} else {
    console.warn('CRITICAL: No API_KEY found. Application will run in restricted mode.');
}

const targetPath = resolve(__dirname, '../src/environments/environment.ts');
const targetDir = dirname(targetPath);

// Ensure directory exists
try { mkdirSync(targetDir, { recursive: true }); } catch (err) { }

const buildTime = new Date().toLocaleString();
const envConfigFile = `export const environment = {
  production: true,
  apiKey: '${apiKey}',
  buildTimestamp: '${buildTime}'
};
`;

writeFileSync(targetPath, envConfigFile);
console.log(`Environment generated at ${targetPath} (Build: ${buildTime})`);
