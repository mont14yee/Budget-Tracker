import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
    LocalAuthUser,
    loadSession,
    clearSession,
    getActiveUser,
    hasAnyAccount,
    createLocalAccount,
    authenticateLocalAccount,
    changeLocalPassword,
    recoverLocalPassword,
    removeLocalAccount,
    updateLocalAccount,
    getActiveSessionToken,
} from '../services/localAuthService';
import { getOrCreateUserNamespace, deleteUserNamespace } from '../services/localDataService';
import { deleteAllAccountData } from '../services/storage/localRepository';

export interface LocalSession {
    access_token: string;
}

export interface AuthContextType {
    user: LocalAuthUser | null;
    session: LocalSession | null;
    isLoading: boolean;
    isConfigured: boolean;
    hasExistingAccounts: boolean;
    isPasswordRecovery: boolean;
    setIsPasswordRecovery: (val: boolean) => void;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (
        email: string,
        password: string,
        fullName?: string
    ) => Promise<{ data: { user: LocalAuthUser; recoveryKey: string } | null; error: Error | null }>;
    signOut: () => Promise<void>;
    resetPasswordWithRecoveryKey: (
        email: string,
        recoveryKey: string,
        newPassword: string
    ) => Promise<{ error: Error | null }>;
    changePassword: (newPassword: string, currentPassword?: string) => Promise<{ error: Error | null }>;
    updateProfile: (updates: { name?: string; email?: string }) => Promise<{ error: Error | null }>;
    deleteAccount: (accountId?: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    isLoading: true,
    isConfigured: true,
    hasExistingAccounts: false,
    isPasswordRecovery: false,
    setIsPasswordRecovery: () => {},
    signIn: async () => ({ error: null }),
    signUp: async () => ({ data: null, error: null }),
    signOut: async () => {},
    resetPasswordWithRecoveryKey: async () => ({ error: null }),
    changePassword: async () => ({ error: null }),
    updateProfile: async () => ({ error: null }),
    deleteAccount: async () => ({ error: null }),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<LocalAuthUser | null>(null);
    const [session, setSession] = useState<LocalSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasExistingAccounts, setHasExistingAccounts] = useState(false);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

    // Initial session restoration & first-run account check
    useEffect(() => {
        try {
            const anyAccounts = hasAnyAccount();
            setHasExistingAccounts(anyAccounts);

            if (anyAccounts) {
                const active = getActiveUser();
                const token = getActiveSessionToken();
                if (active && token) {
                    setUser(active);
                    setSession({ access_token: token });
                    // Ensure namespace is initialized
                    getOrCreateUserNamespace(active.id, { name: active.name, email: active.email });
                } else {
                    setUser(null);
                    setSession(null);
                }
            } else {
                setUser(null);
                setSession(null);
            }
        } catch (err) {
            console.error('Error during local auth initialization:', err);
            setUser(null);
            setSession(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 1. Sign In
    const signIn = useCallback(async (email: string, password: string): Promise<{ error: Error | null }> => {
        try {
            const res = await authenticateLocalAccount(email, password);
            setUser(res.user);
            setSession({ access_token: res.token });
            // Initialize/verify user data namespace
            getOrCreateUserNamespace(res.user.id, { name: res.user.name, email: res.user.email });
            return { error: null };
        } catch (err: any) {
            return { error: err instanceof Error ? err : new Error(String(err)) };
        }
    }, []);

    // 2. Sign Up (First-run registration or new account)
    const signUp = useCallback(
        async (
            email: string,
            password: string,
            fullName?: string
        ): Promise<{ data: { user: LocalAuthUser; recoveryKey: string } | null; error: Error | null }> => {
            try {
                const res = await createLocalAccount(email, password, fullName || '');
                // Immediately provision the local user namespace with initial activity record
                getOrCreateUserNamespace(res.user.id, { name: res.user.name, email: res.user.email });

                setUser(res.user);
                setSession({ access_token: res.token });
                setHasExistingAccounts(true);

                return { data: { user: res.user, recoveryKey: res.recoveryKey }, error: null };
            } catch (err: any) {
                return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
            }
        },
        []
    );

    // 3. Sign Out
    const signOut = useCallback(async (): Promise<void> => {
        clearSession();
        setUser(null);
        setSession(null);
        setHasExistingAccounts(hasAnyAccount());
        setIsPasswordRecovery(false);
    }, []);

    // 4. Local Recovery Key Password Reset
    const resetPasswordWithRecoveryKey = useCallback(
        async (email: string, recoveryKey: string, newPassword: string): Promise<{ error: Error | null }> => {
            try {
                const res = await recoverLocalPassword(email, recoveryKey, newPassword);
                setUser(res.user);
                setSession({ access_token: res.token });
                setIsPasswordRecovery(false);
                return { error: null };
            } catch (err: any) {
                return { error: err instanceof Error ? err : new Error(String(err)) };
            }
        },
        []
    );

    // 5. Password Change (Authenticated)
    const changePassword = useCallback(
        async (newPassword: string, currentPassword?: string): Promise<{ error: Error | null }> => {
            try {
                if (!user) {
                    throw new Error('You must be signed in to change your password.');
                }
                await changeLocalPassword(user.id, newPassword, currentPassword);
                return { error: null };
            } catch (err: any) {
                return { error: err instanceof Error ? err : new Error(String(err)) };
            }
        },
        [user]
    );

    // 6. Update Profile (Authenticated)
    const updateProfile = useCallback(
        async (updates: { name?: string; email?: string }): Promise<{ error: Error | null }> => {
            try {
                if (!user) {
                    throw new Error('You must be signed in to update your profile.');
                }
                const updated = updateLocalAccount(user.id, updates);
                setUser(updated);
                return { error: null };
            } catch (err: any) {
                return { error: err instanceof Error ? err : new Error(String(err)) };
            }
        },
        [user]
    );

    // 7. Delete Account
    const deleteAccount = useCallback(
        async (accountId?: string): Promise<{ error: Error | null }> => {
            try {
                const targetId = accountId || user?.id;
                if (!targetId) {
                    throw new Error('No target account to delete.');
                }

                // Delete all account-scoped IndexedDB data
                await deleteAllAccountData(targetId);

                // Delete local financial & preference namespace
                deleteUserNamespace(targetId);

                // Remove account record & clear active session
                removeLocalAccount(targetId);

                // Clear sensitive cached state
                if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                    localStorage.removeItem('wallet-applock-pin');
                    localStorage.removeItem('wallet-applock-enabled');
                }

                setUser(null);
                setSession(null);
                setHasExistingAccounts(hasAnyAccount());
                return { error: null };
            } catch (err: any) {
                return { error: err instanceof Error ? err : new Error(String(err)) };
            }
        },
        [user]
    );

    const value: AuthContextType = {
        user,
        session,
        isLoading,
        isConfigured: true,
        hasExistingAccounts,
        isPasswordRecovery,
        setIsPasswordRecovery,
        signIn,
        signUp,
        signOut,
        resetPasswordWithRecoveryKey,
        changePassword,
        updateProfile,
        deleteAccount,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
