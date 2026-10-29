/**
 * Typed Local Repository Abstraction for Wallet Application
 *
 * Implements clean repositories for each dataset, backed by IndexedDB.
 * Ensures all operations are scoped strictly to the authenticated accountId.
 * Automatically checks for and migrates legacy localStorage data if present.
 */

import {
    Transaction,
    SavingsGoal,
    Loan,
    Subscription,
    ScheduledTransaction,
    Investment,
    UserProfile,
    ExtraContribution,
    Repayment,
    CurrencySettings,
    ActivityLogEntry,
    UserPreferences,
} from '../../types';
import {
    idbGetByAccount,
    idbGetById,
    idbPutItem,
    idbPutBatch,
    idbDeleteItem,
    idbDeleteByAccount,
    withWriteTransaction,
    StoreName,
} from './indexedDB';

export interface StoredProfile extends UserProfile {
    accountId: string;
}

export interface StoredPreferences extends UserPreferences {
    accountId: string;
}

export interface StoredTransaction extends Transaction {
    accountId: string;
}

export interface StoredSavingsGoal extends SavingsGoal {
    accountId: string;
}

export interface StoredLoan extends Loan {
    accountId: string;
}

export interface StoredSubscription extends Subscription {
    accountId: string;
}

export interface StoredScheduledTransaction extends ScheduledTransaction {
    accountId: string;
}

export interface StoredInvestment extends Investment {
    accountId: string;
}

export interface StoredActivityLogEntry extends ActivityLogEntry {
    accountId: string;
}

const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
    symbol: 'ETB',
    symbolPlacement: 'before',
    numberFormat: 'comma-dot',
    decimalPlaces: 2,
};

const migratedAccounts = new Set<string>();

/**
 * Checks for legacy localStorage data for the given account and migrates it to IndexedDB once.
 */
export async function migrateLegacyLocalStorageIfPresent(accountId: string): Promise<void> {
    if (!accountId || migratedAccounts.has(accountId)) return;
    migratedAccounts.add(accountId);

    if (typeof localStorage === 'undefined') return;

    const legacyKey = `wallet.local.user.${accountId}`;
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return;

    try {
        const parsed = JSON.parse(raw);
        // Check if IndexedDB already has transactions
        const existingIncome = await idbGetByAccount<StoredTransaction>('income', accountId);
        const existingExpenses = await idbGetByAccount<StoredTransaction>('expenses', accountId);
        if (existingIncome.length > 0 || existingExpenses.length > 0) {
            // Already populated in IndexedDB
            return;
        }

        console.info(`[WalletDB] Migrating legacy localStorage data for account ${accountId} into IndexedDB...`);

        // Migrate Profile
        if (parsed.profile) {
            await idbPutItem<StoredProfile>('profiles', {
                ...parsed.profile,
                accountId,
            });
        }

        // Migrate Preferences
        if (parsed.preferences) {
            await idbPutItem<StoredPreferences>('preferences', {
                ...parsed.preferences,
                accountId,
            });
        }

        // Migrate Income
        if (Array.isArray(parsed.income) && parsed.income.length > 0) {
            const items: StoredTransaction[] = parsed.income.map((item: Transaction) => ({
                ...item,
                accountId,
            }));
            await idbPutBatch('income', items);
        }

        // Migrate Expenses
        if (Array.isArray(parsed.expenses) && parsed.expenses.length > 0) {
            const items: StoredTransaction[] = parsed.expenses.map((item: Transaction) => ({
                ...item,
                accountId,
            }));
            await idbPutBatch('expenses', items);
        }

        // Migrate Savings Goals
        if (Array.isArray(parsed.savingsGoals) && parsed.savingsGoals.length > 0) {
            const items: StoredSavingsGoal[] = parsed.savingsGoals.map((item: SavingsGoal) => ({
                ...item,
                accountId,
            }));
            await idbPutBatch('savingsGoals', items);
        }

        // Migrate Loans
        if (Array.isArray(parsed.loans) && parsed.loans.length > 0) {
            const items: StoredLoan[] = parsed.loans.map((item: Loan) => ({
                ...item,
                accountId,
            }));
            await idbPutBatch('loans', items);
        }

        // Migrate Subscriptions
        if (Array.isArray(parsed.subscriptions) && parsed.subscriptions.length > 0) {
            const items: StoredSubscription[] = parsed.subscriptions.map((item: Subscription) => ({
                ...item,
                accountId,
            }));
            await idbPutBatch('subscriptions', items);
        }

        // Migrate Scheduled Transactions
        if (Array.isArray(parsed.scheduledTransactions) && parsed.scheduledTransactions.length > 0) {
            const items: StoredScheduledTransaction[] = parsed.scheduledTransactions.map((item: ScheduledTransaction) => ({
                ...item,
                accountId,
            }));
            await idbPutBatch('scheduledTransactions', items);
        }

        // Migrate Investments
        if (Array.isArray(parsed.investments) && parsed.investments.length > 0) {
            const items: StoredInvestment[] = parsed.investments.map((item: Investment) => ({
                ...item,
                accountId,
            }));
            await idbPutBatch('investments', items);
        }

        // Migrate Activity Logs
        if (Array.isArray(parsed.activityLog) && parsed.activityLog.length > 0) {
            const items: StoredActivityLogEntry[] = parsed.activityLog.map((log: any) => ({
                id: log.id || window.crypto.randomUUID(),
                accountId,
                actionType: log.actionType || (log.type === 'account_created' ? 'account_created' : 'expense_added'),
                timestamp: log.createdAt || log.timestamp || new Date().toISOString(),
                description: log.name || log.description || 'Activity logged',
                metadata: log.metadata || {},
            }));
            await idbPutBatch('activityHistory', items);
        }

        console.info(`[WalletDB] Migration complete for account ${accountId}.`);
    } catch (e) {
        console.error(`[WalletDB] Failed to migrate legacy localStorage data for ${accountId}:`, e);
    }
}

