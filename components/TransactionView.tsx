import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import ViewContainer from './ViewContainer';
import { formatCurrency, parseLocalDate, formatLocalDate } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import MonthlyFlowChart from './charts/MonthlyFlowChart';
import { getActiveSessionToken } from '../services/localAuthService';
import ConfirmModal from './ConfirmModal';
import EmptyState from './EmptyState';
import { addMoney, subtractMoney } from '../utils/money';
import { buildSafeCsv, downloadCsvFile } from '../utils/csvSecurity';

export interface TransactionViewProps {
    title: string;
    icon: string;
    items: Transaction[];
    allItems: Transaction[];
    total: number;
    onAddItem: (item: Omit<Transaction, 'id'>) => Promise<void> | void;
    onDeleteItem: (id: string) => Promise<void> | void;
    onUpdateItem?: (item: Transaction, originalType?: TransactionType) => Promise<void> | void;
    categories: string[];
    expenseCategories?: string[];
    incomeCategories?: string[];
    allIncome?: Transaction[];
    allExpenses?: Transaction[];
    defaultTransactionType?: 'income' | 'expense' | 'all';
    onAddTransaction?: (type: TransactionType, item: Omit<Transaction, 'id'>) => Promise<void> | void;
    onUpdateTransaction?: (type: TransactionType, item: Transaction, originalType?: TransactionType) => Promise<void> | void;
    onDeleteTransaction?: (type: TransactionType, id: string) => Promise<void> | void;
    itemIcon: string;
    itemColor: string;
    formTitle: string;
    nameLabel: string;
    namePlaceholder: string;
    totalLabel: string;
    amountColor: string;
    categoryFilter: string | null;
    onClearFilter: () => void;
    onAddCategory?: (category: string) => void;
    theme: 'light' | 'dark';
    chartTitle: string;
    chartDataKey: string;
    chartColor: string;
    pageBg?: string;
    textColor?: string;
    borderColor?: string;
    summaryBgColor?: string;
}

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
type DateRangeOption = 'all' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

interface TransactionItemRecord extends Transaction {
    transactionType: TransactionType;
}

