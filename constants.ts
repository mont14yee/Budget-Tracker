import { Transaction, SavingsGoal, CurrencySettings, Loan, Subscription, ScheduledTransaction, Investment } from './types';
import { Language } from './locales';

const today = new Date().toISOString().split('T')[0];

export const INITIAL_INCOME: Transaction[] = [];

export const INITIAL_EXPENSES: Transaction[] = [];

export const INITIAL_SAVINGS_GOALS: SavingsGoal[] = [];

export const INITIAL_LOANS: Loan[] = [];

export const INITIAL_SUBSCRIPTIONS: Subscription[] = [];

export const INITIAL_SCHEDULED_TRANSACTIONS: ScheduledTransaction[] = [];

export const INITIAL_INVESTMENTS: Investment[] = [];


export const CATEGORIES = {
    am: {
        income: ['ደመወዝ', 'ቢዝነስ', 'ኢንቨስትመንት', 'የብድር ክፍያ', 'የኢንቨስትመንት ትርፍ', 'ሌላ'],
        expense: ['የቤት ክፍያዎች', 'ምግብ', 'ትራንስፖርት', 'መዝናኛ', 'ግዢዎች', 'ትምህርት', 'የጤና ክፍያ', 'የብድር ክፍያ', 'ሌላ'],
        shopping: ['አዳራሽ', 'የምግብ እቃዎች', 'ኤሌክትሮኒክስ', 'የቤት እቃዎች', 'መዋጮች', 'ሌላ'],
    },
    en: {
        income: ['Salary', 'Business', 'Investment', 'Loan Repayment', 'Investment Gains', 'Other'],
        expense: ['Bills', 'Food', 'Transport', 'Entertainment', 'Shopping', 'Education', 'Health', 'Loan Payment', 'Other'],
        shopping: ['Groceries', 'Supplies', 'Electronics', 'Furniture', 'Donations', 'Other'],
    }
};

export const getIncomeCategories = (lang: Language): string[] => CATEGORIES[lang].income;
export const getExpenseCategories = (lang: Language): string[] => CATEGORIES[lang].expense;
export const getShoppingCategories = (lang: Language): string[] => CATEGORIES[lang].shopping;
export const getAllExpenseCategories = (lang: Language): string[] => [...new Set([...CATEGORIES[lang].expense, ...CATEGORIES[lang].shopping])];

export const formatCurrency = (amount: number, settings: CurrencySettings): string => {
    const { symbol, decimalPlaces, numberFormat, symbolPlacement } = settings;

    const options: Intl.NumberFormatOptions = {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
        useGrouping: true,
    };

    let formattedAmount: string;

    if (numberFormat === 'dot-comma') {
        // e.g., German locale for 1.234,56
        formattedAmount = new Intl.NumberFormat('de-DE', options).format(amount);
    } else if (numberFormat === 'space-dot') {
        // No standard locale for this, so we format and replace.
        // Format with comma separator first
        const tempAmount = new Intl.NumberFormat('en-US', options).format(amount);
        // Then replace comma with space
        formattedAmount = tempAmount.replace(/,/g, ' ');
    } else { // 'comma-dot' is the default
        // e.g., US locale for 1,234.56
        formattedAmount = new Intl.NumberFormat('en-US', options).format(amount);
    }

    if (symbolPlacement === 'before') {
        return `${symbol} ${formattedAmount}`;
    } else {
        return `${formattedAmount} ${symbol}`;
    }
};
export const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

export const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const getDeviceId = (): string => {
    let deviceId = localStorage.getItem('wallet_device_id');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('wallet_device_id', deviceId);
    }
    return deviceId;
};
