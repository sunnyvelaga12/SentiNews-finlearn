import { apiClient } from './apiClient';
const SENSITIVE_KEYS = new Set([
    'password',
    'token',
    'access_token',
    'refresh_token',
    'secret',
    'authorization',
    'credit_card',
    'ssn',
]);
function sanitizeProperties(props) {
    const sanitized = {};
    for (const [key, value] of Object.entries(props)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            sanitized[key] = '[REDACTED]';
        }
        else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            sanitized[key] = sanitizeProperties(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
export class TelemetryService {
    static instance;
    queue = [];
    flushTimer = null;
    MAX_QUEUE_SIZE = 100;
    FLUSH_INTERVAL_MS = 3000;
    tokenProvider = null;
    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => this.flushSync());
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.flushSync();
                }
            });
        }
    }
    static getInstance() {
        if (!TelemetryService.instance) {
            TelemetryService.instance = new TelemetryService();
        }
        return TelemetryService.instance;
    }
    setTokenProvider(provider) {
        this.tokenProvider = provider;
    }
    /**
     * Non-blocking event tracking. Adds to bounded queue and schedules flush.
     */
    track(eventName, context = {}) {
        const event = {
            event_name: eventName,
            event_version: '1.0',
            schema_version: '1.0',
            client_event_id: `evt-${crypto.randomUUID()}`,
            session_id: context.sessionId,
            session_item_id: context.sessionItemId,
            concept_id: context.conceptId,
            occurred_at: new Date().toISOString(),
            properties: sanitizeProperties(context.payload || {}),
        };
        if (import.meta.env.DEV) {
            console.log(`[Telemetry 📡] ${event.event_name}`, event);
        }
        // Enforce queue boundary: drop oldest on overflow
        if (this.queue.length >= this.MAX_QUEUE_SIZE) {
            this.queue.shift();
        }
        this.queue.push(event);
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL_MS);
        }
    }
    /**
     * Asynchronously flushes batched events to backend sink.
     */
    async flush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        if (this.queue.length === 0)
            return;
        const eventsToSend = [...this.queue];
        this.queue = [];
        try {
            await apiClient('/api/v1/telemetry/events', {
                method: 'POST',
                body: JSON.stringify({ events: eventsToSend }),
                keepalive: true,
            });
        }
        catch (err) {
            if (import.meta.env.DEV) {
                console.warn('[Telemetry Warning ⚠️] Batch ingestion failed (swallowed):', err);
            }
        }
    }
    /**
     * Synchronous beacon flush on page unload/hidden.
     */
    flushSync() {
        if (this.queue.length === 0)
            return;
        const eventsToSend = [...this.queue];
        this.queue = [];
        const blob = new Blob([JSON.stringify({ events: eventsToSend })], {
            type: 'application/json',
        });
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            navigator.sendBeacon('/api/v1/telemetry/events', blob);
        }
    }
}
export const telemetry = TelemetryService.getInstance();
