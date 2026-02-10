import escapeHtml from 'escape-html';
import { ResultOrError } from './types.js';

export function sanitizeString(str: string): string {
    return escapeHtml(str).trim();
}

export function toJSONRPCResponse(
    id: string,
    result_or_error: ResultOrError,
): { jsonrpc: '2.0'; id: string; result: unknown } | { jsonrpc: '2.0'; id: string; error: unknown } {
    if (result_or_error.type === 'success') {
        return { jsonrpc: '2.0', id: sanitizeString(id), result: result_or_error.result };
    }
    if (result_or_error.type === 'error') {
        return { jsonrpc: '2.0', id: sanitizeString(id), error: result_or_error.error };
    }
    throw new Error('Invalid response type');
}
