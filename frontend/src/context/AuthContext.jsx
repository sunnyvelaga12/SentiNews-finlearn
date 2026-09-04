import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAccessToken as setClientToken, setOnTokenExpired, apiClient, refreshAccessToken, } from '../services/apiClient';
const AuthContext = createContext(undefined);
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [authState, setAuthState] = useState('INITIALIZING');
    const updateToken = (token) => {
        setAccessToken(token);
        setClientToken(token);
    };
    // Register session expired listener from apiClient
    useEffect(() => {
        setOnTokenExpired(() => {
            setAuthState('SESSION_EXPIRED');
            setUser(null);
            setAccessToken(null);
        });
    }, []);
    const getAuthHeaders = useCallback(() => {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return headers;
    }, [accessToken]);
    // Attempt silent token refresh on initial app bootstrap
    useEffect(() => {
        let isMounted = true;
        const bootstrapAuth = async () => {
            try {
                const token = await refreshAccessToken();
                if (token && isMounted) {
                    updateToken(token);
                    // Fetch user profile
                    const meData = await apiClient('/api/v1/auth/me', {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (isMounted) {
                        setUser(meData);
                        setAuthState('AUTHENTICATED');
                    }
                }
                else if (isMounted) {
                    setAuthState('ANONYMOUS');
                }
            }
            catch (err) {
                if (isMounted) {
                    setAuthState('ANONYMOUS');
                }
            }
        };
        bootstrapAuth();
        return () => {
            isMounted = false;
        };
    }, []);
    const login = async (email, password) => {
        setAuthState('REFRESHING');
        try {
            const data = await apiClient('/api/v1/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            updateToken(data.access_token);
            setUser(data.user);
            setAuthState('AUTHENTICATED');
        }
        catch (err) {
            setAuthState('ANONYMOUS');
            throw err;
        }
    };
    const register = async (email, password, displayName) => {
        setAuthState('REFRESHING');
        try {
            const data = await apiClient('/api/v1/auth/register', {
                method: 'POST',
                body: JSON.stringify({ email, password, display_name: displayName }),
            });
            updateToken(data.access_token);
            setUser(data.user);
            setAuthState('AUTHENTICATED');
        }
        catch (err) {
            setAuthState('ANONYMOUS');
            throw err;
        }
    };
    const logout = async () => {
        try {
            await apiClient('/api/v1/auth/logout', {
                method: 'POST',
            });
        }
        catch {
            // Ignore network errors during teardown
        }
        finally {
            updateToken(null);
            setUser(null);
            setAuthState('ANONYMOUS');
        }
    };
    return (<AuthContext.Provider value={{
            user,
            accessToken,
            authState,
            isAuthenticated: authState === 'AUTHENTICATED' && !!accessToken,
            isLoading: authState === 'INITIALIZING' || authState === 'REFRESHING',
            login,
            register,
            logout,
            getAuthHeaders,
        }}>
      {children}
    </AuthContext.Provider>);
};
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