// -------------------------------------------------------------------------
// Profile Repository
// -------------------------------------------------------------------------
export const profileRepository = {
    async get(accountId: string): Promise<UserProfile> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const stored = await idbGetById<StoredProfile>('profiles', accountId);
        if (stored) {
            return {
                name: stored.name || 'Wallet User',
                email: stored.email || '',
                avatar: stored.avatar,
                monthlySpendingLimit: stored.monthlySpendingLimit,
            };
        }
        const defaultProfile: StoredProfile = {
            accountId,
            name: 'Wallet User',
            email: '',
        };
        await idbPutItem('profiles', defaultProfile);
        return { name: defaultProfile.name, email: defaultProfile.email };
    },

    async update(accountId: string, update: Partial<UserProfile>): Promise<UserProfile> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const current = await this.get(accountId);
        const updated: StoredProfile = {
            ...current,
            ...update,
            accountId,
        };
        await idbPutItem('profiles', updated);
        return {
            name: updated.name,
            email: updated.email,
            avatar: updated.avatar,
            monthlySpendingLimit: updated.monthlySpendingLimit,
        };
    },
};

// -------------------------------------------------------------------------
// Preferences Repository
// -------------------------------------------------------------------------
export const preferencesRepository = {
    async get(accountId: string): Promise<UserPreferences> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const stored = await idbGetById<StoredPreferences>('preferences', accountId);
        if (stored) {
            return {
                language: stored.language || 'en',
                theme: stored.theme || 'dark',
                currencySettings: stored.currencySettings || DEFAULT_CURRENCY_SETTINGS,
                currency_symbol: stored.currency_symbol || stored.currencySettings?.symbol || 'ETB',
                currency_placement: stored.currency_placement || stored.currencySettings?.symbolPlacement || 'before',
                currency_format: stored.currency_format || stored.currencySettings?.numberFormat || 'comma-dot',
                decimal_places: stored.decimal_places !== undefined ? stored.decimal_places : (stored.currencySettings?.decimalPlaces ?? 2),
            };
        }
        const defaults: StoredPreferences = {
            accountId,
            language: 'en',
            theme: 'dark',
            currencySettings: DEFAULT_CURRENCY_SETTINGS,
            currency_symbol: DEFAULT_CURRENCY_SETTINGS.symbol,
            currency_placement: DEFAULT_CURRENCY_SETTINGS.symbolPlacement,
            currency_format: DEFAULT_CURRENCY_SETTINGS.numberFormat,
            decimal_places: DEFAULT_CURRENCY_SETTINGS.decimalPlaces,
        };
        await idbPutItem('preferences', defaults);
        return defaults;
    },

    async update(accountId: string, prefs: any): Promise<UserPreferences> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const current = await this.get(accountId);
        const updated: StoredPreferences = {
            ...current,
            accountId,
            language: prefs.language ?? current.language,
            theme: prefs.theme ?? current.theme,
            currencySettings: prefs.currencySettings ?? current.currencySettings,
            currency_symbol: prefs.currency_symbol ?? prefs.currencySettings?.symbol ?? current.currency_symbol,
            currency_placement: prefs.currency_placement ?? prefs.currencySettings?.symbolPlacement ?? current.currency_placement,
            currency_format: prefs.currency_format ?? prefs.currencySettings?.numberFormat ?? current.currency_format,
            decimal_places: prefs.decimal_places !== undefined ? prefs.decimal_places : (prefs.currencySettings?.decimalPlaces ?? current.decimal_places),
        };
        if (!updated.currencySettings && updated.currency_symbol) {
            updated.currencySettings = {
                symbol: updated.currency_symbol,
                symbolPlacement: (updated.currency_placement as any) || 'before',
                numberFormat: (updated.currency_format as any) || 'comma-dot',
                decimalPlaces: updated.decimal_places !== undefined ? updated.decimal_places : 2,
            };
        }
        await idbPutItem('preferences', updated);
        return updated;
    },
};

