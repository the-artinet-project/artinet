import { beforeAll, describe, expect, it } from '@jest/globals';
import { Agent as PiAgent } from '@mariozechner/pi-agent-core';
import { getModel } from '@mariozechner/pi-ai';
import * as sdk from '@artinet/sdk';
import { dock } from '../../src/pi/index.js';
import { INTEGRATION_TIMEOUT } from '../setup';
import { testIfApiKey, hasApiKey, baseURL, apiKey } from '../setup';

function createPiAgent(systemPrompt: string): PiAgent {
    const model = getModel('openai', 'gpt-4o-mini');
    if (baseURL) {
        model.baseUrl = baseURL;
    }

    return new PiAgent({
        initialState: {
            systemPrompt,
            model,
        },
        getApiKey: async () => apiKey,
    });
}

describe('Pi Integration', () => {
    beforeAll(() => {
        if (!hasApiKey) {
            console.log('Skipping Pi integration tests: OPENAI_API_KEY or INFERENCE_API_KEY not set');
            return;
        }

        if (baseURL) {
            console.log(`Using custom inference provider: ${baseURL}`);
        }
    });

    testIfApiKey(
        'should dock and run a real Pi agent',
        async () => {
            const piAgent = createPiAgent('You are a helpful assistant. Respond briefly.');
            const artinetAgent = await dock(piAgent, { name: 'Pi Integration Agent' });
            const result = (await artinetAgent.sendMessage(
                'What is 2 + 2? Reply with only the number.',
            )) as sdk.A2A.Task;
            expect(result).toBeDefined();
            expect(result.status.state).toBe('completed');
            expect(result.status.message?.parts).toBeDefined();
            expect(result.status.message?.parts.length).toBeGreaterThan(0);
            expect(result.status.message?.parts[0].kind).toBe('text');
            if (result.status.message?.parts[0].kind === 'text') {
                expect(result.status.message.parts[0].text).toBeDefined();
                expect(result.status.message.parts[0].text).toMatch(/4/);
            }
        },
        INTEGRATION_TIMEOUT,
    );

    testIfApiKey(
        'should preserve context across turns with real pi-agent-core agent',
        async () => {
            const piAgent = createPiAgent(
                'You are a helpful assistant. You must remember and repeat exact codes provided by the user.',
            );
            const artinetAgent = await dock(piAgent, { name: 'Pi Memory Agent' });

            const firstResult = (await artinetAgent.sendMessage(
                'Remember this code exactly: BLUE-42.',
            )) as sdk.A2A.Task;
            expect(firstResult.status.state).toBe('completed');
            const secondResult = (await artinetAgent.sendMessage(
                sdk.describe.message({
                    taskId: firstResult.id,
                    role: 'user',
                    parts: [sdk.describe.part.text('What was the code I asked you to remember? Reply in plain text.')],
                }),
            )) as sdk.A2A.Task;
            expect(secondResult.status.state).toBe('completed');
            expect(secondResult.status.message).toBeDefined();
            const textParts =
                secondResult.status.message?.parts
                    .filter((part): part is sdk.A2A.TextPart => part.kind === 'text')
                    .map((part) => part.text)
                    .join('\n') ?? '';

            if (textParts.length > 0) {
                expect(textParts).toMatch(/BLUE-42/i);
            }
        },
        INTEGRATION_TIMEOUT,
    );

    testIfApiKey('should fail when no input text is detected', async () => {
        const piAgent = createPiAgent('You are a helpful assistant.');
        const artinetAgent = await dock(piAgent, { name: 'Pi Input Validation Agent' });

        const result = (await artinetAgent.sendMessage(
            sdk.describe.message({
                role: 'user',
                parts: [],
            }),
        )) as sdk.A2A.Task;
        expect(result.status.state).toBe('failed');
        expect(result.status.message?.parts[0]).toEqual({
            kind: 'text',
            text: 'no input text detected',
        });
    });
});
