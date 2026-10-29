/**
 * Local Data Service (User Namespace Manager)
 *
 * Implements isolated multi-user financial storage using localStorage namespaces.
 * Storage key pattern: `wallet.local.user.<accountId>`
 * Ensures strict segregation so one user's financial records never bleed into another's.
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
    LoanType,
    InterestType,
    RepaymentSchedule,
} from '../types';

export interface LocalUserNamespaceData {
    profile: UserProfile;
    preferences: {
        theme?: 'light' | 'dark';
        language?: 'en' | 'am';
        currencySettings?: CurrencySettings;
    };
    income: Transaction[];
    expenses: Transaction[];
    savingsGoals: SavingsGoal[];
    loans: Loan[];
    subscriptions: Subscription[];
    scheduledTransactions: ScheduledTransaction[];
    investments: Investment[];
    activityLog: any[];
    createdAt: string;
    updatedAt: string;
}

const getUserStorageKey = (accountId: string): string => `wallet.local.user.${accountId}`;

const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
    symbol: 'ETB',
    symbolPlacement: 'before',
    numberFormat: 'comma-dot',
    decimalPlaces: 2,
};

/**
 * Get or initialize user namespace.
 */
export function getOrCreateUserNamespace(
    accountId: string,
    initialProfile?: Partial<UserProfile>
): LocalUserNamespaceData {
    const key = getUserStorageKey(accountId);
    const raw = localStorage.getItem(key);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            return {
                profile: parsed.profile || { name: 'Wallet User', email: '' },
                preferences: parsed.preferences || {
                    theme: 'dark',
                    language: 'en',
                    currencySettings: DEFAULT_CURRENCY_SETTINGS,
                },
                income: Array.isArray(parsed.income) ? parsed.income : [],
                expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
                savingsGoals: Array.isArray(parsed.savingsGoals) ? parsed.savingsGoals : [],
                loans: Array.isArray(parsed.loans) ? parsed.loans : [],
                subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
                scheduledTransactions: Array.isArray(parsed.scheduledTransactions) ? parsed.scheduledTransactions : [],
                investments: Array.isArray(parsed.investments) ? parsed.investments : [],
                activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog : [],
                createdAt: parsed.createdAt || new Date().toISOString(),
                updatedAt: parsed.updatedAt || new Date().toISOString(),
            };
        } catch (e) {
            console.error(`Failed to parse namespace for account ${accountId}:`, e);
        }
    }

    const today = new Date().toISOString().split('T')[0];
    const initialData: LocalUserNamespaceData = {
        profile: {
            name: initialProfile?.name || 'Wallet User',
            email: initialProfile?.email || '',
            avatar: initialProfile?.avatar,
        },
        preferences: {
            theme: 'dark',
            language: 'en',
            currencySettings: DEFAULT_CURRENCY_SETTINGS,
        },
        income: [],
        expenses: [],
        savingsGoals: [],
        loans: [],
        subscriptions: [],
        scheduledTransactions: [],
        investments: [],
        activityLog: [
            {
                id: window.crypto.randomUUID(),
                type: 'account_created',
                name: 'Local Wallet Created',
                amount: 0,
                date: today,
                category: 'Account',
                mood: '🎉',
                createdAt: new Date().toISOString(),
            },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    saveUserNamespace(accountId, initialData);
    return initialData;
}

export function saveUserNamespace(accountId: string, data: LocalUserNamespaceData): void {
    data.updatedAt = new Date().toISOString();
    try {
        localStorage.setItem(getUserStorageKey(accountId), JSON.stringify(data));
    } catch (e) {
        console.error(`Failed to save user namespace for ${accountId}:`, e);
        throw new Error('Local storage write failed. Your browser storage quota may be exceeded.');
    }
}

export function deleteUserNamespace(accountId: string): void {
    localStorage.removeItem(getUserStorageKey(accountId));
}

// --- Data Access Implementations ---

export const localDataService = {
    // User Profile
    getProfile(accountId: string): UserProfile {
        const ns = getOrCreateUserNamespace(accountId);
        return ns.profile;
    },

    updateProfile(accountId: string, update: Partial<UserProfile>): UserProfile {
        const ns = getOrCreateUserNamespace(accountId);
        ns.profile = { ...ns.profile, ...update };
        saveUserNamespace(accountId, ns);
        return ns.profile;
    },

    // User Preferences
    getUserPreferences(accountId: string): any {
        const ns = getOrCreateUserNamespace(accountId);
        return {
            language: ns.preferences.language,
            currencySettings: ns.preferences.currencySettings,
            theme: ns.preferences.theme,
            currency_symbol: ns.preferences.currencySettings?.symbol,
            currency_placement: ns.preferences.currencySettings?.symbolPlacement,
            currency_format: ns.preferences.currencySettings?.numberFormat,
            decimal_places: ns.preferences.currencySettings?.decimalPlaces,
        };
    },

    updateUserPreferences(accountId: string, prefs: any): any {
        const ns = getOrCreateUserNamespace(accountId);
        if (prefs.language) ns.preferences.language = prefs.language;
        if (prefs.theme) ns.preferences.theme = prefs.theme;
        if (prefs.currencySettings) {
            ns.preferences.currencySettings = prefs.currencySettings;
        } else if (prefs.currency_symbol) {
            ns.preferences.currencySettings = {
                symbol: prefs.currency_symbol,
                symbolPlacement: prefs.currency_placement || 'before',
                numberFormat: prefs.currency_format || 'comma-dot',
                decimalPlaces: prefs.decimal_places !== undefined ? prefs.decimal_places : 2,
            };
        }
        saveUserNamespace(accountId, ns);
        return this.getUserPreferences(accountId);
    },

    // Income
    getIncome(accountId: string): Transaction[] {
        const ns = getOrCreateUserNamespace(accountId);
        return [...ns.income].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    addIncome(accountId: string, item: Omit<Transaction, 'id'> & { id?: string }): Transaction {
        const ns = getOrCreateUserNamespace(accountId);
        const record: Transaction = {
            ...item,
            id: item.id || window.crypto.randomUUID(),
        };
        ns.income.unshift(record);
        saveUserNamespace(accountId, ns);
        return record;
    },

    deleteIncome(accountId: string, id: string): void {
        const ns = getOrCreateUserNamespace(accountId);
        ns.income = ns.income.filter(item => item.id !== id);
        saveUserNamespace(accountId, ns);
    },

    // Expenses
    getExpenses(accountId: string): Transaction[] {
        const ns = getOrCreateUserNamespace(accountId);
        return [...ns.expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    addExpense(accountId: string, item: Omit<Transaction, 'id'> & { id?: string }): Transaction {
        const ns = getOrCreateUserNamespace(accountId);
        const record: Transaction = {
            ...item,
            id: item.id || window.crypto.randomUUID(),
        };
        ns.expenses.unshift(record);
        saveUserNamespace(accountId, ns);
        return record;
    },

    deleteExpense(accountId: string, id: string): void {
        const ns = getOrCreateUserNamespace(accountId);
        ns.expenses = ns.expenses.filter(item => item.id !== id);
        saveUserNamespace(accountId, ns);
    },

    // Savings Goals
    getSavingsGoals(accountId: string): SavingsGoal[] {
        const ns = getOrCreateUserNamespace(accountId);
        return [...ns.savingsGoals];
    },

    addSavingsGoal(accountId: string, item: Omit<SavingsGoal, 'id' | 'extraContributions'> & { id?: string }): SavingsGoal {
        const ns = getOrCreateUserNamespace(accountId);
        const record: SavingsGoal = {
            ...item,
            id: item.id || window.crypto.randomUUID(),
            extraContributions: [],
        };
        ns.savingsGoals.unshift(record);
        saveUserNamespace(accountId, ns);
        return record;
    },

    updateSavingsGoal(accountId: string, item: SavingsGoal): void {
        const ns = getOrCreateUserNamespace(accountId);
        const index = ns.savingsGoals.findIndex(g => g.id === item.id);
        if (index !== -1) {
            ns.savingsGoals[index] = item;
            saveUserNamespace(accountId, ns);
        }
    },

    addExtraContribution(accountId: string, goalId: string, contribution: Omit<ExtraContribution, 'id'> & { id?: string }): ExtraContribution {
        const ns = getOrCreateUserNamespace(accountId);
        const goal = ns.savingsGoals.find(g => g.id === goalId);
        if (!goal) {
            throw new Error('Savings goal not found');
        }
        const record: ExtraContribution = {
            ...contribution,
            id: contribution.id || window.crypto.randomUUID(),
        };
        if (!goal.extraContributions) {
            goal.extraContributions = [];
        }
        goal.extraContributions.push(record);
        saveUserNamespace(accountId, ns);
        return record;
    },

    deleteSavingsGoal(accountId: string, id: string): void {
        const ns = getOrCreateUserNamespace(accountId);
        ns.savingsGoals = ns.savingsGoals.filter(g => g.id !== id);
        saveUserNamespace(accountId, ns);
    },

    // Loans
    getLoans(accountId: string): Loan[] {
        const ns = getOrCreateUserNamespace(accountId);
        return [...ns.loans];
    },

    recordLoanDisbursement(
        accountId: string,
        item: Omit<Loan, 'id' | 'repayments' | 'outstandingAmount'> & { id?: string; outstandingAmount?: number },
        txName?: string
    ): { loan: Loan; transaction?: Transaction } {
        const ns = getOrCreateUserNamespace(accountId);
        const loanRecord: Loan = {
            ...item,
            outstandingAmount: item.outstandingAmount !== undefined ? item.outstandingAmount : item.totalAmount,
            id: item.id || window.crypto.randomUUID(),
            repayments: [],
        };
        ns.loans.unshift(loanRecord);

        let createdTx: Transaction | undefined;
        // If lent money -> expense; if borrowed money -> income
        if (item.type === LoanType.Lent) {
            createdTx = {
                id: window.crypto.randomUUID(),
                name: txName || `Loan Lent: ${item.person}`,
                amount: item.totalAmount,
                date: item.date,
                category: 'Loan Disbursement',
                mood: '💼',
            };
            ns.expenses.unshift(createdTx);
        } else if (item.type === LoanType.Borrowed) {
            createdTx = {
                id: window.crypto.randomUUID(),
                name: txName || `Loan Borrowed: ${item.person}`,
                amount: item.totalAmount,
                date: item.date,
                category: 'Loan Inflow',
                mood: '💼',
            };
            ns.income.unshift(createdTx);
        }

        saveUserNamespace(accountId, ns);
        return { loan: loanRecord, transaction: createdTx };
    },

    recordLoanRepayment(accountId: string, loanId: string, repayment: Omit<Repayment, 'id'> & { id?: string }, txName?: string): { loan: Loan; repayment: Repayment; transaction?: Transaction } {
        const ns = getOrCreateUserNamespace(accountId);
        const loan = ns.loans.find(l => l.id === loanId);
        if (!loan) {
            throw new Error('Loan not found');
        }
        const repaymentRecord: Repayment = {
            ...repayment,
            id: repayment.id || window.crypto.randomUUID(),
        };
        if (!loan.repayments) {
            loan.repayments = [];
        }
        loan.repayments.push(repaymentRecord);
        loan.outstandingAmount = Math.max(0, loan.outstandingAmount - repayment.amount);

        let createdTx: Transaction | undefined;
        if (loan.type === LoanType.Lent) {
            // Repayment received -> income
            createdTx = {
                id: window.crypto.randomUUID(),
                name: txName || `Loan Repayment Received: ${loan.person}`,
                amount: repayment.amount,
                date: repayment.date,
                category: 'Loan Repayment',
                mood: '😊',
            };
            ns.income.unshift(createdTx);
        } else {
            // Repayment made -> expense
            createdTx = {
                id: window.crypto.randomUUID(),
                name: txName || `Loan Repayment Paid: ${loan.person}`,
                amount: repayment.amount,
                date: repayment.date,
                category: 'Debt Repayment',
                mood: '💪',
            };
            ns.expenses.unshift(createdTx);
        }

        saveUserNamespace(accountId, ns);
        return { loan, repayment: repaymentRecord, transaction: createdTx };
    },

    deleteLoan(accountId: string, id: string): void {
        const ns = getOrCreateUserNamespace(accountId);
        ns.loans = ns.loans.filter(l => l.id !== id);
        saveUserNamespace(accountId, ns);
    },

    // Subscriptions
    getSubscriptions(accountId: string): Subscription[] {
        const ns = getOrCreateUserNamespace(accountId);
        return [...ns.subscriptions];
    },

    addSubscription(accountId: string, item: Omit<Subscription, 'id'> & { id?: string }): Subscription {
        const ns = getOrCreateUserNamespace(accountId);
        const record: Subscription = {
            ...item,
            id: item.id || window.crypto.randomUUID(),
        };
        ns.subscriptions.unshift(record);
        saveUserNamespace(accountId, ns);
        return record;
    },

    updateSubscription(accountId: string, item: Subscription): void {
        const ns = getOrCreateUserNamespace(accountId);
        const index = ns.subscriptions.findIndex(s => s.id === item.id);
        if (index !== -1) {
            ns.subscriptions[index] = item;
            saveUserNamespace(accountId, ns);
        }
    },

    deleteSubscription(accountId: string, id: string): void {
        const ns = getOrCreateUserNamespace(accountId);
        ns.subscriptions = ns.subscriptions.filter(s => s.id !== id);
        saveUserNamespace(accountId, ns);
    },

    // Scheduled Transactions
    getScheduledTransactions(accountId: string): ScheduledTransaction[] {
        const ns = getOrCreateUserNamespace(accountId);
        return [...ns.scheduledTransactions];
    },

    addScheduledTransaction(accountId: string, item: Omit<ScheduledTransaction, 'id'> & { id?: string }): ScheduledTransaction {
        const ns = getOrCreateUserNamespace(accountId);
        const record: ScheduledTransaction = {
            ...item,
            id: item.id || window.crypto.randomUUID(),
        };
        ns.scheduledTransactions.unshift(record);
        saveUserNamespace(accountId, ns);
        return record;
    },

    updateScheduledTransaction(accountId: string, item: ScheduledTransaction): void {
        const ns = getOrCreateUserNamespace(accountId);
        const index = ns.scheduledTransactions.findIndex(s => s.id === item.id);
        if (index !== -1) {
            ns.scheduledTransactions[index] = item;
            saveUserNamespace(accountId, ns);
        }
    },

    deleteScheduledTransaction(accountId: string, id: string): void {
        const ns = getOrCreateUserNamespace(accountId);
        ns.scheduledTransactions = ns.scheduledTransactions.filter(s => s.id !== id);
        saveUserNamespace(accountId, ns);
    },

    // Investments
    getInvestments(accountId: string): Investment[] {
        const ns = getOrCreateUserNamespace(accountId);
        return [...ns.investments];
    },

    recordInvestmentPurchase(accountId: string, item: Omit<Investment, 'id'> & { id?: string }, categoryName = 'Investments'): { investment: Investment; transaction?: Transaction } {
        const ns = getOrCreateUserNamespace(accountId);
        const invRecord: Investment = {
            ...item,
            id: item.id || window.crypto.randomUUID(),
        };
        ns.investments.unshift(invRecord);

        const totalCost = invRecord.quantity * invRecord.purchasePrice;
        const txRecord: Transaction = {
            id: window.crypto.randomUUID(),
            name: `Investment: ${invRecord.name} (${invRecord.quantity} @ ${invRecord.purchasePrice})`,
            amount: totalCost,
            date: invRecord.purchaseDate,
            category: categoryName,
            mood: '📈',
        };
        ns.expenses.unshift(txRecord);

        saveUserNamespace(accountId, ns);
        return { investment: invRecord, transaction: txRecord };
    },

    updateInvestment(accountId: string, item: Investment): void {
        const ns = getOrCreateUserNamespace(accountId);
        const index = ns.investments.findIndex(i => i.id === item.id);
        if (index !== -1) {
            ns.investments[index] = item;
            saveUserNamespace(accountId, ns);
        }
    },

    recordInvestmentSale(
        accountId: string,
        investmentId: string,
        unitsSold?: number,
        salePrice?: number,
        proceedsCategory = 'Investment Proceeds',
        txName?: string
    ): {
        updatedInvestment: Investment | null;
        transaction: Transaction;
        profitOrLoss: number;
        realizedGainLoss: number;
        saleProceeds: number;
        remainingQuantity: number;
    } {
        const ns = getOrCreateUserNamespace(accountId);
        const inv = ns.investments.find(i => i.id === investmentId);
        if (!inv) {
            throw new Error('Investment not found');
        }
        const actualUnits = (unitsSold !== undefined && unitsSold > 0) ? unitsSold : inv.quantity;
        const actualPrice = (salePrice !== undefined && salePrice >= 0) ? salePrice : inv.currentPrice;

        if (actualUnits > inv.quantity) {
            throw new Error('Cannot sell more units than currently held.');
        }

        const proceeds = actualUnits * actualPrice;
        const costBasis = actualUnits * inv.purchasePrice;
        const profitOrLoss = proceeds - costBasis;
        const today = new Date().toISOString().split('T')[0];

        const txRecord: Transaction = {
            id: window.crypto.randomUUID(),
            name: txName || `Sold ${actualUnits} of ${inv.name}`,
            amount: proceeds,
            date: today,
            category: proceedsCategory,
            mood: profitOrLoss >= 0 ? '🎉' : '😥',
        };
        ns.income.unshift(txRecord);

        inv.quantity -= actualUnits;
        const remainingQuantity = Math.max(0, inv.quantity);
        let updatedInv: Investment | null = inv;
        if (remainingQuantity <= 0.000001) {
            ns.investments = ns.investments.filter(i => i.id !== investmentId);
            updatedInv = null;
        }

        saveUserNamespace(accountId, ns);
        return {
            updatedInvestment: updatedInv,
            transaction: txRecord,
            profitOrLoss,
            realizedGainLoss: profitOrLoss,
            saleProceeds: proceeds,
            remainingQuantity,
        };
    },

    deleteInvestment(accountId: string, id: string): void {
        const ns = getOrCreateUserNamespace(accountId);
        ns.investments = ns.investments.filter(i => i.id !== id);
        saveUserNamespace(accountId, ns);
    },

    // User Data Management & Retention
    purgeFinancialData(accountId: string): void {
        const ns = getOrCreateUserNamespace(accountId);
        ns.income = [];
        ns.expenses = [];
        ns.savingsGoals = [];
        ns.loans = [];
        ns.subscriptions = [];
        ns.scheduledTransactions = [];
        ns.investments = [];
        ns.activityLog = [
            {
                id: window.crypto.randomUUID(),
                type: 'purged',
                name: 'Financial Records Purged',
                amount: 0,
                date: new Date().toISOString().split('T')[0],
                category: 'Account',
                createdAt: new Date().toISOString(),
            },
        ];
        saveUserNamespace(accountId, ns);
    },

    deleteAccountData(accountId: string): void {
        deleteUserNamespace(accountId);
    },

    exportAllUserData(accountId: string): LocalUserNamespaceData {
        return getOrCreateUserNamespace(accountId);
    },

    importAllUserData(accountId: string, backup: Partial<LocalUserNamespaceData>, mode: 'merge' | 'replace' = 'merge'): { status: 'success'; importedCount: number } {
        const ns = getOrCreateUserNamespace(accountId);
        let count = 0;

        if (mode === 'replace') {
            if (Array.isArray(backup.income)) ns.income = backup.income;
            if (Array.isArray(backup.expenses)) ns.expenses = backup.expenses;
            if (Array.isArray(backup.savingsGoals)) ns.savingsGoals = backup.savingsGoals;
            if (Array.isArray(backup.loans)) ns.loans = backup.loans;
            if (Array.isArray(backup.subscriptions)) ns.subscriptions = backup.subscriptions;
            if (Array.isArray(backup.scheduledTransactions)) ns.scheduledTransactions = backup.scheduledTransactions;
            if (Array.isArray(backup.investments)) ns.investments = backup.investments;
            if (backup.profile) ns.profile = { ...ns.profile, ...backup.profile };
            if (backup.preferences) ns.preferences = { ...ns.preferences, ...backup.preferences };
            count = ns.income.length + ns.expenses.length + ns.savingsGoals.length + ns.loans.length;
        } else {
            // Merge
            if (Array.isArray(backup.income)) {
                const existingIds = new Set(ns.income.map(i => i.id));
                for (const item of backup.income) {
                    if (!existingIds.has(item.id)) {
                        ns.income.push(item);
                        count++;
                    }
                }
            }
            if (Array.isArray(backup.expenses)) {
                const existingIds = new Set(ns.expenses.map(e => e.id));
                for (const item of backup.expenses) {
                    if (!existingIds.has(item.id)) {
                        ns.expenses.push(item);
                        count++;
                    }
                }
            }
            if (Array.isArray(backup.savingsGoals)) {
                const existingIds = new Set(ns.savingsGoals.map(s => s.id));
                for (const item of backup.savingsGoals) {
                    if (!existingIds.has(item.id)) {
                        ns.savingsGoals.push(item);
                        count++;
                    }
                }
            }
            if (Array.isArray(backup.loans)) {
                const existingIds = new Set(ns.loans.map(l => l.id));
                for (const item of backup.loans) {
                    if (!existingIds.has(item.id)) {
                        ns.loans.push(item);
                        count++;
                    }
                }
            }
            if (Array.isArray(backup.subscriptions)) {
                const existingIds = new Set(ns.subscriptions.map(s => s.id));
                for (const item of backup.subscriptions) {
                    if (!existingIds.has(item.id)) {
                        ns.subscriptions.push(item);
                        count++;
                    }
                }
            }
            if (Array.isArray(backup.scheduledTransactions)) {
                const existingIds = new Set(ns.scheduledTransactions.map(s => s.id));
                for (const item of backup.scheduledTransactions) {
                    if (!existingIds.has(item.id)) {
                        ns.scheduledTransactions.push(item);
                        count++;
                    }
                }
            }
            if (Array.isArray(backup.investments)) {
                const existingIds = new Set(ns.investments.map(i => i.id));
                for (const item of backup.investments) {
                    if (!existingIds.has(item.id)) {
                        ns.investments.push(item);
                        count++;
                    }
                }
            }
        }

        saveUserNamespace(accountId, ns);
        return { status: 'success', importedCount: count };
    },
};
