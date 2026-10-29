import React, { useState, useMemo } from 'react';
import { formatCurrency, parseLocalDate, formatLocalDate } from '../constants';
import { AllTransaction, TransactionType, UserProfile, SavingsGoal } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie, Legend } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { addMoney, subtractMoney, multiplyMoney } from '../utils/money';
import { buildSafeCsv, downloadCsvFile } from '../utils/csvSecurity';

interface ReportsViewProps {
    userProfile: UserProfile | null;
    allTransactions: AllTransaction[];
    savingsGoals?: SavingsGoal[];
    incomeCategories: string[];
    expenseCategories: string[];
    shoppingCategories: string[];
}

const COLORS = ['#0ea5e9', '#6366f1', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#f43f5e', '#14b8a6'];

export const ReportsView: React.FC<ReportsViewProps> = ({
    userProfile,
    allTransactions,
    savingsGoals = [],
    incomeCategories,
    expenseCategories,
}) => {
    const { t, currencySettings } = useLanguage();

    // Default to current month
    const now = new Date();
    const firstDayCurrentMonth = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const lastDayCurrentMonth = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    const [preset, setPreset] = useState<'thisMonth' | 'lastMonth' | 'thisYear' | 'allTime' | 'custom'>('thisMonth');
    const [startDate, setStartDate] = useState(firstDayCurrentMonth);
    const [endDate, setEndDate] = useState(lastDayCurrentMonth);
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    // Preset range handler
    const handlePresetChange = (selected: 'thisMonth' | 'lastMonth' | 'thisYear' | 'allTime' | 'custom') => {
        setPreset(selected);
        const d = new Date();
        if (selected === 'thisMonth') {
            setStartDate(formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1)));
            setEndDate(formatLocalDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)));
        } else if (selected === 'lastMonth') {
            setStartDate(formatLocalDate(new Date(d.getFullYear(), d.getMonth() - 1, 1)));
            setEndDate(formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 0)));
        } else if (selected === 'thisYear') {
            setStartDate(formatLocalDate(new Date(d.getFullYear(), 0, 1)));
            setEndDate(formatLocalDate(new Date(d.getFullYear(), 11, 31)));
        } else if (selected === 'allTime') {
            setStartDate('2000-01-01');
            setEndDate('2099-12-31');
        }
    };

    // Filter transactions by selected date range
    const filteredTransactions = useMemo(() => {
        return allTransactions.filter(tx => {
            const txDate = tx.date;
            return txDate >= startDate && txDate <= endDate;
        });
    }, [allTransactions, startDate, endDate]);

    // Breakdown for selected period
    const periodSummary = useMemo(() => {
        let totalIncome = 0;
        let totalOutgoings = 0;
        let incomeCount = 0;
        let expenseCount = 0;

        filteredTransactions.forEach(tx => {
            if (tx.type === TransactionType.Income) {
                totalIncome = addMoney(totalIncome, tx.amount);
                incomeCount++;
            } else {
                totalOutgoings = addMoney(totalOutgoings, tx.amount);
                expenseCount++;
            }
        });

        const netBalance = subtractMoney(totalIncome, totalOutgoings);
        const avgIncome = incomeCount > 0 ? totalIncome / incomeCount : 0;
        const avgExpense = expenseCount > 0 ? totalOutgoings / expenseCount : 0;

        return {
            totalIncome,
            totalOutgoings,
            netBalance,
            incomeCount,
            expenseCount,
            avgIncome,
            avgExpense,
            transactionCount: filteredTransactions.length,
        };
    }, [filteredTransactions]);

    // Question 3: Which categories cost the most?
    const topCategories = useMemo(() => {
        const categoryMap: Record<string, number> = {};
        filteredTransactions.forEach(tx => {
            if (tx.type !== TransactionType.Income) {
                categoryMap[tx.category] = addMoney(categoryMap[tx.category] || 0, tx.amount);
            }
        });

        const sorted = Object.entries(categoryMap)
            .map(([name, amount]) => ({
                name,
                amount,
                percentage: periodSummary.totalOutgoings > 0 ? (amount / periodSummary.totalOutgoings) * 100 : 0,
            }))
            .sort((a, b) => b.amount - a.amount);

        return sorted;
    }, [filteredTransactions, periodSummary.totalOutgoings]);

    // Question 4: How does this month compare with the previous month?
    const monthOverMonth = useMemo(() => {
        const currYear = now.getFullYear();
        const currMonth = now.getMonth();
        const prevMonthDate = new Date(currYear, currMonth - 1, 1);
        const prevYear = prevMonthDate.getFullYear();
        const prevMonth = prevMonthDate.getMonth();

        const currMonthKey = `${currYear}-${String(currMonth + 1).padStart(2, '0')}`;
        const prevMonthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;

        let currIncome = 0;
        let currExpenses = 0;
        let prevIncome = 0;
        let prevExpenses = 0;

        allTransactions.forEach(tx => {
            if (tx.date.startsWith(currMonthKey)) {
                if (tx.type === TransactionType.Income) currIncome = addMoney(currIncome, tx.amount);
                else currExpenses = addMoney(currExpenses, tx.amount);
            } else if (tx.date.startsWith(prevMonthKey)) {
                if (tx.type === TransactionType.Income) prevIncome = addMoney(prevIncome, tx.amount);
                else prevExpenses = addMoney(prevExpenses, tx.amount);
            }
        });

        const expenseDiff = subtractMoney(currExpenses, prevExpenses);
        const expenseDiffPct = prevExpenses > 0 ? (expenseDiff / prevExpenses) * 100 : 0;

        const incomeDiff = subtractMoney(currIncome, prevIncome);
        const incomeDiffPct = prevIncome > 0 ? (incomeDiff / prevIncome) * 100 : 0;

        return {
            currIncome,
            currExpenses,
            prevIncome,
            prevExpenses,
            expenseDiff,
            expenseDiffPct,
            incomeDiff,
            incomeDiffPct,
        };
    }, [allTransactions]);

    // Question 5: Am I staying within my spending limit?
    const spendingLimitAnalysis = useMemo(() => {
        const limit = userProfile?.monthlySpendingLimit;
        const currentMonthSpending = monthOverMonth.currExpenses;

        if (!limit || limit <= 0) {
            return {
                configured: false,
                limit: 0,
                spent: currentMonthSpending,
                remaining: 0,
                pctUsed: 0,
                status: 'no_limit' as const,
            };
        }

        const remaining = subtractMoney(limit, currentMonthSpending);
        const pctUsed = Math.min(200, (currentMonthSpending / limit) * 100);
        let status: 'safe' | 'approaching' | 'exceeded' = 'safe';

        if (currentMonthSpending > limit) {
            status = 'exceeded';
        } else if (pctUsed >= 80) {
            status = 'approaching';
        }

        return {
            configured: true,
            limit,
            spent: currentMonthSpending,
            remaining,
            pctUsed,
            status,
        };
    }, [userProfile?.monthlySpendingLimit, monthOverMonth.currExpenses]);

    // Question 6: How are my savings goals progressing?
    const savingsProgressSummary = useMemo(() => {
        let totalTarget = 0;
        let totalSaved = 0;

        const goalDetails = savingsGoals.map(goal => {
            const extraTotal = (goal.extraContributions || []).reduce((sum, c) => addMoney(sum, c.amount), 0);
            const saved = addMoney(goal.startingBalance, extraTotal);
            const remaining = Math.max(0, subtractMoney(goal.targetAmount, saved));
            const progress = goal.targetAmount > 0 ? Math.min(100, (saved / goal.targetAmount) * 100) : 0;

            totalTarget = addMoney(totalTarget, goal.targetAmount);
            totalSaved = addMoney(totalSaved, saved);

            return {
                id: goal.id,
                name: goal.name,
                targetAmount: goal.targetAmount,
                saved,
                remaining,
                progress,
                deadline: goal.deadline,
            };
        });

        const totalRemaining = Math.max(0, subtractMoney(totalTarget, totalSaved));
        const overallProgress = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

        return {
            hasGoals: savingsGoals.length > 0,
            goalCount: savingsGoals.length,
            totalTarget,
            totalSaved,
            totalRemaining,
            overallProgress,
            goalDetails,
        };
    }, [savingsGoals]);

    // Detailed table data with optional category drill-down
    const displayedTransactions = useMemo(() => {
        if (!categoryFilter) return filteredTransactions;
        return filteredTransactions.filter(t => t.category === categoryFilter);
    }, [filteredTransactions, categoryFilter]);

    // CSV Export
    const handleExportCsv = () => {
        const headers = ['Date', 'Type', 'Name', 'Category', 'Amount', 'Notes'];
        const rows = filteredTransactions.map(tx => [
            tx.date,
            tx.type,
            tx.name,
            tx.category,
            tx.amount,
            tx.notes || '',
        ]);

        const csvString = buildSafeCsv(headers, rows);
        downloadCsvFile(`wallet-report-${startDate}-to-${endDate}.csv`, csvString);
    };

    // Chart data for financial summary bar chart
    const summaryBarData = [
        { name: 'Income', value: periodSummary.totalIncome, fill: '#10b981' },
        { name: 'Spending', value: periodSummary.totalOutgoings, fill: '#f43f5e' },
        { name: 'Net', value: periodSummary.netBalance, fill: periodSummary.netBalance >= 0 ? '#0ea5e9' : '#f59e0b' },
    ];

    return (
        <div className="space-y-8 animate-fadeIn pb-12">
            {/* Header & Date Range Filter Toolbar */}
            <div className="p-6 sm:p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-gray-700/50 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-gray-100 dark:border-gray-700/60">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center text-lg">
                                <i className="fas fa-file-invoice-dollar"></i>
                            </div>
                            Financial Reports & Insights
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Understand where money came from, where it went, and how you are progressing.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            className="h-10 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <i className="fas fa-download text-xs text-teal-500"></i>
                            <span>Export CSV</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="h-10 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <i className="fas fa-print text-xs text-cyan-500"></i>
                            <span>Print</span>
                        </button>
                    </div>
                </div>

                {/* Preset Date Range Buttons & Inputs */}
                <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-900/60 rounded-xl overflow-x-auto">
                        <button
                            onClick={() => handlePresetChange('thisMonth')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                preset === 'thisMonth'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            This Month
                        </button>
                        <button
                            onClick={() => handlePresetChange('lastMonth')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                preset === 'lastMonth'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            Last Month
                        </button>
                        <button
                            onClick={() => handlePresetChange('thisYear')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                preset === 'thisYear'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            This Year
                        </button>
                        <button
                            onClick={() => handlePresetChange('allTime')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                preset === 'allTime'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            All Time
                        </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>Range:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setPreset('custom');
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                        <span>to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setPreset('custom');
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                    </div>
                </div>
            </div>

            {/* ANSWERS TO THE 6 KEY FINANCIAL QUESTIONS */}
            <div>
                <div className="flex items-center gap-2 mb-4 px-1">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        Direct Answers to Key Questions
                    </h3>
                    <div className="h-px bg-gray-200 dark:bg-gray-800 flex-1 ml-2"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* 1. How much money came in? */}
                    <div className="p-6 rounded-3xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    1. Money In
                                </span>
                                <i className="fas fa-arrow-down text-emerald-500 text-xs"></i>
                            </div>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white mt-1">
                                How much money came in?
                            </h4>
                            <p className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 my-2">
                                +{formatCurrency(periodSummary.totalIncome, currencySettings)}
                            </p>
                        </div>
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                            <span>{periodSummary.incomeCount} incoming payment{periodSummary.incomeCount === 1 ? '' : 's'} recorded</span>
                            {periodSummary.incomeCount > 0 && (
                                <p className="mt-0.5 text-[11px] text-gray-400">
                                    Avg: {formatCurrency(periodSummary.avgIncome, currencySettings)} per entry
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 2. How much did I spend? */}
                    <div className="p-6 rounded-3xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                                    2. Spending Out
                                </span>
                                <i className="fas fa-arrow-up text-rose-500 text-xs"></i>
                            </div>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white mt-1">
                                How much did I spend?
                            </h4>
                            <p className="text-3xl font-black font-mono text-rose-600 dark:text-rose-400 my-2">
                                -{formatCurrency(periodSummary.totalOutgoings, currencySettings)}
                            </p>
                        </div>
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                            <span className={`font-semibold ${periodSummary.netBalance >= 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-rose-500'}`}>
                                Net difference: {periodSummary.netBalance >= 0 ? '+' : ''}{formatCurrency(periodSummary.netBalance, currencySettings)}
                            </span>
                            <p className="mt-0.5 text-[11px] text-gray-400">
                                {periodSummary.expenseCount} spending transaction{periodSummary.expenseCount === 1 ? '' : 's'}
                            </p>
                        </div>
                    </div>

                    {/* 3. Which categories cost the most? */}
                    <div className="p-6 rounded-3xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                    3. Cost Breakdown
                                </span>
                                <i className="fas fa-tags text-indigo-500 text-xs"></i>
                            </div>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white mt-1">
                                Which categories cost the most?
                            </h4>
                            {topCategories.length > 0 ? (
                                <ul className="space-y-1.5 my-2">
                                    {topCategories.slice(0, 3).map((cat, idx) => (
                                        <li key={cat.name} className="flex justify-between items-center text-xs">
                                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                                {idx + 1}. {cat.name}
                                            </span>
                                            <span className="font-mono font-bold text-gray-700 dark:text-gray-300 ml-2">
                                                {formatCurrency(cat.amount, currencySettings)} <span className="text-gray-400 text-[10px]">({cat.percentage.toFixed(0)}%)</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-gray-400 my-4 italic">No spending in this period.</p>
                            )}
                        </div>
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50 text-[11px] text-gray-400">
                            {topCategories.length} total categories used
                        </div>
                    </div>

                    {/* 4. How does this month compare with previous month? */}
                    <div className="p-6 rounded-3xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                                    4. Month vs Month
                                </span>
                                <i className="fas fa-chart-line text-cyan-500 text-xs"></i>
                            </div>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white mt-1">
                                How does this month compare with last?
                            </h4>
                            <div className="my-2 space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Spending:</span>
                                    <span className={`font-mono font-bold ${monthOverMonth.expenseDiff <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                        {monthOverMonth.expenseDiff <= 0 ? 'Down ' : 'Up '}
                                        {Math.abs(monthOverMonth.expenseDiffPct).toFixed(1)}% ({formatCurrency(Math.abs(monthOverMonth.expenseDiff), currencySettings)})
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Income:</span>
                                    <span className={`font-mono font-bold ${monthOverMonth.incomeDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                                        {monthOverMonth.incomeDiff >= 0 ? '+' : ''}{formatCurrency(monthOverMonth.incomeDiff, currencySettings)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50 text-[11px] text-gray-400">
                            Last month spending: {formatCurrency(monthOverMonth.prevExpenses, currencySettings)}
                        </div>
                    </div>

                    {/* 5. Am I staying within my spending limit? */}
                    <div className="p-6 rounded-3xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                    5. Spending Limit
                                </span>
                                <i className="fas fa-shield-alt text-purple-500 text-xs"></i>
                            </div>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white mt-1">
                                Am I staying within my spending limit?
                            </h4>
                            {spendingLimitAnalysis.configured ? (
                                <div className="my-2">
                                    <div className="flex justify-between items-baseline text-xs mb-1">
                                        <span className={`font-bold ${
                                            spendingLimitAnalysis.status === 'exceeded'
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : spendingLimitAnalysis.status === 'approaching'
                                                    ? 'text-amber-600 dark:text-amber-400'
                                                    : 'text-emerald-600 dark:text-emerald-400'
                                        }`}>
                                            {spendingLimitAnalysis.status === 'exceeded' 
                                                ? 'Limit Exceeded' 
                                                : spendingLimitAnalysis.status === 'approaching' 
                                                    ? 'Approaching Limit' 
                                                    : 'On Track'}
                                        </span>
                                        <span className="font-mono font-bold">{spendingLimitAnalysis.pctUsed.toFixed(0)}% used</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div
                                            className={`h-2 rounded-full ${
                                                spendingLimitAnalysis.status === 'exceeded'
                                                    ? 'bg-rose-500'
                                                    : spendingLimitAnalysis.status === 'approaching'
                                                        ? 'bg-amber-500'
                                                        : 'bg-emerald-500'
                                            }`}
                                            style={{ width: `${Math.min(100, spendingLimitAnalysis.pctUsed)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-mono">
                                        {spendingLimitAnalysis.remaining >= 0
                                            ? `${formatCurrency(spendingLimitAnalysis.remaining, currencySettings)} remaining`
                                            : `${formatCurrency(Math.abs(spendingLimitAnalysis.remaining), currencySettings)} over budget`}
                                    </p>
                                </div>
                            ) : (
                                <div className="my-3 p-2.5 bg-gray-100 dark:bg-gray-900/60 rounded-xl text-xs text-gray-500 dark:text-gray-400">
                                    No spending limit configured. Set a monthly limit in Settings to monitor spending boundaries.
                                </div>
                            )}
                        </div>
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50 text-[11px] text-gray-400">
                            {spendingLimitAnalysis.configured ? `Target cap: ${formatCurrency(spendingLimitAnalysis.limit, currencySettings)}` : 'Limit inactive'}
                        </div>
                    </div>

                    {/* 6. How are my savings goals progressing? */}
                    <div className="p-6 rounded-3xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    6. Savings Goals
                                </span>
                                <i className="fas fa-piggy-bank text-emerald-500 text-xs"></i>
                            </div>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white mt-1">
                                How are savings goals progressing?
                            </h4>
                            {savingsProgressSummary.hasGoals ? (
                                <div className="my-2">
                                    <div className="flex justify-between items-baseline text-xs mb-1">
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(savingsProgressSummary.totalSaved, currencySettings)} saved
                                        </span>
                                        <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                                            {savingsProgressSummary.overallProgress.toFixed(0)}% of target
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-2 rounded-full"
                                            style={{ width: `${savingsProgressSummary.overallProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-mono">
                                        {formatCurrency(savingsProgressSummary.totalRemaining, currencySettings)} left across {savingsProgressSummary.goalCount} goal{savingsProgressSummary.goalCount === 1 ? '' : 's'}
                                    </p>
                                </div>
                            ) : (
                                <div className="my-3 p-2.5 bg-gray-100 dark:bg-gray-900/60 rounded-xl text-xs text-gray-500 dark:text-gray-400">
                                    No savings goals created yet. Set up targets in the Savings workspace.
                                </div>
                            )}
                        </div>
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50 text-[11px] text-gray-400">
                            Total targets: {formatCurrency(savingsProgressSummary.totalTarget, currencySettings)}
                        </div>
                    </div>
                </div>
            </div>

            {/* VISUAL CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Period Net Flow Bar Chart */}
                <div className="lg:col-span-3 p-6 sm:p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-gray-700/50 shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">
                        Period Financial Inflow vs Outflow
                    </h3>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            <BarChart data={summaryBarData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'} />
                                <XAxis dataKey="name" tick={{ fill: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280' }} fontSize={12} />
                                <YAxis tick={{ fill: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280' }} fontSize={12} />
                                <Tooltip formatter={(value: any) => formatCurrency(Number(value), currencySettings)} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                    {summaryBarData.map((entry, index) => (
                                        <Cell key={`bar-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Spending by Category Pie Chart */}
                <div className="lg:col-span-2 p-6 sm:p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-gray-700/50 shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                        Spending by Category
                    </h3>
                    {topCategories.length > 0 ? (
                        <div style={{ width: '100%', height: 280 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={topCategories}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={75}
                                        paddingAngle={3}
                                        dataKey="amount"
                                        nameKey="name"
                                        onClick={(entry: any) => {
                                            if (entry && entry.name) {
                                                setCategoryFilter(categoryFilter === entry.name ? null : entry.name);
                                            }
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {topCategories.map((entry, index) => (
                                            <Cell
                                                key={`pie-${index}`}
                                                fill={COLORS[index % COLORS.length]}
                                                opacity={!categoryFilter || categoryFilter === entry.name ? 1 : 0.3}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: any) => formatCurrency(Number(value), currencySettings)} />
                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-xs text-gray-400 italic">
                            No spending recorded in this period.
                        </div>
                    )}
                </div>
            </div>

            {/* TRANSACTIONS DRILL-DOWN TABLE */}
            <div className="p-6 sm:p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-gray-700/50 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <div>
                        <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                            Transaction Records in Period ({displayedTransactions.length})
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {startDate} to {endDate}
                            {categoryFilter && <span className="ml-2 font-bold text-cyan-600 dark:text-cyan-400">· Filtered by: {categoryFilter}</span>}
                        </p>
                    </div>

                    {categoryFilter && (
                        <button
                            onClick={() => setCategoryFilter(null)}
                            className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                        >
                            <i className="fas fa-times text-[10px] mr-1"></i> Clear Category Filter
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700/60">
                    <table className="w-full text-xs text-left text-gray-600 dark:text-gray-300">
                        <thead className="text-[11px] uppercase bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-3 font-bold">Date</th>
                                <th className="px-4 py-3 font-bold">Type</th>
                                <th className="px-4 py-3 font-bold">Description</th>
                                <th className="px-4 py-3 font-bold">Category</th>
                                <th className="px-4 py-3 font-bold text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {displayedTransactions.length > 0 ? (
                                displayedTransactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap font-mono">{tx.date}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                tx.type === TransactionType.Income
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                            }`}>
                                                {tx.type === TransactionType.Income ? 'Income' : 'Spending'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{tx.name}</td>
                                        <td className="px-4 py-3">{tx.category}</td>
                                        <td className={`px-4 py-3 font-mono font-bold text-right ${
                                            tx.type === TransactionType.Income ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                        }`}>
                                            {tx.type === TransactionType.Income ? '+' : '-'}{formatCurrency(tx.amount, currencySettings)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-gray-400 italic">
                                        No transaction records found for this period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;