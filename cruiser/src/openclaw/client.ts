import { v4 as uuidv4 } from 'uuid';
import { WebSocket as NodeWebSocket } from 'ws';
import {
    createSignedDevicePayload,
    persistConnectAuth,
    readStoredAuth,
    resolveAuthFilePath,
    resolveOrCreateDeviceIdentity,
} from './auth.js';
import type { OpenClawAgent, OpenClawResult } from './utils.js';

const WebSocketImpl = (globalThis.WebSocket ?? (NodeWebSocket as unknown as typeof WebSocket));

type OpenClawResponseFrame = {
    type: 'res';
    id: string;
    ok: boolean;
    payload?: unknown;
    error?: { message?: string };
};

type PendingRequest = {
    expectFinal: boolean;
    resolve: (payload: unknown) => void;
    reject: (error: Error) => void;
};

export class OpenClawGatewayClient {
    private readonly url: string;
    private readonly authToken?: string;
    private readonly authPassword?: string;
    private readonly device?: OpenClawAgent['device'];
    private readonly deviceIdentity?;
    private readonly authFilePath: string | undefined;
    private readonly scopes: string[];
    private readonly connectTimeoutMs: number;
    private readonly clientId: string;

    private socket: WebSocket | undefined;
    private connectPromise: Promise<void> | undefined;
    private isConnected = false;
    private connectRequestId: string | undefined;
    private pendingRequests = new Map<string, PendingRequest>();

    constructor({
        url,
        authToken,
        authPassword,
        agent,
        device,
        scopes,
        connectTimeoutMs,
    }: {
        url: string;
        authToken?: string;
        authPassword?: string;
        agent: OpenClawAgent;
        device?: OpenClawAgent['device'];
        scopes?: string[];
        connectTimeoutMs: number;
    }) {
        this.url = url;
        this.authFilePath = resolveAuthFilePath(agent);
        const storedAuth = readStoredAuth(this.authFilePath);
        this.authToken = authToken ?? storedAuth?.tokens?.operator?.token;
        this.authPassword = authPassword;
        this.device = device;
        this.deviceIdentity = resolveOrCreateDeviceIdentity({ agent, authFilePath: this.authFilePath });
        const requestedScopes = scopes ?? [];
        const requiredScopes = ['operator.read', 'operator.write'];
        this.scopes = Array.from(new Set([...requiredScopes, ...requestedScopes]));
        this.connectTimeoutMs = connectTimeoutMs;
        this.clientId = uuidv4();
    }

    public async ensureConnected(): Promise<void> {
        if (this.isConnected && this.socket?.readyState === WebSocketImpl.OPEN) {
            return;
        }

        if (this.connectPromise) {
            return this.connectPromise;
        }

        this.connectPromise = new Promise<void>((resolve, reject) => {
            const socket = new WebSocketImpl(this.url);
            this.socket = socket;

            const connectTimeout = setTimeout(() => {
                reject(new Error('OpenClaw gateway connect timeout'));
            }, this.connectTimeoutMs);

            let challengeFallback: ReturnType<typeof setTimeout> | undefined;

            function cleanupConnect(): void {
                clearTimeout(connectTimeout);
                if (challengeFallback) {
                    clearTimeout(challengeFallback);
                    challengeFallback = undefined;
                }
            }

            socket.onopen = () => {
                challengeFallback = setTimeout(() => {
                    this.sendConnectRequest();
                }, 1_000);
            };

            socket.onmessage = (event: MessageEvent<string>) => {
                this.handleMessage(event.data, resolve, reject, cleanupConnect);
            };

            socket.onerror = () => {
                cleanupConnect();
                reject(new Error('OpenClaw gateway socket error'));
            };

            socket.onclose = () => {
                this.isConnected = false;
                this.connectPromise = undefined;
                this.connectRequestId = undefined;
                this.socket = undefined;
                this.rejectAllPending(new Error('OpenClaw gateway socket closed'));
            };
        })
            .catch((error: unknown) => {
                this.connectPromise = undefined;
                throw error;
            })
            .then(() => undefined);

        return this.connectPromise;
    }

