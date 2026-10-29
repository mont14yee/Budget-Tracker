/**
 * Robust Local Financial Data Service
 *
 * Backed by IndexedDB via local repositories.
 * Enforces Decimal-safe financial calculations, data integrity, idempotency,
 * isolation by accountId, and automatic activity history logging.
 */

import Decimal from 'decimal.js';
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
    LoanType,
    ActivityLogEntry,
    ActivityActionType,
    UserPreferences,
} from '../types';
import {
    profileRepository,
    preferencesRepository,
    incomeRepository,
    expenseRepository,
    savingsRepository,
    loanRepository,
    subscriptionRepository,
    scheduledRepository,
    investmentRepository,
    activityRepository,
    purgeAccountFinancialData,
    deleteAllAccountData,
} from './storage/localRepository';
import {
    withWriteTransaction,
    ALL_STORES,
    idbDeleteByAccountInStore,
    idbGetExistingIdsInStore,
} from './storage/indexedDB';

export interface ExportBackupData {
    schemaVersion: number;
    exportedAt: string;
    accountId: string;
    profile: UserProfile;
    preferences: UserPreferences;
    income: Transaction[];
    expenses: Transaction[];
    savingsGoals: SavingsGoal[];
    loans: Loan[];
    subscriptions: Subscription[];
    scheduledTransactions: ScheduledTransaction[];
    investments: Investment[];
    activityHistory: ActivityLogEntry[];
}

function safeDecimal(val: any, defaultVal = 0): Decimal {
    try {
        const num = Number(val);
        if (Number.isNaN(num) || !Number.isFinite(num)) {
            return new Decimal(defaultVal);
        }
        return new Decimal(num);
    } catch {
        return new Decimal(defaultVal);
    }
}

function generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export const dbService = {
    // -------------------------------------------------------------------------
    // User Profile
    // -------------------------------------------------------------------------
    async getProfile(accountId: string): Promise<UserProfile> {
        return profileRepository.get(accountId);
    },

    async updateProfile(accountId: string, item: Partial<UserProfile>): Promise<UserProfile> {
        const updated = await profileRepository.update(accountId, item);
        await activityRepository.add(accountId, {
            actionType: 'profile_updated',
            description: `Updated profile details for ${updated.name}`,
            metadata: { name: updated.name, email: updated.email },
        });
        return updated;
    },

    // -------------------------------------------------------------------------
    // User Preferences
    // -------------------------------------------------------------------------
    async getUserPreferences(accountId: string): Promise<UserPreferences> {
        return preferencesRepository.get(accountId);
    },

    async updateUserPreferences(accountId: string, preferences: any): Promise<UserPreferences> {
        const updated = await preferencesRepository.update(accountId, preferences);
        await activityRepository.add(accountId, {
            actionType: 'settings_changed',
            description: 'Updated user preferences and display settings',
            metadata: {
                theme: updated.theme,
                language: updated.language,
                currency: updated.currency_symbol || updated.currencySettings?.symbol,
            },
        });
        return updated;
    },

    // -------------------------------------------------------------------------
    // Income
    // -------------------------------------------------------------------------
    async getIncome(accountId: string): Promise<Transaction[]> {
        return incomeRepository.getAll(accountId);
    },

    async addIncome(accountId: string, item: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction> {
        const amount = safeDecimal(item.amount).toNumber();
        const record = await incomeRepository.add(accountId, {
            ...item,
            id: item.id || generateUUID(),
            amount,
        });

        await activityRepository.add(accountId, {
            actionType: 'income_added',
            description: `Added income: ${record.name} (${record.category})`,
            metadata: {
                transactionId: record.id,
                name: record.name,
                amount: record.amount,
                category: record.category,
                date: record.date,
            },
        });

        return record;
    },

    async updateIncome(accountId: string, item: Transaction): Promise<Transaction> {
        const amount = safeDecimal(item.amount).toNumber();
        const record = await incomeRepository.update(accountId, {
            ...item,
            amount,
        });

        await activityRepository.add(accountId, {
            actionType: 'income_updated',
            description: `Updated income: ${record.name} (${record.category})`,
            metadata: {
                transactionId: record.id,
                name: record.name,
                amount: record.amount,
                category: record.category,
                date: record.date,
            },
        });

        return record;
    },

    async deleteIncome(accountId: string, id: string): Promise<void> {
        const all = await incomeRepository.getAll(accountId);
        const target = all.find(i => i.id === id);
        await incomeRepository.delete(accountId, id);

        await activityRepository.add(accountId, {
            actionType: 'income_deleted',
            description: `Deleted income: ${target ? target.name : id}`,
            metadata: {
                transactionId: id,
                amount: target?.amount,
                category: target?.category,
            },
        });
    },

    // -------------------------------------------------------------------------
    // Expenses
    // -------------------------------------------------------------------------
    async getExpenses(accountId: string): Promise<Transaction[]> {
        return expenseRepository.getAll(accountId);
    },

    async addExpense(accountId: string, item: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction> {
        const amount = safeDecimal(item.amount).toNumber();
        const record = await expenseRepository.add(accountId, {
            ...item,
            id: item.id || generateUUID(),
            amount,
        });

        await activityRepository.add(accountId, {
            actionType: 'expense_added',
            description: `Added expense: ${record.name} (${record.category})`,
            metadata: {
                transactionId: record.id,
                name: record.name,
                amount: record.amount,
                category: record.category,
                date: record.date,
            },
        });

        return record;
    },

    async updateExpense(accountId: string, item: Transaction): Promise<Transaction> {
        const amount = safeDecimal(item.amount).toNumber();
        const record = await expenseRepository.update(accountId, {
            ...item,
            amount,
        });

        await activityRepository.add(accountId, {
            actionType: 'expense_updated',
            description: `Updated expense: ${record.name} (${record.category})`,
            metadata: {
                transactionId: record.id,
                name: record.name,
                amount: record.amount,
                category: record.category,
                date: record.date,
            },
        });

        return record;
    },

    async deleteExpense(accountId: string, id: string): Promise<void> {
        const all = await expenseRepository.getAll(accountId);
        const target = all.find(e => e.id === id);
        await expenseRepository.delete(accountId, id);

        await activityRepository.add(accountId, {
            actionType: 'expense_deleted',
            description: `Deleted expense: ${target ? target.name : id}`,
            metadata: {
                transactionId: id,
                amount: target?.amount,
                category: target?.category,
            },
        });
    },

    // -------------------------------------------------------------------------
    // Savings Goals
    // -------------------------------------------------------------------------
    async getSavingsGoals(accountId: string): Promise<SavingsGoal[]> {
        return savingsRepository.getAll(accountId);
    },

    async addSavingsGoal(
        accountId: string,
        item: Omit<SavingsGoal, 'id' | 'extraContributions'> & { id?: string }
    ): Promise<SavingsGoal> {
        const targetAmount = safeDecimal(item.targetAmount).toNumber();
        const startingBalance = safeDecimal(item.startingBalance).toNumber();
        const monthlyContribution = safeDecimal(item.monthlyContribution).toNumber();
        const interestRate = safeDecimal(item.interestRate).toNumber();

        const record = await savingsRepository.add(accountId, {
            ...item,
            id: item.id || generateUUID(),
            targetAmount,
            startingBalance,
            monthlyContribution,
            interestRate,
            extraContributions: [],
        });

        await activityRepository.add(accountId, {
            actionType: 'savings_goal_created',
            description: `Created savings goal: ${record.name}`,
            metadata: {
                goalId: record.id,
                name: record.name,
                targetAmount: record.targetAmount,
                deadline: record.deadline,
            },
        });

        return record;
    },

    async updateSavingsGoal(accountId: string, item: SavingsGoal): Promise<SavingsGoal> {
        const targetAmount = safeDecimal(item.targetAmount).toNumber();
        const startingBalance = safeDecimal(item.startingBalance).toNumber();
        const monthlyContribution = safeDecimal(item.monthlyContribution).toNumber();
        const interestRate = safeDecimal(item.interestRate).toNumber();

        const updated: SavingsGoal = {
            ...item,
            targetAmount,
            startingBalance,
            monthlyContribution,
            interestRate,
        };
        await savingsRepository.update(accountId, updated);

        await activityRepository.add(accountId, {
            actionType: 'savings_goal_updated',
            description: `Updated savings goal: ${updated.name}`,
            metadata: {
                goalId: updated.id,
                name: updated.name,
                targetAmount: updated.targetAmount,
                deadline: updated.deadline,
            },
        });
        return updated;
    },

    async addExtraContribution(
        accountId: string,
        goalId: string,
        contribution: Omit<ExtraContribution, 'id'> & { id?: string }
    ): Promise<ExtraContribution> {
        const goal = await savingsRepository.getById(accountId, goalId);
        if (!goal) {
            throw new Error('Savings goal not found');
        }

        const contribAmount = safeDecimal(contribution.amount).toNumber();
        if (contribAmount <= 0) {
            throw new Error('Contribution amount must be greater than zero');
        }

        const contribRecord: ExtraContribution = {
            ...contribution,
            id: contribution.id || generateUUID(),
            amount: contribAmount,
        };

        const existingContribs = goal.extraContributions || [];
        goal.extraContributions = [...existingContribs, contribRecord];
        await savingsRepository.update(accountId, goal);

        await activityRepository.add(accountId, {
            actionType: 'savings_contribution_added',
            description: `Contributed to goal: ${goal.name}`,
            metadata: {
                goalId: goal.id,
                goalName: goal.name,
                contributionId: contribRecord.id,
                amount: contribRecord.amount,
                date: contribRecord.date,
            },
        });

        return contribRecord;
    },

    async deleteSavingsGoal(accountId: string, id: string): Promise<void> {
        const goal = await savingsRepository.getById(accountId, id);
        await savingsRepository.delete(accountId, id);

        await activityRepository.add(accountId, {
            actionType: 'savings_goal_deleted',
            description: `Deleted savings goal: ${goal ? goal.name : id}`,
            metadata: { goalId: id, goalName: goal?.name },
        });
    },

    // -------------------------------------------------------------------------
    // Loans
    // -------------------------------------------------------------------------
    async getLoans(accountId: string): Promise<Loan[]> {
        return loanRepository.getAll(accountId);
    },

    async addLoan(
        accountId: string,
        item: Omit<Loan, 'id' | 'repayments' | 'outstandingAmount'> & { id?: string; outstandingAmount?: number; repayments?: Repayment[] }
    ): Promise<Loan> {
        const res = await this.recordLoanDisbursement(accountId, item);
        return res.loan;
    },

    async recordLoanDisbursement(
        accountId: string,
        item: Omit<Loan, 'id' | 'repayments' | 'outstandingAmount'> & { id?: string; outstandingAmount?: number },
        txName?: string
    ): Promise<{ loan: Loan; transaction?: Transaction }> {
        const totalAmount = safeDecimal(item.totalAmount).toNumber();
        if (totalAmount <= 0) {
            throw new Error('Loan amount must be greater than zero');
        }

        const outstandingAmount = item.outstandingAmount !== undefined
            ? safeDecimal(item.outstandingAmount).toNumber()
            : totalAmount;

        const loanRecord: Loan = {
            ...item,
            id: item.id || generateUUID(),
            totalAmount,
            outstandingAmount,
            interestRate: safeDecimal(item.interestRate).toNumber(),
            repayments: [],
        };

        await loanRepository.save(accountId, loanRecord);

        let createdTx: Transaction | undefined;
        if (item.type === LoanType.Lent) {
            // Money lent out -> cash expense
            createdTx = await expenseRepository.add(accountId, {
                id: generateUUID(),
                name: txName || `Loan Lent: ${item.person}`,
                amount: totalAmount,
                date: item.date,
                category: 'Loan Disbursement',
                mood: '💼',
            });
        } else {
            // Money borrowed -> cash income
            createdTx = await incomeRepository.add(accountId, {
                id: generateUUID(),
                name: txName || `Loan Borrowed: ${item.person}`,
                amount: totalAmount,
                date: item.date,
                category: 'Loan Inflow',
                mood: '💼',
            });
        }

        await activityRepository.add(accountId, {
            actionType: 'loan_created',
            description: `${item.type === LoanType.Lent ? 'Lent to' : 'Borrowed from'} ${item.person}`,
            metadata: {
                loanId: loanRecord.id,
                type: item.type,
                person: item.person,
                totalAmount,
                dueDate: item.dueDate,
                transactionId: createdTx?.id,
            },
        });

        return { loan: loanRecord, transaction: createdTx };
    },

    async recordLoanRepayment(
        accountId: string,
        loanId: string,
        repayment: Omit<Repayment, 'id'> & { id?: string },
        txName?: string
    ): Promise<{ loan: Loan; repayment: Repayment; transaction?: Transaction }> {
        const loan = await loanRepository.getById(accountId, loanId);
        if (!loan) {
            throw new Error('Loan not found');
        }

        const repaymentAmount = safeDecimal(repayment.amount).toNumber();
        if (repaymentAmount <= 0) {
            throw new Error('Repayment amount must be positive');
        }

        const currentOutstanding = safeDecimal(loan.outstandingAmount);
        const newOutstanding = Decimal.max(0, currentOutstanding.minus(repaymentAmount)).toNumber();

        const repaymentRecord: Repayment = {
            ...repayment,
            id: repayment.id || generateUUID(),
            amount: repaymentAmount,
        };

        loan.repayments = [...(loan.repayments || []), repaymentRecord];
        loan.outstandingAmount = newOutstanding;
        await loanRepository.save(accountId, loan);

        let createdTx: Transaction | undefined;
        if (loan.type === LoanType.Lent) {
            // Repayment received -> cash income
            createdTx = await incomeRepository.add(accountId, {
                id: generateUUID(),
                name: txName || `Loan Repayment Received: ${loan.person}`,
                amount: repaymentAmount,
                date: repayment.date,
                category: 'Loan Repayment',
                mood: '😊',
            });
        } else {
            // Repayment paid -> cash expense
            createdTx = await expenseRepository.add(accountId, {
                id: generateUUID(),
                name: txName || `Loan Repayment Paid: ${loan.person}`,
                amount: repaymentAmount,
                date: repayment.date,
                category: 'Debt Repayment',
                mood: '💪',
            });
        }

        await activityRepository.add(accountId, {
            actionType: 'loan_repayment_recorded',
            description: `Repayment recorded for ${loan.person}`,
            metadata: {
                loanId: loan.id,
                person: loan.person,
                repaymentId: repaymentRecord.id,
                amount: repaymentAmount,
                remainingBalance: newOutstanding,
                transactionId: createdTx?.id,
            },
        });

        return { loan, repayment: repaymentRecord, transaction: createdTx };
    },

    async updateLoan(accountId: string, item: Loan): Promise<void> {
        await loanRepository.save(accountId, item);
    },

    async deleteLoan(accountId: string, id: string): Promise<void> {
        const loan = await loanRepository.getById(accountId, id);
        await loanRepository.delete(accountId, id);

        await activityRepository.add(accountId, {
            actionType: 'loan_deleted',
            description: `Deleted loan: ${loan ? loan.person : id}`,
            metadata: { loanId: id, person: loan?.person },
        });
    },

    // -------------------------------------------------------------------------
    // Subscriptions
    // -------------------------------------------------------------------------
    async getSubscriptions(accountId: string): Promise<Subscription[]> {
        return subscriptionRepository.getAll(accountId);
    },

    async addSubscription(accountId: string, item: Omit<Subscription, 'id'> & { id?: string }): Promise<Subscription> {
        const amount = safeDecimal(item.amount).toNumber();
        const record = await subscriptionRepository.add(accountId, {
            ...item,
            id: item.id || generateUUID(),
            amount,
        });

        await activityRepository.add(accountId, {
            actionType: 'subscription_created',
            description: `Added subscription: ${record.name}`,
            metadata: {
                subscriptionId: record.id,
                name: record.name,
                amount: record.amount,
                frequency: record.frequency,
            },
        });

        return record;
    },

    async updateSubscription(accountId: string, item: Subscription): Promise<void> {
        await subscriptionRepository.update(accountId, item);
        await activityRepository.add(accountId, {
            actionType: 'subscription_updated',
            description: `Updated subscription: ${item.name}`,
            metadata: { subscriptionId: item.id, name: item.name },
        });
    },

    async deleteSubscription(accountId: string, id: string): Promise<void> {
        const all = await subscriptionRepository.getAll(accountId);
        const sub = all.find(s => s.id === id);
        await subscriptionRepository.delete(accountId, id);

        await activityRepository.add(accountId, {
            actionType: 'subscription_deleted',
            description: `Deleted subscription: ${sub ? sub.name : id}`,
            metadata: { subscriptionId: id, name: sub?.name },
        });
    },

    // -------------------------------------------------------------------------
    // Scheduled Transactions
    // -------------------------------------------------------------------------
    async getScheduledTransactions(accountId: string): Promise<ScheduledTransaction[]> {
        return scheduledRepository.getAll(accountId);
    },

    async addScheduledTransaction(
        accountId: string,
        item: Omit<ScheduledTransaction, 'id'> & { id?: string }
    ): Promise<ScheduledTransaction> {
        const amount = safeDecimal(item.amount).toNumber();
        const record = await scheduledRepository.add(accountId, {
            ...item,
            id: item.id || generateUUID(),
            amount,
        });

        await activityRepository.add(accountId, {
            actionType: 'scheduled_transaction_created',
            description: `Created scheduled transaction: ${record.name}`,
            metadata: {
                scheduledId: record.id,
                name: record.name,
                amount: record.amount,
                frequency: record.frequency,
                nextDueDate: record.nextDueDate,
            },
        });

        return record;
    },

    async updateScheduledTransaction(accountId: string, item: ScheduledTransaction): Promise<void> {
        await scheduledRepository.update(accountId, item);
        await activityRepository.add(accountId, {
            actionType: 'scheduled_transaction_updated',
            description: `Updated scheduled transaction: ${item.name}`,
            metadata: { scheduledId: item.id, name: item.name },
        });
    },

    async deleteScheduledTransaction(accountId: string, id: string): Promise<void> {
        const all = await scheduledRepository.getAll(accountId);
        const target = all.find(st => st.id === id);
        await scheduledRepository.delete(accountId, id);

        await activityRepository.add(accountId, {
            actionType: 'scheduled_transaction_deleted',
            description: `Deleted scheduled transaction: ${target ? target.name : id}`,
            metadata: { scheduledId: id, name: target?.name },
        });
    },

    // -------------------------------------------------------------------------
    // Investments
    // -------------------------------------------------------------------------
    async getInvestments(accountId: string): Promise<Investment[]> {
        return investmentRepository.getAll(accountId);
    },

    async addInvestment(accountId: string, item: Omit<Investment, 'id'> & { id?: string }): Promise<Investment> {
        const res = await this.recordInvestmentPurchase(accountId, item);
        return res.investment;
    },

    async recordInvestmentPurchase(
        accountId: string,
        item: Omit<Investment, 'id'> & { id?: string },
        categoryName = 'Investments'
    ): Promise<{ investment: Investment; transaction?: Transaction }> {
        const quantity = safeDecimal(item.quantity).toNumber();
        const purchasePrice = safeDecimal(item.purchasePrice).toNumber();
        const currentPrice = safeDecimal(item.currentPrice ?? item.purchasePrice).toNumber();

        if (quantity <= 0) {
            throw new Error('Investment quantity must be greater than zero');
        }
        if (purchasePrice < 0) {
            throw new Error('Purchase price cannot be negative');
        }

        const invRecord: Investment = {
            ...item,
            id: item.id || generateUUID(),
            quantity,
            purchasePrice,
            currentPrice,
        };

        await investmentRepository.save(accountId, invRecord);

        const totalCost = new Decimal(quantity).times(purchasePrice).toNumber();
        const txRecord = await expenseRepository.add(accountId, {
            id: generateUUID(),
            name: `Investment: ${invRecord.name} (${invRecord.quantity} @ ${invRecord.purchasePrice})`,
            amount: totalCost,
            date: invRecord.purchaseDate,
            category: categoryName,
            mood: '📈',
        });

        await activityRepository.add(accountId, {
            actionType: 'investment_purchased',
            description: `Purchased ${invRecord.quantity} units of ${invRecord.name}`,
            metadata: {
                investmentId: invRecord.id,
                name: invRecord.name,
                type: invRecord.type,
                quantity: invRecord.quantity,
                purchasePrice: invRecord.purchasePrice,
                totalCost,
                transactionId: txRecord.id,
            },
        });

        return { investment: invRecord, transaction: txRecord };
    },

    async recordInvestmentSale(
        accountId: string,
        investmentId: string,
        unitsSold?: number,
        salePrice?: number,
        proceedsCategory = 'Investment Proceeds',
        txName?: string
    ): Promise<{
        updatedInvestment: Investment | null;
        transaction: Transaction;
        profitOrLoss: number;
        realizedGainLoss: number;
        saleProceeds: number;
        remainingQuantity: number;
    }> {
        const inv = await investmentRepository.getById(accountId, investmentId);
        if (!inv) {
            throw new Error('Investment not found');
        }

        const actualUnits = unitsSold !== undefined && unitsSold > 0
            ? safeDecimal(unitsSold).toNumber()
            : inv.quantity;

        const actualPrice = salePrice !== undefined && salePrice >= 0
            ? safeDecimal(salePrice).toNumber()
            : inv.currentPrice;

        if (actualUnits <= 0) {
            throw new Error('Sale quantity must be greater than zero');
        }

        if (new Decimal(actualUnits).greaterThan(inv.quantity)) {
            throw new Error('Cannot sell more units than currently held');
        }

        const proceeds = new Decimal(actualUnits).times(actualPrice).toNumber();
        const costBasis = new Decimal(actualUnits).times(inv.purchasePrice).toNumber();
        const profitOrLoss = new Decimal(proceeds).minus(costBasis).toNumber();
        const remainingQuantity = Decimal.max(0, new Decimal(inv.quantity).minus(actualUnits)).toNumber();
        const today = new Date().toISOString().split('T')[0];

        const txRecord = await incomeRepository.add(accountId, {
            id: generateUUID(),
            name: txName || `Sold ${actualUnits} of ${inv.name}`,
            amount: proceeds,
            date: today,
            category: proceedsCategory,
            mood: profitOrLoss >= 0 ? '🎉' : '😥',
        });

        let updatedInv: Investment | null = null;
        if (remainingQuantity <= 0.000001) {
            await investmentRepository.delete(accountId, investmentId);
        } else {
            inv.quantity = remainingQuantity;
            await investmentRepository.save(accountId, inv);
            updatedInv = inv;
        }

        await activityRepository.add(accountId, {
            actionType: 'investment_sold',
            description: `Sold ${actualUnits} of ${inv.name}`,
            metadata: {
                investmentId,
                name: inv.name,
                unitsSold: actualUnits,
                salePrice: actualPrice,
                proceeds,
                profitOrLoss,
                remainingQuantity,
                transactionId: txRecord.id,
            },
        });

        return {
            updatedInvestment: updatedInv,
            transaction: txRecord,
            profitOrLoss,
            realizedGainLoss: profitOrLoss,
            saleProceeds: proceeds,
            remainingQuantity,
        };
    },

    async updateInvestment(accountId: string, item: Investment): Promise<void> {
        await investmentRepository.save(accountId, item);
        await activityRepository.add(accountId, {
            actionType: 'investment_updated',
            description: `Updated investment: ${item.name}`,
            metadata: { investmentId: item.id, name: item.name },
        });
    },

    async deleteInvestment(accountId: string, id: string): Promise<void> {
        const inv = await investmentRepository.getById(accountId, id);
        await investmentRepository.delete(accountId, id);

        await activityRepository.add(accountId, {
            actionType: 'investment_deleted',
            description: `Deleted investment: ${inv ? inv.name : id}`,
            metadata: { investmentId: id, name: inv?.name },
        });
    },

    // -------------------------------------------------------------------------
    // Activity History
    // -------------------------------------------------------------------------
    async getActivityLogs(accountId: string, limit?: number): Promise<ActivityLogEntry[]> {
        return activityRepository.getAll(accountId, limit);
    },

    async logActivity(
        accountId: string,
        actionType: ActivityActionType,
        description: string,
        metadata?: Record<string, any>
    ): Promise<ActivityLogEntry> {
        return activityRepository.add(accountId, {
            actionType,
            description,
            metadata,
        });
    },

    async clearActivityLogs(accountId: string): Promise<void> {
        await activityRepository.clear(accountId);
        await activityRepository.add(accountId, {
            actionType: 'data_cleared',
            description: 'Cleared activity history log',
        });
    },

    // -------------------------------------------------------------------------
    // Data Retention, Purge, Export & Import
    // -------------------------------------------------------------------------
    async purgeFinancialData(accountId: string): Promise<void> {
        await purgeAccountFinancialData(accountId);
        await activityRepository.add(accountId, {
            actionType: 'data_cleared',
            description: 'Purged all financial records',
            metadata: { purgedAt: new Date().toISOString() },
        });
    },

    async deleteAccountData(accountId: string): Promise<void> {
        await deleteAllAccountData(accountId);
    },

    async exportAllUserData(accountId: string): Promise<ExportBackupData> {
        const [
            profile,
            preferences,
            income,
            expenses,
            savingsGoals,
            loans,
            subscriptions,
            scheduledTransactions,
            investments,
            activityHistory,
        ] = await Promise.all([
            profileRepository.get(accountId),
            preferencesRepository.get(accountId),
            incomeRepository.getAll(accountId),
            expenseRepository.getAll(accountId),
            savingsRepository.getAll(accountId),
            loanRepository.getAll(accountId),
            subscriptionRepository.getAll(accountId),
            scheduledRepository.getAll(accountId),
            investmentRepository.getAll(accountId),
            activityRepository.getAll(accountId),
        ]);

        const backup: ExportBackupData = {
            schemaVersion: 2,
            exportedAt: new Date().toISOString(),
            accountId,
            profile,
            preferences,
            income,
            expenses,
            savingsGoals,
            loans,
            subscriptions,
            scheduledTransactions,
            investments,
            activityHistory,
        };

        await activityRepository.add(accountId, {
            actionType: 'data_exported',
            description: 'Exported local backup archive',
            metadata: {
                totalIncome: income.length,
                totalExpenses: expenses.length,
                totalSavings: savingsGoals.length,
                totalLoans: loans.length,
            },
        });

        return backup;
    },

    async importAllUserData(
        accountId: string,
        backup: any,
        mode: 'merge' | 'replace' = 'merge'
    ): Promise<{ status: 'success'; importedCount: number }> {
        if (!backup || typeof backup !== 'object') {
            throw new Error('Invalid backup file: Payload must be a JSON object.');
        }

        // Validate structure
        const isV2 = backup.schemaVersion === 2 || (backup.schemaVersion && Number(backup.schemaVersion) >= 2);
        const isV1 = !isV2 && (Array.isArray(backup.income) || Array.isArray(backup.expenses));

        if (!isV2 && !isV1) {
            throw new Error('Unsupported or malformed backup format. Missing schema version and financial records.');
        }

        // STEP 1: Deep Validation of all records prior to starting any write transaction
        const validatedIncome: (Transaction & { accountId: string })[] = [];
        if (Array.isArray(backup.income)) {
            for (let i = 0; i < backup.income.length; i++) {
                const item = backup.income[i];
                if (!item || typeof item !== 'object') {
                    throw new Error(`Invalid income item at index ${i}: expected object.`);
                }
                const amt = Number(item.amount);
                if (!Number.isFinite(amt) || amt < 0) {
                    throw new Error(`Invalid income item "${item.name || i}": amount must be a positive finite number.`);
                }
                const dateStr = typeof item.date === 'string' && item.date ? item.date : new Date().toISOString().split('T')[0];
                if (Number.isNaN(new Date(dateStr).getTime())) {
                    throw new Error(`Invalid income item "${item.name || i}": invalid date.`);
                }
                validatedIncome.push({
                    id: typeof item.id === 'string' && item.id ? item.id : generateUUID(),
                    accountId,
                    name: String(item.name || 'Imported Income'),
                    amount: safeDecimal(item.amount).toNumber(),
                    date: dateStr,
                    category: String(item.category || 'Other'),
                    mood: typeof item.mood === 'string' ? item.mood : undefined,
                });
            }
        }

        const validatedExpenses: (Transaction & { accountId: string })[] = [];
        if (Array.isArray(backup.expenses)) {
            for (let i = 0; i < backup.expenses.length; i++) {
                const item = backup.expenses[i];
                if (!item || typeof item !== 'object') {
                    throw new Error(`Invalid expense item at index ${i}: expected object.`);
                }
                const amt = Number(item.amount);
                if (!Number.isFinite(amt) || amt < 0) {
                    throw new Error(`Invalid expense item "${item.name || i}": amount must be a positive finite number.`);
                }
                const dateStr = typeof item.date === 'string' && item.date ? item.date : new Date().toISOString().split('T')[0];
                if (Number.isNaN(new Date(dateStr).getTime())) {
                    throw new Error(`Invalid expense item "${item.name || i}": invalid date.`);
                }
                validatedExpenses.push({
                    id: typeof item.id === 'string' && item.id ? item.id : generateUUID(),
                    accountId,
                    name: String(item.name || 'Imported Expense'),
                    amount: safeDecimal(item.amount).toNumber(),
                    date: dateStr,
                    category: String(item.category || 'Other'),
                    mood: typeof item.mood === 'string' ? item.mood : undefined,
                });
            }
        }

        const validatedGoals: (SavingsGoal & { accountId: string })[] = [];
        if (Array.isArray(backup.savingsGoals)) {
            for (let i = 0; i < backup.savingsGoals.length; i++) {
                const item = backup.savingsGoals[i];
                if (!item || typeof item !== 'object') {
                    throw new Error(`Invalid savings goal at index ${i}: expected object.`);
                }
                const target = Number(item.targetAmount);
                if (!Number.isFinite(target) || target < 0) {
                    throw new Error(`Invalid savings goal "${item.name || i}": target amount must be a positive number.`);
                }
                const validContribs = Array.isArray(item.extraContributions)
                    ? item.extraContributions.map((ec: any) => ({
                          id: typeof ec.id === 'string' && ec.id ? ec.id : generateUUID(),
                          amount: safeDecimal(ec.amount).toNumber(),
                          date: typeof ec.date === 'string' ? ec.date : new Date().toISOString().split('T')[0],
                      }))
                    : [];
                validatedGoals.push({
                    id: typeof item.id === 'string' && item.id ? item.id : generateUUID(),
                    accountId,
                    name: String(item.name || 'Imported Goal'),
                    targetAmount: safeDecimal(item.targetAmount).toNumber(),
                    deadline: typeof item.deadline === 'string' ? item.deadline : new Date().toISOString().split('T')[0],
                    startingBalance: safeDecimal(item.startingBalance).toNumber(),
                    monthlyContribution: safeDecimal(item.monthlyContribution).toNumber(),
                    interestRate: safeDecimal(item.interestRate).toNumber(),
                    compoundingFrequency: item.compoundingFrequency || 'monthly',
                    extraContributions: validContribs,
                });
            }
        }

        const validatedLoans: (Loan & { accountId: string })[] = [];
        if (Array.isArray(backup.loans)) {
            for (let i = 0; i < backup.loans.length; i++) {
                const item = backup.loans[i];
                if (!item || typeof item !== 'object') {
                    throw new Error(`Invalid loan item at index ${i}: expected object.`);
                }
                const totalAmt = Number(item.totalAmount);
                if (!Number.isFinite(totalAmt) || totalAmt < 0) {
                    throw new Error(`Invalid loan item "${item.person || i}": total amount must be a positive number.`);
                }
                const validRepayments = Array.isArray(item.repayments)
                    ? item.repayments.map((r: any) => ({
                          id: typeof r.id === 'string' && r.id ? r.id : generateUUID(),
                          amount: safeDecimal(r.amount).toNumber(),
                          date: typeof r.date === 'string' ? r.date : new Date().toISOString().split('T')[0],
                      }))
                    : [];
                validatedLoans.push({
                    id: typeof item.id === 'string' && item.id ? item.id : generateUUID(),
                    accountId,
                    person: String(item.person || 'Unknown Person'),
                    type: item.type === LoanType.Borrowed ? LoanType.Borrowed : LoanType.Lent,
                    totalAmount: safeDecimal(item.totalAmount).toNumber(),
                    outstandingAmount: safeDecimal(item.outstandingAmount ?? item.totalAmount).toNumber(),
                    interestRate: safeDecimal(item.interestRate).toNumber(),
                    interestType: item.interestType || 'simple',
                    date: typeof item.date === 'string' ? item.date : new Date().toISOString().split('T')[0],
                    dueDate: typeof item.dueDate === 'string' ? item.dueDate : new Date().toISOString().split('T')[0],
                    repaymentSchedule: item.repaymentSchedule || 'one-time',
                    notes: typeof item.notes === 'string' ? item.notes : '',
                    repayments: validRepayments,
                });
            }
        }

        const validatedSubs: (Subscription & { accountId: string })[] = [];
        if (Array.isArray(backup.subscriptions)) {
            for (let i = 0; i < backup.subscriptions.length; i++) {
                const item = backup.subscriptions[i];
                if (!item || typeof item !== 'object') {
                    throw new Error(`Invalid subscription at index ${i}: expected object.`);
                }
                validatedSubs.push({
                    id: typeof item.id === 'string' && item.id ? item.id : generateUUID(),
                    accountId,
                    name: String(item.name || 'Subscription'),
                    type: item.type || 'expense',
                    amount: safeDecimal(item.amount).toNumber(),
                    frequency: item.frequency || 'monthly',
                    renewalDate: typeof item.renewalDate === 'string' ? item.renewalDate : new Date().toISOString().split('T')[0],
                    category: String(item.category || 'General'),
                    cancellationUrl: typeof item.cancellationUrl === 'string' ? item.cancellationUrl : undefined,
                    isVariable: Boolean(item.isVariable),
                    health: item.health || 'good',
                });
            }
        }

        const validatedScheduled: (ScheduledTransaction & { accountId: string })[] = [];
        if (Array.isArray(backup.scheduledTransactions)) {
            for (let i = 0; i < backup.scheduledTransactions.length; i++) {
                const item = backup.scheduledTransactions[i];
                if (!item || typeof item !== 'object') {
                    throw new Error(`Invalid scheduled transaction at index ${i}: expected object.`);
                }
                validatedScheduled.push({
                    id: typeof item.id === 'string' && item.id ? item.id : generateUUID(),
                    accountId,
                    name: String(item.name || 'Scheduled'),
                    amount: safeDecimal(item.amount).toNumber(),
                    category: String(item.category || 'General'),
                    type: item.type || 'expense',
                    frequency: item.frequency || 'monthly',
                    startDate: typeof item.startDate === 'string' ? item.startDate : new Date().toISOString().split('T')[0],
                    endDate: typeof item.endDate === 'string' ? item.endDate : undefined,
                    nextDueDate: typeof item.nextDueDate === 'string' ? item.nextDueDate : new Date().toISOString().split('T')[0],
                    notes: typeof item.notes === 'string' ? item.notes : undefined,
                    variance: item.variance !== undefined ? safeDecimal(item.variance).toNumber() : undefined,
                });
            }
        }

        const validatedInvestments: (Investment & { accountId: string })[] = [];
        if (Array.isArray(backup.investments)) {
            for (let i = 0; i < backup.investments.length; i++) {
                const item = backup.investments[i];
                if (!item || typeof item !== 'object') {
                    throw new Error(`Invalid investment asset at index ${i}: expected object.`);
                }
                validatedInvestments.push({
                    id: typeof item.id === 'string' && item.id ? item.id : generateUUID(),
                    accountId,
                    name: String(item.name || 'Investment Asset'),
                    type: item.type || 'Stock',
                    quantity: safeDecimal(item.quantity).toNumber(),
                    purchasePrice: safeDecimal(item.purchasePrice).toNumber(),
                    purchaseDate: typeof item.purchaseDate === 'string' ? item.purchaseDate : new Date().toISOString().split('T')[0],
                    currentPrice: safeDecimal(item.currentPrice ?? item.purchasePrice).toNumber(),
                    notes: typeof item.notes === 'string' ? item.notes : undefined,
                });
            }
        }

        // STEP 2: Atomic Transactional Write
        // A single IDB readwrite transaction across all stores ensures zero partial data on failure
        const totalImported = await withWriteTransaction(ALL_STORES, async (stores) => {
            // In replace mode, purge previous financial data inside this atomic transaction
            if (mode === 'replace') {
                await idbDeleteByAccountInStore(stores.income, accountId);
                await idbDeleteByAccountInStore(stores.expenses, accountId);
                await idbDeleteByAccountInStore(stores.savingsGoals, accountId);
                await idbDeleteByAccountInStore(stores.loans, accountId);
                await idbDeleteByAccountInStore(stores.subscriptions, accountId);
                await idbDeleteByAccountInStore(stores.scheduledTransactions, accountId);
                await idbDeleteByAccountInStore(stores.investments, accountId);
            }

            let count = 0;

            // Income
            const existingIncomeIds = mode === 'merge' ? await idbGetExistingIdsInStore(stores.income, accountId) : new Set<string>();
            for (const item of validatedIncome) {
                if (mode === 'merge' && existingIncomeIds.has(item.id)) continue;
                stores.income.put(item);
                count++;
            }

            // Expenses
            const existingExpenseIds = mode === 'merge' ? await idbGetExistingIdsInStore(stores.expenses, accountId) : new Set<string>();
            for (const item of validatedExpenses) {
                if (mode === 'merge' && existingExpenseIds.has(item.id)) continue;
                stores.expenses.put(item);
                count++;
            }

            // Savings Goals
            const existingGoalIds = mode === 'merge' ? await idbGetExistingIdsInStore(stores.savingsGoals, accountId) : new Set<string>();
            for (const item of validatedGoals) {
                if (mode === 'merge' && existingGoalIds.has(item.id)) continue;
                stores.savingsGoals.put(item);
                count++;
            }

            // Loans
            const existingLoanIds = mode === 'merge' ? await idbGetExistingIdsInStore(stores.loans, accountId) : new Set<string>();
            for (const item of validatedLoans) {
                if (mode === 'merge' && existingLoanIds.has(item.id)) continue;
                stores.loans.put(item);
                count++;
            }

            // Subscriptions
            const existingSubIds = mode === 'merge' ? await idbGetExistingIdsInStore(stores.subscriptions, accountId) : new Set<string>();
            for (const item of validatedSubs) {
                if (mode === 'merge' && existingSubIds.has(item.id)) continue;
                stores.subscriptions.put(item);
                count++;
            }

            // Scheduled
            const existingSchedIds = mode === 'merge' ? await idbGetExistingIdsInStore(stores.scheduledTransactions, accountId) : new Set<string>();
            for (const item of validatedScheduled) {
                if (mode === 'merge' && existingSchedIds.has(item.id)) continue;
                stores.scheduledTransactions.put(item);
                count++;
            }

            // Investments
            const existingInvIds = mode === 'merge' ? await idbGetExistingIdsInStore(stores.investments, accountId) : new Set<string>();
            for (const item of validatedInvestments) {
                if (mode === 'merge' && existingInvIds.has(item.id)) continue;
                stores.investments.put(item);
                count++;
            }

            // Profile
            if (backup.profile && typeof backup.profile === 'object') {
                stores.profiles.put({
                    accountId,
                    name: typeof backup.profile.name === 'string' ? backup.profile.name.trim() : 'User',
                    email: typeof backup.profile.email === 'string' ? backup.profile.email.trim() : '',
                    avatar: typeof backup.profile.avatar === 'string' ? backup.profile.avatar : '',
                });
            }

            // Preferences
            if (backup.preferences && typeof backup.preferences === 'object') {
                stores.preferences.put({
                    accountId,
                    ...backup.preferences,
                });
            }

            // Activity Log
            stores.activityHistory.put({
                id: generateUUID(),
                accountId,
                actionType: 'data_imported',
                description: `Imported ${count} financial items (${mode} mode)`,
                timestamp: new Date().toISOString(),
                metadata: {
                    mode,
                    importedCount: count,
                    importedAt: new Date().toISOString(),
                },
            });

            return count;
        });

        return { status: 'success', importedCount: totalImported };
    },
};
