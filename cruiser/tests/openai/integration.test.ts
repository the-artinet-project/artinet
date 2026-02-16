/**
 * OpenAI Agent Integration Tests
 *
 * These tests hit real LLMs using OPENAI_API_KEY and optionally INFERENCE_PROVIDER_URL
 * for OpenRouter or other OpenAI-compatible APIs.
 * They are skipped if the API key is not available.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { Agent as OpenAIAgent, run, setDefaultOpenAIClient } from '@openai/agents';
import OpenAI from 'openai';
import { INTEGRATION_TIMEOUT } from '../setup';
import { dock } from '../../src/openai';
import * as sdk from '@artinet/sdk';
const hasApiKey = !!process.env.OPENAI_API_KEY || !!process.env.INFERENCE_API_KEY;
const baseURL = process.env.INFERENCE_PROVIDER_URL;

describe('OpenAI Integration', () => {
    beforeAll(() => {
        if (!hasApiKey) {
            console.log('Skipping OpenAI integration tests: OPENAI_API_KEY not set');
            return;
        }

        // If using OpenRouter or custom provider, set up a custom OpenAI client
        if (baseURL) {
            const client = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY ?? process.env.INFERENCE_API_KEY,
                baseURL,
            });
            setDefaultOpenAIClient(client);
            console.log(`Using custom inference provider: ${baseURL}`);
        }
    });

    it(
        'should create and run an OpenAI agent with real LLM',
        async () => {
            if (!hasApiKey) {
                console.log('Skipping: OPENAI_API_KEY not set');
                return;
            }

            // Use a model that works with OpenRouter
            const modelName = baseURL ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';

            const agent = new OpenAIAgent({
                name: 'test-assistant',
                instructions: 'You are a helpful assistant. Respond briefly.',
                model: modelName,
            });

            const artinetAgent = await dock(agent);
            const result = await artinetAgent.sendMessage('What is 2 + 2? Reply with just the number.');

            expect(result).toBeDefined();
            expect(result.status.message?.parts).toBeDefined();
            expect(result.status.message?.parts.length).toBeGreaterThan(0);
            expect(result.status.message?.parts[0].kind).toBe('text');
            expect(result.status.message?.parts[0].text).toBeDefined();
            expect(result.status.message?.parts[0].text).toMatch(/4/);
        },
        INTEGRATION_TIMEOUT,
    );

    it(
        'should handle multi-turn conversation',
        async () => {
            if (!hasApiKey) {
                console.log('Skipping: OPENAI_API_KEY not set');
                return;
            }

            const modelName = baseURL ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';

            const agent = new OpenAIAgent({
                name: 'memory-assistant',
                instructions: 'You are a helpful assistant. Remember context from previous messages.',
                model: modelName,
            });

            // First turn
            const artinetAgent = await dock(agent);
            const result1 = await artinetAgent.sendMessage('My name is Alice. Remember this.');
            expect(result1).toBeDefined();

            // Second turn with conversation history
            const result2 = await artinetAgent.sendMessage(
                sdk.describe.message({
                    taskId: (result1 as sdk.A2A.Task).id,
                    role: 'user',
                    parts: [sdk.describe.part.text('What is my name?')],
                }),
            );

            expect(result2.status.message?.parts).toBeDefined();
            expect(result2.status.message?.parts.length).toBeGreaterThan(0);
            expect(result2.status.message?.parts[0].kind).toBe('text');
            expect(result2.status.message?.parts[0].text).toBeDefined();
            expect(result2.status.message?.parts[0].text).toMatch(/Alice/i);
        },
        INTEGRATION_TIMEOUT,
    );
});
