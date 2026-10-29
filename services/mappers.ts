import {
    Transaction,
    SavingsGoal,
    ExtraContribution,
    Loan,
    Repayment,
    Subscription,
    ScheduledTransaction,
    Investment,
    UserProfile,
    CompoundingFrequency,
    LoanType,
    InterestType,
    RepaymentSchedule,
    SubscriptionType,
    SubscriptionHealth,
    Frequency,
    TransactionType,
    CurrencySettings,
} from '../types';
import {
    IncomeRow,
    ExpenseRow,
    SavingsGoalRow,
    ExtraContributionRow,
    LoanRow,
    RepaymentRow,
    SubscriptionRow,
    ScheduledTransactionRow,
    InvestmentRow,
    ProfileRow,
    UserPreferencesRow,
} from './types';
import { roundMoney, toDecimal, ensureUUID } from '../utils/money';

/**
 * Income Mappers
 */
export const mapIncomeRowToTransaction = (row: IncomeRow): Transaction => ({
    id: row.id,
    name: row.name,
    amount: roundMoney(row.amount, 2),
    date: row.date,
    category: row.category,
});

export const mapTransactionToIncomeRow = (
    userId: string,
    item: Omit<Transaction, 'id'> & { id?: string }
): Omit<IncomeRow, 'created_at'> => ({
    id: ensureUUID(item.id),
    user_id: ensureUUID(userId),
    name: item.name.trim(),
    amount: roundMoney(item.amount, 2),
    date: item.date,
    category: item.category.trim(),
});

/**
 * Expense Mappers
 */
export const mapExpenseRowToTransaction = (row: ExpenseRow): Transaction => ({
    id: row.id,
    name: row.name,
    amount: roundMoney(row.amount, 2),
    date: row.date,
    category: row.category,
    mood: row.mood || undefined,
});

export const mapTransactionToExpenseRow = (
    userId: string,
    item: Omit<Transaction, 'id'> & { id?: string }
): Omit<ExpenseRow, 'created_at'> => ({
    id: ensureUUID(item.id),
    user_id: ensureUUID(userId),
    name: item.name.trim(),
    amount: roundMoney(item.amount, 2),
    date: item.date,
    category: item.category.trim(),
    mood: item.mood || null,
});

/**
 * Extra Contribution Mappers
 */
export const mapExtraContributionRow = (row: ExtraContributionRow): ExtraContribution => ({
    id: row.id,
    amount: roundMoney(row.amount, 2),
    date: row.date,
});

export const mapContributionToRow = (
    userId: string,
    goalId: string,
    item: Omit<ExtraContribution, 'id'> & { id?: string }
): Omit<ExtraContributionRow, 'created_at'> => ({
    id: ensureUUID(item.id),
    user_id: ensureUUID(userId),
    savings_goal_id: ensureUUID(goalId),
    amount: roundMoney(item.amount, 2),
    date: item.date,
});

/**
 * Savings Goal Mappers
 */
export const mapSavingsGoalRow = (
    row: SavingsGoalRow,
    extraContributions: ExtraContributionRow[] = []
): SavingsGoal => ({
    id: row.id,
    name: row.name,
    targetAmount: roundMoney(row.target_amount, 2),
    deadline: row.deadline,
    startingBalance: roundMoney(row.starting_balance, 2),
    monthlyContribution: roundMoney(row.monthly_contribution, 2),
    interestRate: roundMoney(row.interest_rate, 2),
    compoundingFrequency: row.compounding_frequency as CompoundingFrequency,
    extraContributions: extraContributions.map(mapExtraContributionRow),
});

export const mapSavingsGoalToRow = (
    userId: string,
    item: Omit<SavingsGoal, 'id' | 'extraContributions'> & { id?: string }
): Omit<SavingsGoalRow, 'created_at'> => ({
    id: ensureUUID(item.id),
    user_id: ensureUUID(userId),
    name: item.name.trim(),
    target_amount: roundMoney(item.targetAmount, 2),
    deadline: item.deadline,
    starting_balance: roundMoney(item.startingBalance, 2),
    monthly_contribution: roundMoney(item.monthlyContribution, 2),
    interest_rate: roundMoney(item.interestRate, 2),
    compounding_frequency: item.compoundingFrequency,
});

/**
 * Loan & Repayment Mappers
 */
export const mapRepaymentRow = (row: RepaymentRow): Repayment => ({
    id: row.id,
    amount: roundMoney(row.amount, 2),
    date: row.date,
});

export const mapRepaymentToRow = (
    userId: string,
    loanId: string,
    item: Omit<Repayment, 'id'> & { id?: string }
): Omit<RepaymentRow, 'created_at'> => ({
    id: ensureUUID(item.id),
    user_id: ensureUUID(userId),
    loan_id: ensureUUID(loanId),
    amount: roundMoney(item.amount, 2),
    date: item.date,
});