// -------------------------------------------------------------------------
// Income Repository
// -------------------------------------------------------------------------
export const incomeRepository = {
    async getAll(accountId: string): Promise<Transaction[]> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const items = await idbGetByAccount<StoredTransaction>('income', accountId);
        return items
            .map(({ accountId: _, ...tx }) => tx)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    async add(accountId: string, item: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const record: StoredTransaction = {
            ...item,
            id: item.id || window.crypto.randomUUID(),
            accountId,
        };
        await idbPutItem('income', record);
        const { accountId: _, ...tx } = record;
        return tx;
    },

    async update(accountId: string, item: Transaction): Promise<Transaction> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const record: StoredTransaction = {
            ...item,
            accountId,
        };
        await idbPutItem('income', record);
        const { accountId: _, ...tx } = record;
        return tx;
    },

    async delete(accountId: string, id: string): Promise<void> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        await idbDeleteItem('income', id);
    },
};

// -------------------------------------------------------------------------
// Expense Repository
// -------------------------------------------------------------------------
export const expenseRepository = {
    async getAll(accountId: string): Promise<Transaction[]> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const items = await idbGetByAccount<StoredTransaction>('expenses', accountId);
        return items
            .map(({ accountId: _, ...tx }) => tx)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    async add(accountId: string, item: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const record: StoredTransaction = {
            ...item,
            id: item.id || window.crypto.randomUUID(),
            accountId,
        };
        await idbPutItem('expenses', record);
        const { accountId: _, ...tx } = record;
        return tx;
    },

    async update(accountId: string, item: Transaction): Promise<Transaction> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const record: StoredTransaction = {
            ...item,
            accountId,
        };
        await idbPutItem('expenses', record);
        const { accountId: _, ...tx } = record;
        return tx;
    },

    async delete(accountId: string, id: string): Promise<void> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        await idbDeleteItem('expenses', id);
    },
};

