/**
 * Local-First Authentication Service
 *
 * Implements client-side authentication using the standard Web Crypto API (SubtleCrypto).
 * - Password hashing using PBKDF2 with SHA-256 (100,000 iterations) and 16-byte random salt.
 * - Never stores plaintext passwords.
 * - Generates cryptographically isolated accounts with UUIDs.
 * - Multi-user support with isolated user namespaces in localStorage.
 * - Local-device recovery key mechanism with PBKDF2 verification (no external email dependencies).
 */

export interface LocalAccountRecord {
    id: string; // UUID
    email: string; // normalized (lowercase, trimmed)
    name: string; // display name
    passwordSalt: string; // hex
    passwordHash: string; // hex
    recoveryKeySalt: string; // hex
    recoveryKeyHash: string; // hex
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}

export interface LocalSessionRecord {
    sessionId: string;
    accountId: string;
    token: string;
    createdAt: string;
    expiresAt: number; // unix timestamp in ms
}

export interface LocalAuthUser {
    id: string;
    email: string;
    name: string;
    user_metadata?: {
        full_name?: string;
        avatar_url?: string;
    };
    created_at?: string;
    last_sign_in_at?: string;
}

const STORAGE_KEY_ACCOUNTS = 'wallet.local.accounts';
const STORAGE_KEY_SESSION = 'wallet.local.session';

// --- Crypto Utilities using Web Crypto API ---

function bufferToHex(buffer: ArrayBuffer | ArrayBufferView): string {
    const bytes = buffer instanceof Uint8Array
        ? buffer
        : new Uint8Array('buffer' in buffer ? (buffer as ArrayBufferView).buffer : (buffer as ArrayBuffer));
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexToBuffer(hex: string): Uint8Array {
    const matched = hex.match(/.{1,2}/g);
    if (!matched) return new Uint8Array();
    return new Uint8Array(matched.map(byte => parseInt(byte, 16)));
}

async function deriveKeyWithPbkdf2(password: string, salt: Uint8Array, iterations = 100000): Promise<string> {
    const encoder = new TextEncoder();
    const passwordKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const derivedBits = await window.crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: iterations,
            hash: 'SHA-256',
        },
        passwordKey,
        256
    );

    return bufferToHex(derivedBits);
}

function getRandomSalt(length = 16): Uint8Array {
    const salt = new Uint8Array(length);
    window.crypto.getRandomValues(salt);
    return salt;
}

