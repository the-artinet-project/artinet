import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { OpenClawAgent } from './utils.js';

type StoredAuthFile = {
    version: 1;
    device?: {
        id: string;
        publicKey: string;
        privateKeyPem: string;
    };
    tokens?: {
        operator?: {
            token: string;
            role?: string;
            scopes?: string[];
            updatedAtMs: number;
        };
    };
};

export type ResolvedDeviceIdentity = {
    id: string;
    publicKey: string;
    privateKeyPem: string;
};

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function base64UrlEncode(buffer: Buffer): string {
    return buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function derivePublicKeyRawFromPem(publicKeyPem: string): Buffer {
    const key = createPublicKey(publicKeyPem);
    const spki = key.export({ type: 'spki', format: 'der' }) as Buffer;
    if (
        spki.length === ED25519_SPKI_PREFIX.length + 32 &&
        spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
    ) {
        return spki.subarray(ED25519_SPKI_PREFIX.length);
    }

    return spki;
}

function fingerprintPublicKey(publicKeyBase64Url: string): string {
    return createHash('sha256')
        .update(Buffer.from(publicKeyBase64Url.replaceAll('-', '+').replaceAll('_', '/'), 'base64'))
        .digest('hex');
}

function buildDeviceAuthPayload({
    version,
    deviceId,
    clientId,
    clientMode,
    role,
    scopes,
    signedAt,
    token,
    nonce,
}: {
    version: 'v1' | 'v2';
    deviceId: string;
    clientId: string;
    clientMode: string;
    role: string;
    scopes: string[];
    signedAt: number;
    token?: string;
    nonce?: string;
}): string {
    const base = [version, deviceId, clientId, clientMode, role, scopes.join(','), String(signedAt), token ?? ''];
    if (version === 'v2') {
        base.push(nonce ?? '');
    }
    return base.join('|');
}

export function resolveAuthFilePath(agent: OpenClawAgent): string | undefined {
    if (agent.autoDeviceAuth === false) {
        return undefined;
    }

    if (agent.authFilePath && agent.authFilePath.trim().length > 0) {
        return agent.authFilePath.trim();
    }

    return join(homedir(), 'artinet-openclaw.auth');
}

export function readStoredAuth(path: string | undefined): StoredAuthFile | undefined {
    if (!path || !existsSync(path)) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as StoredAuthFile;
        if (parsed.version !== 1) {
            return undefined;
        }
        return parsed;
    } catch {
        return undefined;
    }
}

export function writeStoredAuth(path: string | undefined, auth: StoredAuthFile): void {
    if (!path) {
        return;
    }

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(auth, null, 2)}\n`, { encoding: 'utf8' });
}

export function resolveOrCreateDeviceIdentity({
    agent,
    authFilePath,
}: {
    agent: OpenClawAgent;
    authFilePath: string | undefined;
}): ResolvedDeviceIdentity | undefined {
    const manual = agent.device;
    if (manual?.id && manual.publicKey && manual.privateKeyPem) {
        return {
            id: manual.id,
            publicKey: manual.publicKey,
            privateKeyPem: manual.privateKeyPem,
        };
    }

    const stored = readStoredAuth(authFilePath);
    if (stored?.device?.id && stored.device.publicKey && stored.device.privateKeyPem) {
        return stored.device;
    }

    if (agent.autoDeviceAuth === false) {
        return undefined;
    }

    const keyPair = generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privateKeyPem = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKey = base64UrlEncode(derivePublicKeyRawFromPem(publicKeyPem));
    const identity: ResolvedDeviceIdentity = {
        id: fingerprintPublicKey(publicKey),
        publicKey,
        privateKeyPem,
    };

    const nextAuth: StoredAuthFile = stored ?? { version: 1 };
    nextAuth.device = identity;
    writeStoredAuth(authFilePath, nextAuth);
    return identity;
}

export function createSignedDevicePayload({
    identity,
    scopes,
    token,
    nonce,
}: {
    identity: ResolvedDeviceIdentity;
    scopes: string[];
    token?: string;
    nonce?: string;
}): { id: string; publicKey: string; signature: string; signedAt: number; nonce?: string } {
    const signedAt = Date.now();
    const version = nonce ? 'v2' : 'v1';
    const payload = buildDeviceAuthPayload({
        version,
        deviceId: identity.id,
        clientId: 'cli',
        clientMode: 'cli',
        role: 'operator',
        scopes,
        signedAt,
        token,
        nonce,
    });
    const signature = base64UrlEncode(sign(null, Buffer.from(payload, 'utf8'), createPrivateKey(identity.privateKeyPem)));

    return {
        id: identity.id,
        publicKey: identity.publicKey,
        signature,
        signedAt,
        ...(nonce ? { nonce } : {}),
    };
}

export function persistConnectAuth({
    authFilePath,
    payload,
    scopes,
    deviceIdentity,
}: {
    authFilePath: string | undefined;
    payload: unknown;
    scopes: string[];
    deviceIdentity?: ResolvedDeviceIdentity;
}): void {
    if (!authFilePath) {
        return;
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return;
    }

    const record = payload as Record<string, unknown>;
    const auth = record.auth;
    if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
        return;
    }

    const authRecord = auth as Record<string, unknown>;
    const deviceToken = authRecord.deviceToken;
    if (typeof deviceToken !== 'string' || deviceToken.trim().length === 0) {
        return;
    }

    const role = typeof authRecord.role === 'string' ? authRecord.role : 'operator';
    const resolvedScopes = Array.isArray(authRecord.scopes)
        ? authRecord.scopes.filter((scope: unknown): scope is string => typeof scope === 'string')
        : scopes;

    const existing = readStoredAuth(authFilePath) ?? { version: 1 as const };
    const next: StoredAuthFile = {
        ...existing,
        tokens: {
            ...(existing.tokens ?? {}),
            operator: {
                token: deviceToken,
                role,
                scopes: resolvedScopes,
                updatedAtMs: Date.now(),
            },
        },
    };

    if (deviceIdentity) {
        next.device = deviceIdentity;
    }

    writeStoredAuth(authFilePath, next);
}