    public async requestAgentRun({
        message,
        agentId,
        sessionKey,
        timeoutMs,
    }: {
        message: string;
        agentId: string;
        sessionKey?: string;
        timeoutMs: number;
    }): Promise<OpenClawResult> {
        await this.ensureConnected();

        const requestId = uuidv4();
        const idempotencyKey = uuidv4();
        const frame = {
            type: 'req',
            id: requestId,
            method: 'agent',
            params: {
                message,
                agentId,
                sessionKey,
                deliver: false,
                idempotencyKey,
            },
        };

        const responsePromise = new Promise<unknown>((resolve, reject) => {
            this.pendingRequests.set(requestId, {
                expectFinal: true,
                resolve,
                reject,
            });
        });

        this.sendFrame(frame);

        const timeout = new Promise<never>((_, reject) => {
            setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('OpenClaw gateway request timeout'));
            }, timeoutMs);
        });

        const payload = (await Promise.race([responsePromise, timeout])) as {
            result?: OpenClawResult;
            status?: string;
            error?: { message?: string };
        };

        if (payload.status && payload.status !== 'ok') {
            const details = payload.error?.message ?? 'unknown error';
            throw new Error(`OpenClaw agent failed: ${payload.status}: ${details}`);
        }

        return (payload.result ?? payload) as OpenClawResult;
    }

    private handleMessage(
        raw: string,
        connectResolve: () => void,
        connectReject: (reason?: unknown) => void,
        cleanupConnect: () => void,
    ): void {
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return;
        }

        const frame = parsed as {
            type?: string;
            event?: string;
            id?: string;
            payload?: { nonce?: string };
        };

        if (frame.type === 'event' && frame.event === 'connect.challenge') {
            this.sendConnectRequest(frame.payload?.nonce);
            return;
        }

        if (frame.type !== 'res' || !frame.id) {
            return;
        }

        const response = parsed as OpenClawResponseFrame;
        if (frame.id === this.connectRequestId) {
            cleanupConnect();
            if (!response.ok) {
                connectReject(new Error(response.error?.message ?? 'OpenClaw gateway connect rejected'));
                return;
            }

            persistConnectAuth({
                authFilePath: this.authFilePath,
                payload: response.payload,
                scopes: this.scopes,
                deviceIdentity: this.deviceIdentity,
            });

            this.isConnected = true;
            connectResolve();
            return;
        }

        const pending = this.pendingRequests.get(frame.id);
        if (!pending) {
            return;
        }

        const payload = response.payload as { status?: string } | undefined;
        if (pending.expectFinal && payload?.status === 'accepted') {
            return;
        }

        this.pendingRequests.delete(frame.id);

        if (!response.ok) {
            pending.reject(new Error(response.error?.message ?? 'OpenClaw gateway request failed'));
            return;
        }

        pending.resolve(response.payload);
    }

    private sendConnectRequest(nonce?: string): void {
        if (this.connectRequestId) {
            return;
        }

        const params: Record<string, unknown> = {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
                id: 'cli',
                displayName: 'cruiser-openclaw',
                version: '0.1.5',
                platform: 'node',
                mode: 'cli',
                instanceId: this.clientId,
            },
            role: 'operator',
            scopes: this.scopes,
            caps: [],
            commands: [],
            permissions: {},
            locale: 'en-US',
            userAgent: 'artinet-cruiser/openclaw',
        };

        if (this.authToken || this.authPassword) {
            params.auth = {
                ...(this.authToken ? { token: this.authToken } : {}),
                ...(this.authPassword ? { password: this.authPassword } : {}),
            };
        }

        const signedDevice = this.deviceIdentity
            ? createSignedDevicePayload({
                  identity: this.deviceIdentity,
                  scopes: this.scopes,
                  token: this.authToken,
                  nonce,
              })
            : undefined;

        if (signedDevice) {
            params.device = signedDevice;
        } else if (this.device) {
            const deviceNonce = nonce ?? this.device.nonce;
            params.device = {
                id: this.device.id,
                publicKey: this.device.publicKey,
                signature: this.device.signature,
                signedAt: this.device.signedAt,
                ...(deviceNonce ? { nonce: deviceNonce } : {}),
            };
        }

        const requestId = uuidv4();
        this.connectRequestId = requestId;
        this.sendFrame({
            type: 'req',
            id: requestId,
            method: 'connect',
            params,
        });
    }

    private sendFrame(frame: unknown): void {
        if (!this.socket || this.socket.readyState !== WebSocketImpl.OPEN) {
            throw new Error('OpenClaw gateway is not connected');
        }

        this.socket.send(JSON.stringify(frame));
    }

    private rejectAllPending(error: Error): void {
        for (const pending of this.pendingRequests.values()) {
            pending.reject(error);
        }
        this.pendingRequests.clear();
    }
}