export function generateRecoveryKey(): string {
    const array = new Uint8Array(12);
    window.crypto.getRandomValues(array);
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 without easily confused chars (0, 1, I, O)
    let code = '';
    for (let i = 0; i < array.length; i++) {
        code += chars[array[i] % chars.length];
    }
    // Format: WLT-XXXX-XXXX-XXXX
    return `WLT-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function generateLocalToken(accountId: string, email: string, sessionId: string): string {
    const payload = {
        accountId,
        email,
        sessionId,
        iat: Date.now(),
        // Valid for 90 days
        exp: Date.now() + 90 * 24 * 60 * 60 * 1000,
    };
    const json = JSON.stringify(payload);
    // Base64URL encoding
    const base64 = btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    return `wallet_local_${base64}`;
}

// --- Account Storage Management ---

export function loadAllAccounts(): Record<string, LocalAccountRecord> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch (e) {
        console.error('Failed to parse local accounts:', e);
        return {};
    }
}

function saveAccounts(accounts: Record<string, LocalAccountRecord>): void {
    try {
        localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
    } catch (e) {
        console.error('Failed to persist local accounts:', e);
        throw new Error('Local storage write failed. Your browser storage may be full.');
    }
}

export function hasAnyAccount(): boolean {
    const accounts = loadAllAccounts();
    return Object.keys(accounts).length > 0;
}

export function findAccountByEmail(email: string): LocalAccountRecord | null {
    const normalized = normalizeEmail(email);
    const accounts = loadAllAccounts();
    for (const id in accounts) {
        if (accounts[id].email === normalized) {
            return accounts[id];
        }
    }
    return null;
}

export function getAccountById(id: string): LocalAccountRecord | null {
    const accounts = loadAllAccounts();
    return accounts[id] || null;
}

// --- Session Storage Management ---

export function loadSession(): LocalSessionRecord | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_SESSION);
        if (!raw) return null;
        const session: LocalSessionRecord = JSON.parse(raw);
        if (session.expiresAt && Date.now() > session.expiresAt) {
            clearSession();
            return null;
        }
        return session;
    } catch (e) {
        console.error('Failed to parse local session:', e);
        return null;
    }
}

function saveSession(session: LocalSessionRecord): void {
    try {
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    } catch (e) {
        console.error('Failed to save local session:', e);
    }
}

export function clearSession(): void {
    localStorage.removeItem(STORAGE_KEY_SESSION);
}

export function getActiveSessionToken(): string | null {
    const session = loadSession();
    return session?.token || null;
}

export function getActiveUser(): LocalAuthUser | null {
    const session = loadSession();
    if (!session) return null;
    const account = getAccountById(session.accountId);
    if (!account) {
        clearSession();
        return null;
    }
    return {
        id: account.id,
        email: account.email,
        name: account.name,
        user_metadata: {
            full_name: account.name,
        },
        created_at: account.createdAt,
    };
}

// --- High-Level Auth Operations ---

/**
 * Register a new local account.
 * Computes salted PBKDF2 hash for password and generated recovery key.
 */
export async function createLocalAccount(
    email: string,
    password: string,
    name: string
): Promise<{ user: LocalAuthUser; recoveryKey: string; token: string }> {
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes('@')) {
        throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
    }
    const displayName = name.trim() || normalized.split('@')[0];

    const existing = findAccountByEmail(normalized);
    if (existing) {
        throw new Error('An account with this email already exists on this device. Please sign in instead.');
    }

    // 1. Password derivation
    const pwdSalt = getRandomSalt(16);
    const pwdSaltHex = bufferToHex(pwdSalt);
    const pwdHash = await deriveKeyWithPbkdf2(password, pwdSalt);

    // 2. Recovery key derivation
    const recoveryKey = generateRecoveryKey();
    const recSalt = getRandomSalt(16);
    const recSaltHex = bufferToHex(recSalt);
    const recHash = await deriveKeyWithPbkdf2(recoveryKey.replace(/-/g, '').toUpperCase(), recSalt);

    const accountId = window.crypto.randomUUID();
    const now = new Date().toISOString();

    const record: LocalAccountRecord = {
        id: accountId,
        email: normalized,
        name: displayName,
        passwordSalt: pwdSaltHex,
        passwordHash: pwdHash,
        recoveryKeySalt: recSaltHex,
        recoveryKeyHash: recHash,
        createdAt: now,
        updatedAt: now,
    };

    const accounts = loadAllAccounts();
    accounts[accountId] = record;
    saveAccounts(accounts);

    // 3. Create Session
    const sessionId = window.crypto.randomUUID();
    const token = generateLocalToken(accountId, normalized, sessionId);
    const session: LocalSessionRecord = {
        sessionId,
        accountId,
        token,
        createdAt: now,
        expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
    };
    saveSession(session);

    const user: LocalAuthUser = {
        id: accountId,
        email: normalized,
        name: displayName,
        user_metadata: {
            full_name: displayName,
        },
        created_at: now,
    };

    return { user, recoveryKey, token };
}

/**
 * Sign into an existing local account by verifying email and PBKDF2 hash.
 */
export async function authenticateLocalAccount(
    email: string,
    password: string
): Promise<{ user: LocalAuthUser; token: string }> {
    const normalized = normalizeEmail(email);
    const account = findAccountByEmail(normalized);
    if (!account) {
        throw new Error('Incorrect email or password. Please verify your credentials and try again.');
    }

    const saltBuffer = hexToBuffer(account.passwordSalt);
    const computedHash = await deriveKeyWithPbkdf2(password, saltBuffer);

    if (computedHash !== account.passwordHash) {
        throw new Error('Incorrect email or password. Please verify your credentials and try again.');
    }

    const sessionId = window.crypto.randomUUID();
    const token = generateLocalToken(account.id, account.email, sessionId);
    const session: LocalSessionRecord = {
        sessionId,
        accountId: account.id,
        token,
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
    };
    saveSession(session);

    const user: LocalAuthUser = {
        id: account.id,
        email: account.email,
        name: account.name,
        user_metadata: {
            full_name: account.name,
        },
        created_at: account.createdAt,
    };

    return { user, token };
}

/**
 * Change the password for an authenticated local account.
 */
export async function changeLocalPassword(
    accountId: string,
    newPassword: string,
    currentPassword?: string
): Promise<void> {
    const accounts = loadAllAccounts();
    const account = accounts[accountId];
    if (!account) {
        throw new Error('Account not found.');
    }

    if (!newPassword || newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long.');
    }

    // Verify current password if provided
    if (currentPassword) {
        const saltBuffer = hexToBuffer(account.passwordSalt);
        const computedHash = await deriveKeyWithPbkdf2(currentPassword, saltBuffer);
        if (computedHash !== account.passwordHash) {
            throw new Error('Current password does not match.');
        }
    }

    // Generate fresh salt and new PBKDF2 hash
    const newSalt = getRandomSalt(16);
    const newSaltHex = bufferToHex(newSalt);
    const newHash = await deriveKeyWithPbkdf2(newPassword, newSalt);

    account.passwordSalt = newSaltHex;
    account.passwordHash = newHash;
    account.updatedAt = new Date().toISOString();

    accounts[accountId] = account;
    saveAccounts(accounts);
}

/**
 * Recover account and reset password using the local Recovery Key.
 * 100% on-device verification; no remote emails.
 */
export async function recoverLocalPassword(
    email: string,
    recoveryKey: string,
    newPassword: string
): Promise<{ user: LocalAuthUser; token: string }> {
    const normalized = normalizeEmail(email);
    const account = findAccountByEmail(normalized);
    if (!account) {
        throw new Error('No account found with this email address.');
    }

    if (!newPassword || newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long.');
    }

    const cleanKey = recoveryKey.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!cleanKey || cleanKey.length < 8) {
        throw new Error('Please enter a valid Recovery Key.');
    }

    const saltBuffer = hexToBuffer(account.recoveryKeySalt);
    const computedHash = await deriveKeyWithPbkdf2(cleanKey, saltBuffer);

    if (computedHash !== account.recoveryKeyHash) {
        throw new Error('The recovery key provided is invalid for this account.');
    }

    // Reset password with fresh salt
    const newPwdSalt = getRandomSalt(16);
    const newPwdSaltHex = bufferToHex(newPwdSalt);
    const newPwdHash = await deriveKeyWithPbkdf2(newPassword, newPwdSalt);

    account.passwordSalt = newPwdSaltHex;
    account.passwordHash = newPwdHash;
    account.updatedAt = new Date().toISOString();

    const accounts = loadAllAccounts();
    accounts[account.id] = account;
    saveAccounts(accounts);

    // Refresh session
    const sessionId = window.crypto.randomUUID();
    const token = generateLocalToken(account.id, account.email, sessionId);
    const session: LocalSessionRecord = {
        sessionId,
        accountId: account.id,
        token,
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
    };
    saveSession(session);

    const user: LocalAuthUser = {
        id: account.id,
        email: account.email,
        name: account.name,
        user_metadata: {
            full_name: account.name,
        },
        created_at: account.createdAt,
    };

    return { user, token };
}

/**
 * Completely delete local account record and clear current session.
 */
export function removeLocalAccount(accountId: string): void {
    const accounts = loadAllAccounts();
    delete accounts[accountId];
    saveAccounts(accounts);

    const session = loadSession();
    if (session?.accountId === accountId) {
        clearSession();
    }
}

/**
 * Update profile details (name, email) for an existing local account.
 */
export function updateLocalAccount(
    accountId: string,
    updates: { name?: string; email?: string }
): LocalAuthUser {
    const accounts = loadAllAccounts();
    const account = accounts[accountId];
    if (!account) {
        throw new Error('Account not found.');
    }

    if (updates.email) {
        const normalized = normalizeEmail(updates.email);
        const existing = findAccountByEmail(normalized);
        if (existing && existing.id !== accountId) {
            throw new Error('An account with this email identifier already exists on this device.');
        }
        account.email = normalized;
    }

    if (updates.name !== undefined) {
        account.name = updates.name.trim();
    }

    account.updatedAt = new Date().toISOString();
    accounts[accountId] = account;
    saveAccounts(accounts);

    return {
        id: account.id,
        email: account.email,
        name: account.name,
        user_metadata: {
            full_name: account.name,
        },
        created_at: account.createdAt,
    };
}
