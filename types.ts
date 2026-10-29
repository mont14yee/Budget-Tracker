export enum ViewType {
    Dashboard = 'dashboard',
    Income = 'income',
    Expenses = 'expenses',
    More = 'more',
    Settings = 'settings',
    Investments = 'investments',
}

export enum FeatureType {
    Savings = 'savings',
    Loans = 'loans',
    BillsAndPayments = 'billsAndPayments',
    Reports = 'reports',
    // Backwards compatibility aliases
    Subscriptions = 'billsAndPayments',
    Scheduled = 'billsAndPayments',
}

export enum TransactionType {
    Income = 'income',
    Expense = 'expense',
    Shopping = 'shopping',
}

export type Category = string;

export interface Transaction {
    id: string;
    name: string;
    amount: number;
    date: string;
    category: Category;
    mood?: string;
    notes?: string;
}

export interface AllTransaction extends Transaction {
    type: TransactionType;
}

export enum CompoundingFrequency {
    Daily = 'daily',
    Monthly = 'monthly',
    Yearly = 'yearly',
}

export interface ExtraContribution {
    id: string;
    amount: number;
    date: string;
}

export interface SavingsGoal {
    id: string;
    name: string;
    targetAmount: number;
    deadline: string;
    startingBalance: number;
    monthlyContribution: number;
    interestRate: number; // APY as percentage
    compoundingFrequency: CompoundingFrequency;
    extraContributions: ExtraContribution[];
}

// New Types for Loans Feature
export enum LoanType {
    Lent = 'lent',
    Borrowed = 'borrowed',
}

export enum InterestType {
    Simple = 'simple',
    Compound = 'compound',
}

export enum RepaymentSchedule {
    OneTime = 'one-time',
    Monthly = 'monthly',
}

export interface Repayment {
    id: string;
    amount: number;
    date: string;
}

export interface Loan {
    id: string;
    type: LoanType;
    person: string; // Borrower or Lender name
    totalAmount: number;
    outstandingAmount: number;
    interestRate: number; // Storing as percentage, e.g., 5 for 5%
    interestType: InterestType;
    date: string; // Date the loan was given/taken
    dueDate: string;
    repaymentSchedule: RepaymentSchedule;
    notes: string;
    repayments: Repayment[];
}

export interface Investment {
    id: string;
    name: string; // e.g., 'AAPL' or 'Vanguard S&P 500 ETF'
    type: 'Stock' | 'ETF' | 'Crypto' | 'Mutual Fund' | 'Other';
    quantity: number;
    purchasePrice: number; // Price per unit at purchase
    purchaseDate: string;
    currentPrice: number; // Current price per unit
    notes?: string;
}

export enum Frequency {
    None = 'none',
    Weekly = 'weekly',
    Biweekly = 'biweekly',
    Monthly = 'monthly',
    Yearly = 'yearly',
}

export interface ScheduledTransaction {
    id: string;
    name: string;
    amount: number;
    category: Category;
    type: TransactionType.Income | TransactionType.Expense;
    frequency: Frequency;
    startDate: string;
    endDate?: string;
    nextDueDate: string;
    notes?: string;
    variance?: number; // e.g. 15 for ±15%
    isPaused?: boolean;
}

export interface CurrencySettings {
    symbol: string;
    symbolPlacement: 'before' | 'after';
    numberFormat: 'comma-dot' | 'dot-comma' | 'space-dot';
    decimalPlaces: number;
}

export interface UserProfile {
    name: string;
    email: string;
    avatar?: string;
    monthlySpendingLimit?: number;
}

// New Types for Subscriptions Feature
export enum SubscriptionType {
    Expense = 'expense',
    Income = 'income',
}

export enum SubscriptionHealth {
    Good = 'good', // value-packed
    Review = 'review', // review-worthy
}

export interface Subscription {
    id: string;
    name: string;
    type: SubscriptionType;
    amount: number;
    frequency: Frequency;
    renewalDate: string;
    category: string;
    cancellationUrl?: string;
    isVariable?: boolean; // For income streams with variability
    health: SubscriptionHealth;
    isPaused?: boolean;
}

export type ActivityActionType =
    | 'account_created'
    | 'sign_in'
    | 'sign_out'
    | 'income_added'
    | 'income_updated'
    | 'income_deleted'
    | 'expense_added'
    | 'expense_updated'
    | 'expense_deleted'
    | 'savings_goal_created'
    | 'savings_goal_updated'
    | 'savings_contribution_added'
    | 'savings_goal_deleted'
    | 'loan_created'
    | 'loan_repayment_recorded'
    | 'loan_deleted'
    | 'subscription_created'
    | 'subscription_updated'
    | 'subscription_deleted'
    | 'scheduled_transaction_created'
    | 'scheduled_transaction_updated'
    | 'scheduled_transaction_deleted'
    | 'investment_purchased'
    | 'investment_sold'
    | 'investment_updated'
    | 'investment_deleted'
    | 'profile_updated'
    | 'settings_changed'
    | 'data_imported'
    | 'data_exported'
    | 'data_cleared';

export interface ActivityLogEntry {
    id: string;
    accountId: string;
    actionType: ActivityActionType;
    timestamp: string; // ISO 8601 string
    description: string;
    metadata?: Record<string, any>;
}

export interface UserPreferences {
    theme?: 'light' | 'dark';
    language?: 'en' | 'am';
    currencySettings?: CurrencySettings;
    currency_symbol?: string;
    currency_placement?: 'before' | 'after';
    currency_format?: 'comma-dot' | 'dot-comma' | 'space-dot';
    decimal_places?: number;
}
