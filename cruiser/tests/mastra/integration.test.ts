/**
 * Mastra Agent Integration Tests
 *
 * These tests hit real LLMs using OPENAI_API_KEY and optionally INFERENCE_PROVIDER_URL
 * for OpenRouter or other OpenAI-compatible APIs.
 * They are skipped if the API key is not available.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { Agent as MastraAgent } from '@mastra/core/agent';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { dock } from '../../src/mastra';
import { INTEGRATION_TIMEOUT } from '../setup';
import { hasApiKey, baseURL, apiKey, testIfApiKey } from '../setup';

describe('Mastra Integration', () => {
    beforeAll(() => {
        if (!hasApiKey) {
            console.log('Skipping Mastra integration tests: OPENAI_API_KEY not set');
        }
        if (baseURL) {
            console.log(`Using custom inference provider: ${baseURL}`);
        }
    });

    testIfApiKey(
        'should create and run a Mastra agent with real LLM',
        async () => {
            const openai = createOpenRouter({
                apiKey: apiKey,
                ...(baseURL && { baseURL }),
            });

            // Use OpenRouter model format if using custom provider
            const modelName = baseURL ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';

            const agent = new MastraAgent({
                id: 'test-mastra-agent',
                name: 'test-mastra-agent',
                instructions: 'You are a helpful assistant. Respond briefly.',
                model: openai(modelName),
            });

            const artinetAgent = await dock(agent);
            const result = await artinetAgent.sendMessage('What is 3 + 5? Reply with just the number.');
            expect(result).toBeDefined();
            expect(result.status.message?.parts).toBeDefined();
            expect(result.status.message?.parts.length).toBeGreaterThan(0);

            const lastMessage = result.status.message?.parts[result.status.message?.parts.length - 1];
            expect(lastMessage?.kind).toBe('text');
            expect(lastMessage?.text).toBeDefined();
            expect(lastMessage?.text).toMatch(/8/);
        },
        INTEGRATION_TIMEOUT,
    );

    testIfApiKey(
        'should include usage metadata in response',
        async () => {
            const openai = createOpenRouter({
                apiKey: apiKey,
                ...(baseURL && { baseURL }),
            });

            const modelName = baseURL ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';

            const agent = new MastraAgent({
                id: 'usage-test-agent',
                name: 'usage-test-agent',
                instructions: 'You are a helpful assistant.',
                model: openai(modelName),
            });

            const artinetAgent = await dock(agent);
            const result = await artinetAgent.sendMessage('Say hello');

            expect(result).toBeDefined();
            expect(result.status.message?.parts).toBeDefined();
            expect(result.status.message?.parts.length).toBeGreaterThan(0);
            expect(result.status.message?.metadata).toBeDefined();
            expect(result.status.message?.metadata?.execution?.usage).toBeDefined();
            expect(result.status.message?.metadata?.execution?.finishReason).toBeDefined();
        },
        INTEGRATION_TIMEOUT,
    );
});