export const mapLoanRow = (row: LoanRow, repayments: RepaymentRow[] = []): Loan => ({
    id: row.id,
    type: row.type as LoanType,
    person: row.person,
    totalAmount: roundMoney(row.total_amount, 2),
    outstandingAmount: roundMoney(row.outstanding_amount, 2),
    interestRate: roundMoney(row.interest_rate, 2),
    interestType: row.interest_type as InterestType,
    date: row.date,
    dueDate: row.due_date,
    repaymentSchedule: row.repayment_schedule as RepaymentSchedule,
    notes: row.notes || '',
    repayments: repayments.map(mapRepaymentRow),
});

export const mapLoanToRow = (
    userId: string,
    item: Omit<Loan, 'id' | 'repayments'> & { id?: string }
): Omit<LoanRow, 'created_at'> => ({
    id: ensureUUID(item.id),
    user_id: ensureUUID(userId),
    type: item.type,
    person: item.person.trim(),
    total_amount: roundMoney(item.totalAmount, 2),
    outstanding_amount: roundMoney(item.outstandingAmount, 2),
    interest_rate: roundMoney(item.interestRate, 2),
    interest_type: item.interestType,
    date: item.date,
    due_date: item.dueDate,
    repayment_schedule: item.repaymentSchedule,
    notes: item.notes || null,
});

/**
 * Subscription Mappers
 */
export const mapSubscriptionRow = (row: SubscriptionRow): Subscription => ({
    id: row.id,
    name: row.name,
    type: row.type as SubscriptionType,
    amount: roundMoney(row.amount, 2),
    frequency: row.frequency as Frequency,
    renewalDate: row.renewal_date,
    category: row.category,
    cancellationUrl: row.cancellation_url || undefined,
    isVariable: row.is_variable ?? undefined,
    health: row.health as SubscriptionHealth,
});

export const mapSubscriptionToRow = (
    userId: string,
    item: Omit<Subscription, 'id'> & { id?: string }
): Omit<SubscriptionRow, 'created_at'> => ({
    id: ensureUUID(item.id),
    user_id: ensureUUID(userId),
    name: item.name.trim(),
    type: item.type,
    amount: roundMoney(item.amount, 2),
    frequency: item.frequency,
    renewal_date: item.renewalDate,
    category: item.category.trim(),
    cancellation_url: item.cancellationUrl || null,
    is_variable: item.isVariable ?? false,
    health: item.health,
});

/**
 * Scheduled Transaction Mappers
 */
export const mapScheduledTransactionRow = (row: ScheduledTransactionRow): ScheduledTransaction => ({
    id: row.id,
    name: row.name,
    amount: roundMoney(row.amount, 2),
    category: row.category,
    type: row.type === 'income' ? TransactionType.Income : TransactionType.Expense,
    frequency: row.frequency as Frequency,
    startDate: row.start_date,
    endDate: row.end_date || undefined,
    nextDueDate: row.next_due_date,
    notes: row.notes || undefined,
    variance: row.variance ? roundMoney(row.variance, 2) : undefined,
});

export const mapScheduledTransactionToRow = (
    userId: string,
    item: Omit<ScheduledTransaction, 'id'> & { id?: string }
): Omit<ScheduledTransactionRow, 'created_at'> => ({
    id: ensureUUID(item.id),
    user_id: ensureUUID(userId),
    name: item.name.trim(),
    amount: roundMoney(item.amount, 2),
    category: item.category.trim(),
    type: item.type === TransactionType.Income ? 'income' : 'expense',
    frequency: item.frequency,
    start_date: item.startDate,
    end_date: item.endDate || null,
    next_due_date: item.nextDueDate,
    notes: item.notes || null,
    variance: item.variance !== undefined ? roundMoney(item.variance, 2) : null,
});

/**
 * Investment Mappers
 */
export const mapInvestmentRow = (row: InvestmentRow): Investment => ({
    id: row.id,
    name: row.name,
    type: row.type,
    quantity: toDecimal(row.quantity).toDecimalPlaces(8).toNumber(),
    purchasePrice: roundMoney(row.purchase_price, 2),
    purchaseDate: row.purchase_date,
    currentPrice: roundMoney(row.current_price, 2),
    notes: row.notes || undefined,
});

export const mapInvestmentToRow = (
    userId: string,
    item: Omit<Investment, 'id'> & { id?: string }
): Omit<InvestmentRow, 'created_at'> => ({
    id: ensureUUID(item.id),
    user_id: ensureUUID(userId),
    name: item.name.trim(),
    type: item.type,
    quantity: toDecimal(item.quantity).toDecimalPlaces(8).toNumber(),
    purchase_price: roundMoney(item.purchasePrice, 2),
    purchase_date: item.purchaseDate,
    current_price: roundMoney(item.currentPrice, 2),
    notes: item.notes || null,
});

/**
 * Profile & Preference Mappers
 */
export const mapProfileRow = (row: ProfileRow): UserProfile => ({
    name: row.name || 'User',
    email: row.email || '',
    avatar: row.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    monthlySpendingLimit: row.monthly_spending_limit ? Number(row.monthly_spending_limit) : undefined,
});

export const mapUserPreferencesRow = (row: UserPreferencesRow) => ({
    theme: row.theme,
    language: row.language,
    currencySettings: {
        symbol: row.currency_symbol,
        symbolPlacement: row.currency_placement,
        numberFormat: row.currency_format,
        decimalPlaces: row.decimal_places,
    } as CurrencySettings,
});
