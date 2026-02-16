import { jest } from '@jest/globals';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
if (!Symbol.dispose) {
    (Symbol as any).dispose = Symbol.for('Symbol.dispose');
}

if (!Symbol.asyncDispose) {
    (Symbol as any).asyncDispose = Symbol.for('Symbol.asyncDispose');
}

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Prefer package-local dotenv files, then fall back to workspace-root dotenv files.
config({ path: resolve(__dirname, '.env') });
config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../../.env.local') });
config({ path: resolve(__dirname, '../../.env') });

export const hasApiKey = !!process.env.OPENAI_API_KEY || !!process.env.INFERENCE_API_KEY;
export const baseURL = process.env.INFERENCE_PROVIDER_URL;
export const apiKey = process.env.OPENAI_API_KEY ?? process.env.INFERENCE_API_KEY;
export const testIfApiKey = (testName: string, test: () => Promise<void>, timeout?: number) => {
    return it(
        testName,
        async () => {
            if (!hasApiKey) {
                console.log('hasApiKey', hasApiKey);
                console.log('Skipping: OPENAI_API_KEY or INFERENCE_API_KEY not set');
                return;
            }
            return test();
        },
        timeout,
    );
};

// Default timeout for unit tests
jest.setTimeout(10000);

// Extended timeout for integration tests (60 seconds)
export const INTEGRATION_TIMEOUT = 60000;
