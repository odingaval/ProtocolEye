import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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
if (!apiKey) {
    if (process.env.API_KEY) {
        apiKey = process.env.API_KEY;
        console.log('Found API Key in process.env.API_KEY');
    } else if (process.env.GEMINI_API_KEY) {
        apiKey = process.env.GEMINI_API_KEY;
        console.log('Found API Key in process.env.GEMINI_API_KEY');
    } else {
        console.log('API_KEY or GEMINI_API_KEY not found in process.env');
        console.log('Available keys beginning with A or G:', Object.keys(process.env).filter(k => k.startsWith('A') || k.startsWith('G')));
    }
}

const environments = [
    {
        path: '../src/environments/environment.ts',
        production: false
    },
    {
        path: '../src/environments/environment.prod.ts',
        production: true
    }
];

environments.forEach(env => {
    const targetPath = resolve(__dirname, env.path);
    const targetDir = dirname(targetPath);

    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
        console.log(`Created directory: ${targetDir}`);
    }

    const envConfigFile = `export const environment = {
  production: ${env.production},
  apiKey: '${apiKey}'
};
`;
    writeFileSync(targetPath, envConfigFile);
    console.log(`Output generated at ${targetPath}`);
});