// -------------------------------------------------------------------------
// Savings Goals Repository
// -------------------------------------------------------------------------
export const savingsRepository = {
    async getAll(accountId: string): Promise<SavingsGoal[]> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const items = await idbGetByAccount<StoredSavingsGoal>('savingsGoals', accountId);
        return items.map(({ accountId: _, ...goal }) => goal);
    },

    async getById(accountId: string, id: string): Promise<SavingsGoal | null> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const item = await idbGetById<StoredSavingsGoal>('savingsGoals', id);
        if (!item || item.accountId !== accountId) return null;
        const { accountId: _, ...goal } = item;
        return goal;
    },

    async add(accountId: string, item: Omit<SavingsGoal, 'id' | 'extraContributions'> & { id?: string; extraContributions?: ExtraContribution[] }): Promise<SavingsGoal> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const record: StoredSavingsGoal = {
            ...item,
            id: item.id || window.crypto.randomUUID(),
            extraContributions: item.extraContributions || [],
            accountId,
        };
        await idbPutItem('savingsGoals', record);
        const { accountId: _, ...goal } = record;
        return goal;
    },

    async update(accountId: string, item: SavingsGoal): Promise<void> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const stored: StoredSavingsGoal = {
            ...item,
            accountId,
        };
        await idbPutItem('savingsGoals', stored);
    },

    async delete(accountId: string, id: string): Promise<void> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        await idbDeleteItem('savingsGoals', id);
    },
};

// -------------------------------------------------------------------------
// Loan Repository
// -------------------------------------------------------------------------
export const loanRepository = {
    async getAll(accountId: string): Promise<Loan[]> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const items = await idbGetByAccount<StoredLoan>('loans', accountId);
        return items.map(({ accountId: _, ...loan }) => loan);
    },

    async getById(accountId: string, id: string): Promise<Loan | null> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const item = await idbGetById<StoredLoan>('loans', id);
        if (!item || item.accountId !== accountId) return null;
        const { accountId: _, ...loan } = item;
        return loan;
    },

    async save(accountId: string, loan: Loan): Promise<Loan> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const stored: StoredLoan = {
            ...loan,
            accountId,
        };
        await idbPutItem('loans', stored);
        return loan;
    },

    async delete(accountId: string, id: string): Promise<void> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        await idbDeleteItem('loans', id);
    },
};

// -------------------------------------------------------------------------
// Subscription Repository
// -------------------------------------------------------------------------
export const subscriptionRepository = {
    async getAll(accountId: string): Promise<Subscription[]> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const items = await idbGetByAccount<StoredSubscription>('subscriptions', accountId);
        return items.map(({ accountId: _, ...sub }) => sub);
    },

    async add(accountId: string, item: Omit<Subscription, 'id'> & { id?: string }): Promise<Subscription> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const record: StoredSubscription = {
            ...item,
            id: item.id || window.crypto.randomUUID(),
            accountId,
        };
        await idbPutItem('subscriptions', record);
        const { accountId: _, ...sub } = record;
        return sub;
    },

    async update(accountId: string, item: Subscription): Promise<void> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const stored: StoredSubscription = {
            ...item,
            accountId,
        };
        await idbPutItem('subscriptions', stored);
    },

    async delete(accountId: string, id: string): Promise<void> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        await idbDeleteItem('subscriptions', id);
    },
};

// -------------------------------------------------------------------------
// Scheduled Transaction Repository
// -------------------------------------------------------------------------
export const scheduledRepository = {
    async getAll(accountId: string): Promise<ScheduledTransaction[]> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const items = await idbGetByAccount<StoredScheduledTransaction>('scheduledTransactions', accountId);
        return items.map(({ accountId: _, ...st }) => st);
    },

    async add(accountId: string, item: Omit<ScheduledTransaction, 'id'> & { id?: string }): Promise<ScheduledTransaction> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const record: StoredScheduledTransaction = {
            ...item,
            id: item.id || window.crypto.randomUUID(),
            accountId,
        };
        await idbPutItem('scheduledTransactions', record);
        const { accountId: _, ...st } = record;
        return st;
    },

    async update(accountId: string, item: ScheduledTransaction): Promise<void> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const stored: StoredScheduledTransaction = {
            ...item,
            accountId,
        };
        await idbPutItem('scheduledTransactions', stored);
    },

    async delete(accountId: string, id: string): Promise<void> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        await idbDeleteItem('scheduledTransactions', id);
    },
};

