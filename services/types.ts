/**
 * Strongly-typed Database Record Definitions for Local Storage & Sync Models
 */

export interface ProfileRow {
    id: string; // uuid
    name: string | null;
    email: string | null;
    avatar: string | null;
    monthly_spending_limit?: number | null;
    created_at: string;
    updated_at: string;
}

export interface UserPreferencesRow {
    id: string; // uuid
    theme: 'light' | 'dark';
    language: 'en' | 'am';
    currency_symbol: string;
    currency_placement: 'before' | 'after';
    currency_format: 'comma-dot' | 'dot-comma' | 'space-dot';
    decimal_places: number;
    created_at: string;
    updated_at: string;
}

export interface IncomeRow {
    id: string; // uuid
    user_id: string; // uuid
    name: string;
    amount: number | string; // Postgres numeric(12,2)
    date: string; // YYYY-MM-DD
    category: string;
    created_at: string;
}

export interface ExpenseRow {
    id: string; // uuid
    user_id: string; // uuid
    name: string;
    amount: number | string; // Postgres numeric(12,2)
    date: string; // YYYY-MM-DD
    category: string;
    mood: string | null;
    created_at: string;
}

export interface SavingsGoalRow {
    id: string; // uuid
    user_id: string; // uuid
    name: string;
    target_amount: number | string;
    deadline: string; // YYYY-MM-DD
    starting_balance: number | string;
    monthly_contribution: number | string;
    interest_rate: number | string;
    compounding_frequency: 'daily' | 'monthly' | 'yearly';
    created_at: string;
}

export interface ExtraContributionRow {
    id: string; // uuid
    user_id: string; // uuid
    savings_goal_id: string; // uuid
    amount: number | string;
    date: string; // YYYY-MM-DD
    created_at: string;
}

export interface LoanRow {
    id: string; // uuid
    user_id: string; // uuid
    type: 'lent' | 'borrowed';
    person: string;
    total_amount: number | string;
    outstanding_amount: number | string;
    interest_rate: number | string;
    interest_type: 'simple' | 'compound';
    date: string; // YYYY-MM-DD
    due_date: string; // YYYY-MM-DD
    repayment_schedule: 'one-time' | 'monthly';
    notes: string | null;
    created_at: string;
}

export interface RepaymentRow {
    id: string; // uuid
    user_id: string; // uuid
    loan_id: string; // uuid
    amount: number | string;
    date: string; // YYYY-MM-DD
    created_at: string;
}

export interface SubscriptionRow {
    id: string; // uuid
    user_id: string; // uuid
    name: string;
    type: 'expense' | 'income';
    amount: number | string;
    frequency: 'none' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
    renewal_date: string; // YYYY-MM-DD
    category: string;
    cancellation_url: string | null;
    is_variable: boolean | null;
    health: 'good' | 'review';
    created_at: string;
}

export interface ScheduledTransactionRow {
    id: string; // uuid
    user_id: string; // uuid
    name: string;
    amount: number | string;
    category: string;
    type: 'income' | 'expense';
    frequency: 'none' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
    start_date: string; // YYYY-MM-DD
    end_date: string | null; // YYYY-MM-DD
    next_due_date: string; // YYYY-MM-DD
    notes: string | null;
    variance: number | string | null;
    created_at: string;
}

export interface InvestmentRow {
    id: string; // uuid
    user_id: string; // uuid
    name: string;
    type: 'Stock' | 'ETF' | 'Crypto' | 'Mutual Fund' | 'Other';
    quantity: number | string; // numeric(18,8)
    purchase_price: number | string;
    purchase_date: string; // YYYY-MM-DD
    current_price: number | string;
    notes: string | null;
    created_at: string;
}

/**
 * Pagination & Query Types
 */
export interface PaginationOptions {
    page?: number;
    limit?: number;
    offset?: number;
}

export interface PaginatedResult<T> {
    data: T[];
    totalCount: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface TransactionFilterOptions extends PaginationOptions {
    startDate?: string;
    endDate?: string;
    category?: string;
    search?: string;
}

/**
 * Personal Data Export & Import Types
 */
export interface PersonalDataBackup {
    version: string;
    appName: string;
    exportedAt: string;
    userId: string;
    profile?: Partial<ProfileRow>;
    preferences?: Partial<UserPreferencesRow>;
    income: Omit<IncomeRow, 'user_id' | 'created_at'>[];
    expenses: Omit<ExpenseRow, 'user_id' | 'created_at'>[];
    savingsGoals: (Omit<SavingsGoalRow, 'user_id' | 'created_at'> & {
        extraContributions?: Omit<ExtraContributionRow, 'user_id' | 'savings_goal_id' | 'created_at'>[];
    })[];
    loans: (Omit<LoanRow, 'user_id' | 'created_at'> & {
        repayments?: Omit<RepaymentRow, 'user_id' | 'loan_id' | 'created_at'>[];
    })[];
    subscriptions: Omit<SubscriptionRow, 'user_id' | 'created_at'>[];
    scheduledTransactions: Omit<ScheduledTransactionRow, 'user_id' | 'created_at'>[];
    investments: Omit<InvestmentRow, 'user_id' | 'created_at'>[];
}

export interface ImportSummary {
    incomeCount: number;
    expenseCount: number;
    savingsGoalsCount: number;
    loansCount: number;
    subscriptionsCount: number;
    scheduledCount: number;
    investmentsCount: number;
    mode: 'merge' | 'replace';
}

