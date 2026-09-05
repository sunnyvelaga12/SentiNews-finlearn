/**
 * Hardened API Client for SentiNews Learn Frontend
 *
 * Invariants:
 * 1. credentials: "include" for HttpOnly refresh cookie management.
 * 2. Single-flight refresh promise: concurrent 401s await exactly one /refresh request.
 * 3. Max-retry bound: at most 1 retry per original request.
 * 4. Standard error envelope contract: branches strictly on error `code`, not message.
 */
export class ApiError extends Error {
    code;
    requestId;
    status;
    details;
    constructor(status, envelope) {
        super(envelope.message || 'API request failed');
        this.name = 'ApiError';
        this.status = status;
        this.code = envelope.code || 'UNKNOWN_ERROR';
        this.requestId = envelope.request_id;
        this.details = envelope.details;
    }
}
// Token storage & listeners
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const resolveEndpointUrl = (endpoint) => {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        return endpoint;
    }
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint;
};

let currentAccessToken = null;
let onTokenExpiredCallback = null;
let inFlightRefreshPromise = null;
export const setAccessToken = (token) => {
    currentAccessToken = token;
};
export const getAccessToken = () => {
    return currentAccessToken;
};
export const setOnTokenExpired = (callback) => {
    onTokenExpiredCallback = callback;
};
/**
 * Single-flight refresh execution.
 * Guarantees that concurrent 401s await the SAME network call.
 */
export const refreshAccessToken = async () => {
    if (inFlightRefreshPromise) {
        return inFlightRefreshPromise;
    }
    inFlightRefreshPromise = (async () => {
        try {
            const res = await fetch(resolveEndpointUrl('/api/v1/auth/refresh'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({
                    code: 'AUTH_EXPIRED',
                    message: 'Refresh token expired or revoked',
                }));
                setAccessToken(null);
                if (onTokenExpiredCallback) {
                    onTokenExpiredCallback();
                }
                throw new ApiError(res.status, errorData);
            }
            const data = await res.json();
            setAccessToken(data.access_token);
            return data.access_token;
        }
        finally {
            inFlightRefreshPromise = null;
        }
    })();
    return inFlightRefreshPromise;
};
/**
 * Robust fetch wrapper with automatic JWT injection, single-flight refresh retry, and error envelope parsing.
 */
export const apiClient = async (endpoint, options = {}) => {
    const { retryCount = 0, headers = {}, ...restOptions } = options;
    const requestHeaders = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-session-token',
        ...headers,
    };
    if (currentAccessToken && !requestHeaders['Authorization']) {
        requestHeaders['Authorization'] = `Bearer ${currentAccessToken}`;
    }
    const targetUrl = resolveEndpointUrl(endpoint);
    const response = await fetch(targetUrl, {
        ...restOptions,
        headers: requestHeaders,
        credentials: 'include',
    });
    // Handle 401 with single-flight refresh retry (bounded at 1 retry)
    if (response.status === 401 && retryCount === 0 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
        try {
            const newAccessToken = await refreshAccessToken();
            return apiClient(endpoint, {
                ...options,
                retryCount: retryCount + 1,
                headers: {
                    ...requestHeaders,
                    Authorization: `Bearer ${newAccessToken}`,
                },
            });
        }
        catch (refreshErr) {
            throw refreshErr;
        }
    }
    if (!response.ok) {
        let errorEnvelope;
        try {
            errorEnvelope = await response.json();
        }
        catch {
            errorEnvelope = {
                code: `HTTP_${response.status}`,
                message: response.statusText || 'Request failed',
            };
        }
        throw new ApiError(response.status, errorEnvelope);
    }
    // If 204 No Content
    if (response.status === 204) {
        return {};
    }
    return (await response.json());
};