interface TransactionFormProps {
    categories: string[];
    expenseCategories?: string[];
    incomeCategories?: string[];
    initialData?: Transaction | null;
    initialType?: TransactionType;
    onSave: (item: Omit<Transaction, 'id'> & { id?: string }, type: TransactionType) => Promise<void> | void;
    onCancel: () => void;
    onAddCategory?: (category: string) => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({
    categories,
    expenseCategories,
    incomeCategories,
    initialData,
    initialType = TransactionType.Expense,
    onSave,
    onCancel,
    onAddCategory,
}) => {
    const { t, currencySettings } = useLanguage();
    const [txType, setTxType] = useState<TransactionType>(initialType);
    const [name, setName] = useState(initialData?.name || '');
    const [amount, setAmount] = useState(initialData?.amount ? String(initialData.amount) : '');
    const [date, setDate] = useState(initialData?.date || formatLocalDate(new Date()));
    const [category, setCategory] = useState(initialData?.category || '');
    const [notes, setNotes] = useState(initialData?.notes || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isCategorizing, setIsCategorizing] = useState(false);
    const [categorizationHint, setCategorizationHint] = useState<string | null>(null);

    // Active category list based on chosen transaction type
    const activeCategories = useMemo(() => {
        if (txType === TransactionType.Income && incomeCategories && incomeCategories.length > 0) {
            return incomeCategories;
        }
        if (txType === TransactionType.Expense && expenseCategories && expenseCategories.length > 0) {
            return expenseCategories;
        }
        return categories;
    }, [txType, incomeCategories, expenseCategories, categories]);

    // Popular category shortcuts (first 5 categories)
    const quickShortcuts = useMemo(() => {
        const otherNames = ['Other', 'ሌላ'];
        return activeCategories.filter(c => !otherNames.includes(c)).slice(0, 5);
    }, [activeCategories]);

    // Keep category valid when switching types if not yet set
    React.useEffect(() => {
        if (!category && activeCategories.length > 0) {
            setCategory(activeCategories[0]);
        }
    }, [activeCategories, category]);

    const handleAiCategorize = async () => {
        if (!name.trim() || isCategorizing) return;
        setIsCategorizing(true);
        setCategorizationHint(null);
        try {
            const token = getActiveSessionToken();
            if (!token) return;

            const res = await fetch('/api/categorize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    transactionName: name.trim(),
                    availableCategories: activeCategories,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.category) {
                    setCategory(data.category);
                    if (data.explanation) {
                        setCategorizationHint(data.explanation);
                    }
                }
            }
        } catch {
            // Fail gracefully
        } finally {
            setIsCategorizing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        const cleanName = name.trim();
        const numAmount = parseFloat(amount);

        if (!cleanName) {
            setValidationError(t('whatWasItFor') || 'Please enter what this transaction was for.');
            return;
        }

        if (isNaN(numAmount) || numAmount <= 0) {
            setValidationError((t as any)('invalidAmount') || 'Amount must be a valid number greater than zero.');
            return;
        }

        if (!date || isNaN(new Date(date).getTime())) {
            setValidationError((t as any)('invalidDate') || 'Please select a valid date.');
            return;
        }

        const cleanCategory = category.trim() || (activeCategories[0] || 'General');

        if (onAddCategory && !activeCategories.find(c => c.toLowerCase() === cleanCategory.toLowerCase())) {
            onAddCategory(cleanCategory);
        }

        setIsSubmitting(true);
        try {
            await onSave(
                {
                    id: initialData?.id,
                    name: cleanName,
                    amount: numAmount,
                    date,
                    category: cleanCategory,
                    notes: notes.trim() || undefined,
                },
                txType
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const isEditMode = !!initialData?.id;

    return (
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-5 overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${txType === TransactionType.Income ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600' : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600'}`}>
                        <i className={`fas ${txType === TransactionType.Income ? 'fa-arrow-down' : 'fa-arrow-up'} text-sm`}></i>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            {isEditMode ? (t('editTransaction') || 'Edit Transaction') : (t('addTransaction') || 'Add Transaction')}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isEditMode ? 'Update transaction details' : 'Fast and easy recording for your budget'}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onCancel}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <i className="fas fa-times text-xs"></i>
                </button>
            </div>

            {/* Transaction Type Segmented Toggle */}
            <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('transactionType') || 'Transaction Type'}
                </label>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 dark:bg-gray-800/80 rounded-2xl">
                    <button
                        type="button"
                        onClick={() => setTxType(TransactionType.Expense)}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                            txType === TransactionType.Expense
                                ? 'bg-rose-500 text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <i className="fas fa-arrow-trend-down"></i>
                        {t('expenseType') || 'Expense (Money Out)'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setTxType(TransactionType.Income)}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                            txType === TransactionType.Income
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <i className="fas fa-arrow-trend-up"></i>
                        {t('incomeType') || 'Income (Money In)'}
                    </button>
                </div>
            </div>

            {validationError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <i className="fas fa-exclamation-circle flex-shrink-0"></i>
                    <span>{validationError}</span>
                </div>
            )}

            {/* Core Fields */}
            <div className="space-y-4">
                {/* Amount (Required) */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                        {t('amount')} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 dark:text-gray-500">
                            {currencySettings.symbol}
                        </span>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(e) => {
                                setAmount(e.target.value);
                                if (validationError) setValidationError(null);
                            }}
                            placeholder="0.00"
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base font-mono font-bold focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all placeholder:text-gray-300"
                            required
                            autoFocus={!isEditMode}
                        />
                    </div>
                </div>

                {/* What was it for? (Description - Required) */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                        {t('whatWasItFor') || 'What was it for?'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            if (validationError) setValidationError(null);
                        }}
                        placeholder={t('descriptionPlaceholder') || 'e.g., Grocery shopping, Client payment'}
                        className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                        required
                    />
                </div>

                {/* Category & Date Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Category (Required) */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                {t('category')} <span className="text-red-500">*</span>
                            </label>
                            {name.trim() && (
                                <button
                                    type="button"
                                    onClick={handleAiCategorize}
                                    disabled={isCategorizing}
                                    className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors disabled:opacity-50"
                                >
                                    <i className={`fas ${isCategorizing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                                    {isCategorizing ? 'Suggesting...' : 'AI Suggest'}
                                </button>
                            )}
                        </div>
                        <input
                            list="transaction-category-options"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                            placeholder={t('categoryPlaceholder') || 'Select or type a category'}
                            required
                        />
                        <datalist id="transaction-category-options">
                            {activeCategories.map((cat) => (
                                <option key={cat} value={cat} />
                            ))}
                        </datalist>
                        {categorizationHint && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                                <i className="fas fa-check-circle text-[10px]"></i>
                                {categorizationHint}
                            </p>
                        )}
                    </div>

                    {/* Date (Required) */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                            {t('date')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                            required
                        />
                    </div>
                </div>

                {/* Quick Category Shortcuts */}
                {quickShortcuts.length > 0 && (
                    <div>
                        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1.5 block">
                            {t('popularShortcuts') || 'Quick Shortcuts'}:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {quickShortcuts.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategory(cat)}
                                    className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                                        category.toLowerCase() === cat.toLowerCase()
                                            ? 'bg-cyan-500 text-white font-bold shadow-xs'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Optional Notes */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                        {t('optionalNotes') || 'Notes (Optional)'}
                    </label>
                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('notesPlaceholder') || 'Additional context or memo...'}
                        className="w-full px-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 cursor-pointer"
                >
                    {t('cancel')}
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-h-[44px] px-6 py-2.5 rounded-2xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                    {isSubmitting ? (
                        <>
                            <i className="fas fa-circle-notch fa-spin text-xs"></i>
                            {t('saving') || 'Saving...'}
                        </>
                    ) : (
                        <>
                            <i className={`fas ${isEditMode ? 'fa-check' : 'fa-plus'} text-xs`}></i>
                            {isEditMode ? (t('save') || 'Save Changes') : (t('addTransaction') || 'Add Transaction')}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export const TransactionView: React.FC<TransactionViewProps> = (props) => {
    const {
        title,
        icon,
        items,
        allItems,
        total,
        onAddItem,
        onDeleteItem,
        onUpdateItem,
        categories,
        expenseCategories = [],
        incomeCategories = [],
        allIncome,
        allExpenses,
        defaultTransactionType = 'all',
        onAddTransaction,
        onUpdateTransaction,
        onDeleteTransaction,
        itemIcon,
        itemColor,
        formTitle,
        nameLabel,
        namePlaceholder,
        totalLabel,
        amountColor,
        categoryFilter,
        onClearFilter,
        onAddCategory,
        theme,
        chartTitle,
        chartDataKey,
        chartColor,
        pageBg,
        textColor,
        borderColor,
    } = props;

    const { t, currencySettings, language } = useLanguage();

    // Unified Data Collections
    const incomeList = useMemo(() => allIncome || (chartDataKey === 'income' ? allItems : []), [allIncome, chartDataKey, allItems]);
    const expensesList = useMemo(() => allExpenses || (chartDataKey === 'expense' ? allItems : items), [allExpenses, chartDataKey, allItems, items]);

    // Active View / Type Filter ('all' | 'expense' | 'income')
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'expense' | 'income'>(defaultTransactionType);

    // Form Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<{ item: Transaction; type: TransactionType } | null>(null);

    // Delete Confirmation State
    const [pendingDelete, setPendingDelete] = useState<{ id: string; type: TransactionType; name: string } | null>(null);

    // Ledger Filters & Sorting State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>(categoryFilter || 'ALL');
    const [selectedDateRange, setSelectedDateRange] = useState<DateRangeOption>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('date-desc');
    const [isChartVisible, setIsChartVisible] = useState(false);

    // Sync external category filter if passed
    React.useEffect(() => {
        if (categoryFilter) {
            setSelectedCategory(categoryFilter);
        }
    }, [categoryFilter]);

    // Consolidate all records with explicit type
    const consolidatedRecords: TransactionItemRecord[] = useMemo(() => {
        const records: TransactionItemRecord[] = [];
        incomeList.forEach((tx) => {
            records.push({ ...tx, transactionType: TransactionType.Income });
        });
        expensesList.forEach((tx) => {
            records.push({ ...tx, transactionType: TransactionType.Expense });
        });
        return records;
    }, [incomeList, expensesList]);

    // Combined unique category list (including historical ones found in transactions)
    const allUniqueCategories = useMemo(() => {
        const set = new Set<string>();
        categories.forEach((c) => set.add(c));
        expenseCategories.forEach((c) => set.add(c));
        incomeCategories.forEach((c) => set.add(c));
        consolidatedRecords.forEach((r) => {
            if (r.category) set.add(r.category);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [categories, expenseCategories, incomeCategories, consolidatedRecords]);

    // Filter by type, category, date, and search
    const filteredRecords = useMemo(() => {
        return consolidatedRecords.filter((record) => {
            // 1. Type Filter
            if (selectedTypeFilter === 'income' && record.transactionType !== TransactionType.Income) return false;
            if (selectedTypeFilter === 'expense' && record.transactionType !== TransactionType.Expense) return false;

            // 2. Category Filter
            if (selectedCategory !== 'ALL' && record.category.toLowerCase() !== selectedCategory.toLowerCase()) {
                return false;
            }

            // 3. Date Range Filter
            if (selectedDateRange !== 'all') {
                const txDate = parseLocalDate(record.date);
                const now = new Date();
                const curYear = now.getFullYear();
                const curMonth = now.getMonth();

                if (selectedDateRange === 'thisMonth') {
                    if (txDate.getFullYear() !== curYear || txDate.getMonth() !== curMonth) return false;
                } else if (selectedDateRange === 'lastMonth') {
                    const lastMonthDate = new Date(curYear, curMonth - 1, 1);
                    if (
                        txDate.getFullYear() !== lastMonthDate.getFullYear() ||
                        txDate.getMonth() !== lastMonthDate.getMonth()
                    ) {
                        return false;
                    }
                } else if (selectedDateRange === 'thisYear') {
                    if (txDate.getFullYear() !== curYear) return false;
                } else if (selectedDateRange === 'custom') {
                    if (customStartDate && txDate < parseLocalDate(customStartDate)) return false;
                    if (customEndDate && txDate > parseLocalDate(customEndDate)) return false;
                }
            }

            // 4. Search Filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = record.name.toLowerCase().includes(q);
                const matchCategory = record.category.toLowerCase().includes(q);
                const matchNotes = record.notes ? record.notes.toLowerCase().includes(q) : false;
                const matchAmount = record.amount.toString().includes(q);
                const matchDate = record.date.includes(q);
                if (!matchName && !matchCategory && !matchNotes && !matchAmount && !matchDate) {
                    return false;
                }
            }

            return true;
        });
    }, [consolidatedRecords, selectedTypeFilter, selectedCategory, selectedDateRange, customStartDate, customEndDate, searchQuery]);

    // Sort records
    const sortedRecords = useMemo(() => {
        return [...filteredRecords].sort((a, b) => {
            if (sortBy === 'date-desc') {
                return parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime();
            }
            if (sortBy === 'date-asc') {
                return parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
            }
            if (sortBy === 'amount-desc') {
                return b.amount - a.amount;
            }
            if (sortBy === 'amount-asc') {
                return a.amount - b.amount;
            }
            return 0;
        });
    }, [filteredRecords, sortBy]);

    // Financial Summaries for the currently active filter set (using Decimal-safe money formulas)
    const summaryCalculations = useMemo(() => {
        const incomeTotal = filteredRecords
            .filter((r) => r.transactionType === TransactionType.Income)
            .reduce((sum, r) => addMoney(sum, r.amount), 0);

        const spendingTotal = filteredRecords
            .filter((r) => r.transactionType === TransactionType.Expense)
            .reduce((sum, r) => addMoney(sum, r.amount), 0);

        const netDifference = subtractMoney(incomeTotal, spendingTotal);

        return {
            incomeTotal,
            spendingTotal,
            netDifference,
        };
    }, [filteredRecords]);

    // Monthly data for visual flow chart
    const monthlyData = useMemo(() => {
        const grouped: { [key: string]: { income: number; expense: number } } = {};

        consolidatedRecords.forEach((item) => {
            const date = parseLocalDate(item.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!grouped[monthKey]) {
                grouped[monthKey] = { income: 0, expense: 0 };
            }
            if (item.transactionType === TransactionType.Income) {
                grouped[monthKey].income = addMoney(grouped[monthKey].income, item.amount);
            } else {
                grouped[monthKey].expense = addMoney(grouped[monthKey].expense, item.amount);
            }
        });

        const monthFormatter = new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en-US', {
            month: 'short',
            year: '2-digit',
        });

        return Object.entries(grouped)
            .map(([monthKey, vals]) => {
                const [year, month] = monthKey.split('-').map(Number);
                const date = new Date(year, month - 1, 1);
                return {
                    date,
                    month: monthFormatter.format(date),
                    monthKey,
                    income: vals.income,
                    expense: vals.expense,
                    [chartDataKey]: chartDataKey === 'income' ? vals.income : vals.expense,
                };
            })
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [consolidatedRecords, chartDataKey, language]);

    // Check if any filter is active
    const isAnyFilterActive = useMemo(() => {
        return (
            selectedCategory !== 'ALL' ||
            selectedDateRange !== 'all' ||
            searchQuery.trim().length > 0 ||
            selectedTypeFilter !== defaultTransactionType
        );
    }, [selectedCategory, selectedDateRange, searchQuery, selectedTypeFilter, defaultTransactionType]);

    const handleClearAllFilters = () => {
        setSelectedCategory('ALL');
        setSelectedDateRange('all');
        setCustomStartDate('');
        setCustomEndDate('');
        setSearchQuery('');
        setSelectedTypeFilter(defaultTransactionType);
        onClearFilter();
    };

    // Save handler (covers create and update seamlessly)
    const handleSaveTransaction = async (
        item: Omit<Transaction, 'id'> & { id?: string },
        type: TransactionType
    ) => {
        if (item.id) {
            // Edit mode
            const fullItem: Transaction = {
                id: item.id,
                name: item.name,
                amount: item.amount,
                date: item.date,
                category: item.category,
                notes: item.notes,
            };
            const originalType = editingItem?.type || type;

            if (onUpdateTransaction) {
                await onUpdateTransaction(type, fullItem, originalType);
            } else if (onUpdateItem) {
                await onUpdateItem(fullItem, originalType);
            } else {
                // Fallback: delete and re-add
                await onDeleteItem(item.id);
                await onAddItem(item);
            }
        } else {
            // Create mode
            if (onAddTransaction) {
                await onAddTransaction(type, item);
            } else {
                await onAddItem(item);
            }
        }

        setIsFormOpen(false);
        setEditingItem(null);
    };

    // Export current filtered ledger to CSV
    const handleExportLedgerCSV = () => {
        const filename = `wallet_ledger_${new Date().toISOString().split('T')[0]}.csv`;
        const headers = [
            t('filterByType') || 'Type',
            t('date'),
            t('whatWasItFor') || 'Description',
            t('category'),
            `${t('amount')} (${currencySettings.symbol})`,
            t('optionalNotes') || 'Notes',
        ];

        const rows = sortedRecords.map((r) => [
            r.transactionType === TransactionType.Income ? (t('income') || 'Income') : (t('expense') || 'Expense'),
            r.date,
            r.name,
            r.category,
            Number(r.amount).toFixed(currencySettings.decimalPlaces ?? 2),
            r.notes || '',
        ]);

        const csvString = buildSafeCsv(headers, rows);
        downloadCsvFile(csvString, filename);
    };

    return (
        <ViewContainer
            title={title}
            icon={icon}
            bgColor={pageBg}
            textColor={textColor}
            borderColor={borderColor}
        >
            <div className="space-y-6">
                {/* Top Action & Overview Header */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-white/60 dark:border-gray-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                {totalLabel}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300">
                                {sortedRecords.length} {sortedRecords.length === 1 ? 'record' : 'records'}
                            </span>
                        </div>
                        <div className={`text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 font-mono ${amountColor}`}>
                            {formatCurrency(total, currencySettings)}
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Monthly Flow Chart Toggle */}
                        <button
                            type="button"
                            onClick={() => setIsChartVisible(!isChartVisible)}
                            className="px-3.5 py-2 rounded-2xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <i className="fas fa-chart-line text-cyan-500 text-xs"></i>
                            <span>{isChartVisible ? 'Hide Chart' : 'Monthly Flow'}</span>
                        </button>

                        {/* Export Filtered CSV */}
                        <button
                            type="button"
                            onClick={handleExportLedgerCSV}
                            className="px-3.5 py-2 rounded-2xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="Export filtered transactions to CSV"
                        >
                            <i className="fas fa-file-csv text-emerald-500 text-xs"></i>
                            <span>Export CSV</span>
                        </button>

                        {/* Add Transaction Button */}
                        <button
                            type="button"
                            onClick={() => {
                                setEditingItem(null);
                                setIsFormOpen(true);
                            }}
                            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <i className="fas fa-plus text-xs"></i>
                            <span>{t('addTransaction') || 'Add Transaction'}</span>
                        </button>
                    </div>
                </div>

                {/* Collapsible Monthly Flow Chart */}
                {isChartVisible && (
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 rounded-3xl border border-white/60 dark:border-gray-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] animate-fadeIn">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                    <i className="fas fa-chart-column text-cyan-500"></i>
                                    {chartTitle}
                                </h3>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Historical monthly progression
                                </p>
                            </div>
                        </div>
                        <MonthlyFlowChart
                            theme={theme}
                            data={monthlyData}
                            dataKey={chartDataKey}
                            color={chartColor}
                        />
                    </div>
                )}

                {/* Filter and Control Bar */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-5 rounded-3xl border border-white/60 dark:border-gray-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] space-y-4">
                    {/* Top Row: Search and Type Pills */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        {/* Instant Search Bar */}
                        <div className="relative flex-1">
                            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('searchTransactionsPlaceholder') || 'Filter by description, note, category...'}
                                className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>

                        {/* Type Segment Filter (All / Spending / Income) */}
                        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-900/60 rounded-2xl border border-gray-200/60 dark:border-gray-700/60">
                            <button
                                type="button"
                                onClick={() => setSelectedTypeFilter('all')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedTypeFilter === 'all'
                                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {t('filterAll') || 'All'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTypeFilter('expense')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedTypeFilter === 'expense'
                                        ? 'bg-rose-500 text-white shadow-xs'
                                        : 'text-gray-500 hover:text-rose-500'
                                }`}
                            >
                                {t('filterSpending') || 'Spending'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTypeFilter('income')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedTypeFilter === 'income'
                                        ? 'bg-emerald-500 text-white shadow-xs'
                                        : 'text-gray-500 hover:text-emerald-500'
                                }`}
                            >
                                {t('filterIncome') || 'Income'}
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Category, Date Range, Sort Dropdowns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                        {/* Category Filter */}
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-1">
                                {t('filterByCategory') || 'Filter by Category'}
                            </label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                            >
                                <option value="ALL">{t('allCategories') || 'All Categories'}</option>
                                {allUniqueCategories.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date Range Filter */}
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-1">
                                {t('filterByDateRange') || 'Date Range'}
                            </label>
                            <select
                                value={selectedDateRange}
                                onChange={(e) => setSelectedDateRange(e.target.value as DateRangeOption)}
                                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                            >
                                <option value="all">{t('allDates') || 'All Time'}</option>
                                <option value="thisMonth">{t('thisMonth') || 'This Month'}</option>
                                <option value="lastMonth">{t('lastMonth') || 'Last Month'}</option>
                                <option value="thisYear">{t('thisYear') || 'This Year'}</option>
                                <option value="custom">{t('customRange') || 'Custom Range'}</option>
                            </select>
                        </div>

                        {/* Sort Dropdown */}
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-1">
                                {t('sortBy') || 'Sort by'}
                            </label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                            >
                                <option value="date-desc">{t('newestFirst') || 'Date (Newest)'}</option>
                                <option value="date-asc">{t('oldestFirst') || 'Date (Oldest)'}</option>
                                <option value="amount-desc">{t('highestAmount') || 'Amount (Highest)'}</option>
                                <option value="amount-asc">{t('lowestAmount') || 'Amount (Lowest)'}</option>
                            </select>
                        </div>

                        {/* Clear Filters Button */}
                        <div className="flex items-end">
                            {isAnyFilterActive ? (
                                <button
                                    type="button"
                                    onClick={handleClearAllFilters}
                                    className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-bold border border-amber-200 dark:border-amber-800/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <i className="fas fa-filter-circle-xmark text-xs"></i>
                                    {t('clearAllFilters') || 'Clear Filters'}
                                </button>
                            ) : (
                                <div className="text-[11px] text-gray-400 dark:text-gray-500 py-2 w-full text-right sm:text-left">
                                    {t('showingFilteredCount', String(sortedRecords.length), String(consolidatedRecords.length)) ||
                                        `Showing ${sortedRecords.length} records`}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Custom Date Pickers (if custom date range selected) */}
                    {selectedDateRange === 'custom' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 bg-gray-50/50 dark:bg-gray-900/30 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                    {t('startDate') || 'Start Date'}
                                </label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                    {t('endDate') || 'End Date'}
                                </label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Period Net Flow Summary Card (When filters are active or in All view) */}
                {(selectedTypeFilter === 'all' || isAnyFilterActive) && sortedRecords.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-3xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/50">
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {t('periodIncomeTotal') || 'Filtered Income'}
                            </div>
                            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                                +{formatCurrency(summaryCalculations.incomeTotal, currencySettings)}
                            </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {t('periodSpendingTotal') || 'Filtered Spending'}
                            </div>
                            <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                                -{formatCurrency(summaryCalculations.spendingTotal, currencySettings)}
                            </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {t('periodNetSummary') || 'Period Net Flow'}
                            </div>
                            <div className={`text-lg font-bold font-mono mt-0.5 ${summaryCalculations.netDifference >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {summaryCalculations.netDifference >= 0 ? '+' : ''}{formatCurrency(summaryCalculations.netDifference, currencySettings)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Transaction Ledger Table / Cards */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-gray-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden">
                    {/* Empty State */}
                    {sortedRecords.length === 0 ? (
                        <div className="p-8">
                            <EmptyState
                                icon={isAnyFilterActive ? 'fas fa-filter' : 'fas fa-wallet'}
                                title={
                                    isAnyFilterActive
                                        ? t('noTransactionsMatchFilter') || 'No transactions match your filters'
                                        : t('noTransactionsFound') || 'No transactions recorded yet'
                                }
                                description={
                                    isAnyFilterActive
                                        ? 'Try adjusting your search query, type filter, or date range.'
                                        : 'Add your first transaction to start monitoring cash flow and budgets.'
                                }
                                actionLabel={
                                    isAnyFilterActive
                                        ? t('clearAllFilters') || 'Clear Filters'
                                        : t('addTransaction') || 'Add Transaction'
                                }
                                onAction={
                                    isAnyFilterActive
                                        ? handleClearAllFilters
                                        : () => {
                                              setEditingItem(null);
                                              setIsFormOpen(true);
                                          }
                                }
                            />
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View (>= md) */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700/50 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-800/30">
                                            <th className="py-3.5 px-6">{t('date')}</th>
                                            <th className="py-3.5 px-6">{t('whatWasItFor') || 'Description'}</th>
                                            <th className="py-3.5 px-6">{t('category')}</th>
                                            <th className="py-3.5 px-6">{t('filterByType') || 'Type'}</th>
                                            <th className="py-3.5 px-6 text-right">{t('amount')}</th>
                                            <th className="py-3.5 px-6 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                                        {sortedRecords.map((item) => {
                                            const isIncome = item.transactionType === TransactionType.Income;
                                            const isHistorical = !categories.includes(item.category) &&
                                                !expenseCategories.includes(item.category) &&
                                                !incomeCategories.includes(item.category);

                                            return (
                                                <tr
                                                    key={`${item.transactionType}-${item.id}`}
                                                    className="hover:bg-gray-50/70 dark:hover:bg-gray-750/40 transition-colors group"
                                                >
                                                    {/* Date */}
                                                    <td className="py-4 px-6 text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
                                                        {item.date}
                                                    </td>

                                                    {/* Description & Notes */}
                                                    <td className="py-4 px-6 min-w-[200px]">
                                                        <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                                            <span>{item.name}</span>
                                                        </div>
                                                        {item.notes && (
                                                            <div className="text-[11px] text-gray-400 dark:text-gray-500 italic mt-0.5 line-clamp-1">
                                                                <i className="fas fa-note-sticky text-[10px] mr-1 opacity-70"></i>
                                                                {item.notes}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Category with historical tag fallback */}
                                                    <td className="py-4 px-6 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300">
                                                            <i className={`fas ${isIncome ? 'fa-wallet' : 'fa-tag'} text-[10px] opacity-60`}></i>
                                                            {item.category}
                                                            {isHistorical && (
                                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                                                                    {t('historicalCategory') || 'Historical'}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </td>

                                                    {/* Type */}
                                                    <td className="py-4 px-6 whitespace-nowrap">
                                                        <span
                                                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                                isIncome
                                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                                                                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40'
                                                            }`}
                                                        >
                                                            <i className={`fas ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'} text-[9px]`}></i>
                                                            {isIncome ? (t('income') || 'Income') : (t('expense') || 'Expense')}
                                                        </span>
                                                    </td>

                                                    {/* Amount */}
                                                    <td className="py-4 px-6 text-right whitespace-nowrap">
                                                        <div
                                                            className={`font-mono font-bold text-sm lg:text-base ${
                                                                isIncome
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : 'text-rose-600 dark:text-rose-400'
                                                            }`}
                                                        >
                                                            {isIncome ? '+' : '-'}{formatCurrency(item.amount, currencySettings)}
                                                        </div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="py-4 px-6 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingItem({
                                                                        item,
                                                                        type: item.transactionType,
                                                                    });
                                                                    setIsFormOpen(true);
                                                                }}
                                                                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors cursor-pointer"
                                                                aria-label={`Edit ${item.name}`}
                                                                title="Edit"
                                                            >
                                                                <i className="fas fa-pen text-xs"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setPendingDelete({
                                                                        id: item.id,
                                                                        type: item.transactionType,
                                                                        name: item.name,
                                                                    })
                                                                }
                                                                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                                                                aria-label={`Delete ${item.name}`}
                                                                title="Delete"
                                                            >
                                                                <i className="fas fa-trash-alt text-xs"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile List View (< md) */}
                            <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-800/60 p-2">
                                {sortedRecords.map((item) => {
                                    const isIncome = item.transactionType === TransactionType.Income;
                                    const isHistorical = !categories.includes(item.category) &&
                                        !expenseCategories.includes(item.category) &&
                                        !incomeCategories.includes(item.category);

                                    return (
                                        <div
                                            key={`${item.transactionType}-${item.id}`}
                                            className="p-3.5 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 rounded-2xl transition-colors space-y-2.5"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                {/* Left Icon and Details */}
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    <div
                                                        className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                            isIncome
                                                                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600'
                                                                : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600'
                                                        }`}
                                                    >
                                                        <i className={`fas ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs`}></i>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                                            {item.name}
                                                        </h4>
                                                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                {item.category}
                                                            </span>
                                                            {isHistorical && (
                                                                <span className="text-[9px] px-1 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                                                                    Historical
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-gray-400">• {item.date}</span>
                                                        </div>
                                                        {item.notes && (
                                                            <p className="text-[11px] text-gray-400 dark:text-gray-500 italic mt-1 line-clamp-1">
                                                                {item.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right Amount */}
                                                <div className="text-right flex-shrink-0">
                                                    <div
                                                        className={`font-mono font-bold text-sm ${
                                                            isIncome
                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                : 'text-rose-600 dark:text-rose-400'
                                                        }`}
                                                    >
                                                        {isIncome ? '+' : '-'}{formatCurrency(item.amount, currencySettings)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mobile Actions Bar with min 44px hit targets */}
                                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100/60 dark:border-gray-800/40">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingItem({
                                                            item,
                                                            type: item.transactionType,
                                                        });
                                                        setIsFormOpen(true);
                                                    }}
                                                    className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl bg-gray-100/80 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-1.5 active:bg-gray-200"
                                                >
                                                    <i className="fas fa-pen text-[10px]"></i>
                                                    <span>{t('edit') || 'Edit'}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setPendingDelete({
                                                            id: item.id,
                                                            type: item.transactionType,
                                                            name: item.name,
                                                        })
                                                    }
                                                    className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-xs font-semibold text-red-600 dark:text-red-400 flex items-center justify-center gap-1.5 active:bg-red-100"
                                                >
                                                    <i className="fas fa-trash-alt text-[10px]"></i>
                                                    <span>{t('delete') || 'Delete'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Reusable Transaction Form Modal (Create & Edit) */}
            {isFormOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-fadeIn"
                    onClick={() => {
                        setIsFormOpen(false);
                        setEditingItem(null);
                    }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200/80 dark:border-gray-700 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden transform transition-all"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <TransactionForm
                            categories={categories}
                            expenseCategories={expenseCategories}
                            incomeCategories={incomeCategories}
                            initialData={editingItem?.item || null}
                            initialType={editingItem?.type || (selectedTypeFilter === 'income' ? TransactionType.Income : TransactionType.Expense)}
                            onSave={handleSaveTransaction}
                            onCancel={() => {
                                setIsFormOpen(false);
                                setEditingItem(null);
                            }}
                            onAddCategory={onAddCategory}
                        />
                    </div>
                </div>
            )}

            {/* Accessible Confirmation Modal for Delete */}
            <ConfirmModal
                isOpen={!!pendingDelete}
                title={t('confirmDeleteTransactionTitle') || 'Delete Transaction'}
                message={
                    t('confirmDeleteTransactionMsg') ||
                    `Are you sure you want to delete "${pendingDelete?.name}"? This action cannot be undone.`
                }
                confirmLabel={t('delete') || 'Delete'}
                cancelLabel={t('cancel') || 'Cancel'}
                variant="danger"
                onConfirm={async () => {
                    if (pendingDelete) {
                        if (onDeleteTransaction) {
                            await onDeleteTransaction(pendingDelete.type, pendingDelete.id);
                        } else {
                            await onDeleteItem(pendingDelete.id);
                        }
                        setPendingDelete(null);
                    }
                }}
                onCancel={() => setPendingDelete(null)}
            />
        </ViewContainer>
    );
};

export default TransactionView;