// -------------------------------------------------------------------------
// Investment Repository
// -------------------------------------------------------------------------
export const investmentRepository = {
    async getAll(accountId: string): Promise<Investment[]> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const items = await idbGetByAccount<StoredInvestment>('investments', accountId);
        return items.map(({ accountId: _, ...inv }) => inv);
    },

    async getById(accountId: string, id: string): Promise<Investment | null> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const item = await idbGetById<StoredInvestment>('investments', id);
        if (!item || item.accountId !== accountId) return null;
        const { accountId: _, ...inv } = item;
        return inv;
    },

    async save(accountId: string, item: Investment): Promise<Investment> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const stored: StoredInvestment = {
            ...item,
            accountId,
        };
        await idbPutItem('investments', stored);
        return item;
    },

    async delete(accountId: string, id: string): Promise<void> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        await idbDeleteItem('investments', id);
    },
};

// -------------------------------------------------------------------------
// Activity Repository
// -------------------------------------------------------------------------
export const activityRepository = {
    async getAll(accountId: string, limit?: number): Promise<ActivityLogEntry[]> {
        await migrateLegacyLocalStorageIfPresent(accountId);
        const items = await idbGetByAccount<StoredActivityLogEntry>('activityHistory', accountId);
        const sorted = items
            .map(({ accountId: _, ...entry }) => ({
                ...entry,
                accountId,
            }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (limit && limit > 0) {
            return sorted.slice(0, limit);
        }
        return sorted;
    },

    async add(accountId: string, entry: Omit<ActivityLogEntry, 'id' | 'accountId' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<ActivityLogEntry> {
        // Never store sensitive passwords or tokens in metadata
        const safeMetadata = entry.metadata ? { ...entry.metadata } : undefined;
        if (safeMetadata) {
            delete safeMetadata.password;
            delete safeMetadata.passwordHash;
            delete safeMetadata.salt;
            delete safeMetadata.recoveryKey;
            delete safeMetadata.token;
        }

        const record: StoredActivityLogEntry = {
            id: entry.id || window.crypto.randomUUID(),
            accountId,
            actionType: entry.actionType,
            timestamp: entry.timestamp || new Date().toISOString(),
            description: entry.description,
            metadata: safeMetadata,
        };
        await idbPutItem('activityHistory', record);
        return record;
    },

    async clear(accountId: string): Promise<void> {
        await idbDeleteByAccount('activityHistory', accountId);
    },
};

// -------------------------------------------------------------------------
// Purge & Delete Account Data
// -------------------------------------------------------------------------
export async function purgeAccountFinancialData(accountId: string): Promise<void> {
    await Promise.all([
        idbDeleteByAccount('income', accountId),
        idbDeleteByAccount('expenses', accountId),
        idbDeleteByAccount('savingsGoals', accountId),
        idbDeleteByAccount('loans', accountId),
        idbDeleteByAccount('subscriptions', accountId),
        idbDeleteByAccount('scheduledTransactions', accountId),
        idbDeleteByAccount('investments', accountId),
    ]);

    // Sanitize legacy localStorage namespace if present: reset financial arrays while strictly preserving profile & preferences
    if (typeof localStorage !== 'undefined') {
        const key = `wallet.local.user.${accountId}`;
        const raw = localStorage.getItem(key);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                parsed.income = [];
                parsed.expenses = [];
                parsed.savingsGoals = [];
                parsed.loans = [];
                parsed.subscriptions = [];
                parsed.scheduledTransactions = [];
                parsed.investments = [];
                parsed.updatedAt = new Date().toISOString();
                localStorage.setItem(key, JSON.stringify(parsed));
            } catch {
                // ignore parsing error
            }
        }
    }
}

export async function deleteAllAccountData(accountId: string): Promise<void> {
    await Promise.all([
        idbDeleteByAccount('profiles', accountId),
        idbDeleteByAccount('preferences', accountId),
        idbDeleteByAccount('income', accountId),
        idbDeleteByAccount('expenses', accountId),
        idbDeleteByAccount('savingsGoals', accountId),
        idbDeleteByAccount('loans', accountId),
        idbDeleteByAccount('subscriptions', accountId),
        idbDeleteByAccount('scheduledTransactions', accountId),
        idbDeleteByAccount('investments', accountId),
        idbDeleteByAccount('activityHistory', accountId),
    ]);

    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`wallet.local.user.${accountId}`);
    }
}
