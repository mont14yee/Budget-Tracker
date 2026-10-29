import { addMoney, subtractMoney, multiplyMoney, divideMoney } from '../utils/money';
import React, { useState, useMemo } from 'react';
import { 
    Transaction, 
    ViewType, 
    FeatureType, 
    SavingsGoal, 
    ScheduledTransaction, 
    Subscription, 
    Investment, 
    Loan, 
    TransactionType, 
    UserProfile,
    Frequency
} from '../types';
import ViewContainer from '../components/ViewContainer';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { formatCurrency, parseLocalDate } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardViewProps {
    income: number;
    expenses: number;
    netAmount: number;
    allIncome: Transaction[];
    allExpenses: Transaction[];
    theme: 'light' | 'dark';
    setActiveView: (view: ViewType) => void;
    setCategoryFilter: (category: string | null) => void;
    exportToCSV: () => void;
    assets: number;
    netWorth?: number;
    liabilities: number;
    savingsGoals?: SavingsGoal[];
    scheduledTransactions?: ScheduledTransaction[];
    subscriptions?: Subscription[];
    investments?: Investment[];
    loans?: Loan[];
    userProfile?: UserProfile | null;
    onUpdateProfile?: (profile: UserProfile) => void;
    onSelectFeature?: (feature: FeatureType) => void;
    onQuickAction?: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
    // English
    'Salary': 'fa-money-bill-trend-up',
    'Business': 'fa-building-columns',
    'Investment': 'fa-chart-pie',
    'Loan Repayment': 'fa-hand-holding-dollar',
    'Investment Gains': 'fa-arrow-trend-up',
    'Bills': 'fa-file-invoice-dollar',
    'Food': 'fa-bowl-food',
    'Transport': 'fa-bus-simple',
    'Entertainment': 'fa-clapperboard',
    'Shopping': 'fa-cart-shopping',
    'Education': 'fa-book-open-reader',
    'Health': 'fa-stethoscope',
    'Loan Payment': 'fa-receipt',
    'Other': 'fa-shapes',
    // Amharic
    'ደመወዝ': 'fa-money-bill-trend-up',
    'ቢዝነስ': 'fa-building-columns',
    'ኢንቨስትመንት': 'fa-chart-pie',
    'የብድር ክፍያ': 'fa-hand-holding-dollar',
    'የኢንቨስትመንት ትርፍ': 'fa-arrow-trend-up',
    'የቤት ክፍያዎች': 'fa-file-invoice-dollar',
    'ምግብ': 'fa-bowl-food',
    'ትራንስፖርት': 'fa-bus-simple',
    'መዝናኛ': 'fa-clapperboard',
    'ግዢዎች': 'fa-cart-shopping',
    'ትምህርት': 'fa-book-open-reader',
    'የጤና ክፍያ': 'fa-stethoscope',
    'ሌላ': 'fa-shapes',
};

const getIconForCategory = (cat: string) => CATEGORY_ICONS[cat] || 'fa-tag';

// Custom Chart Tooltip for Money In & Out
const ChartTooltip: React.FC<any> = ({ active, payload, label, currencySettings }) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl text-xs space-y-2 min-w-[170px] pointer-events-none">
                <p className="font-extrabold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700/60 pb-1.5">{label}</p>
                {payload.map((entry: any) => (
                    <div key={entry.name} className="flex justify-between items-center gap-3">
                        <span className="font-medium flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                            {entry.name}:
                        </span>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                            {formatCurrency(entry.value, currencySettings)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const DashboardView: React.FC<DashboardViewProps> = ({ 
    income, 
    expenses, 
    netAmount, 
    allIncome, 
    allExpenses, 
    theme, 
    setActiveView, 
    setCategoryFilter, 
    exportToCSV, 
    assets, 
    netWorth, 
    liabilities,
    savingsGoals = [],
    scheduledTransactions = [],
    subscriptions = [],
    investments = [],
    loans = [],
    userProfile,
    onUpdateProfile,
    onSelectFeature,
    onQuickAction
}) => {
    const { t, language, currencySettings } = useLanguage();
    
    // Period filter for Main Money Card: 'thisMonth' | 'lastMonth' | 'thisYear' | 'all'
    const [periodFilter, setPeriodFilter] = useState<'thisMonth' | 'lastMonth' | 'thisYear' | 'all'>('thisMonth');
    
    // Chart timeframe: '6m' | '12m' | 'all'
    const [chartTimeframe, setChartTimeframe] = useState<'6m' | '12m' | 'all'>('6m');

    // Recent transactions filter: 'all' | 'expense' | 'income'
    const [txFilter, setTxFilter] = useState<'all' | 'expense' | 'income'>('all');

    // Spending limit modal state
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [limitInput, setLimitInput] = useState<string>(
        userProfile?.monthlySpendingLimit ? String(userProfile.monthlySpendingLimit) : ''
    );

    // Period options
    const periodOptions: Array<{ key: 'thisMonth' | 'lastMonth' | 'thisYear' | 'all'; label: string }> = [
        { key: 'thisMonth', label: t('thisMonth') },
        { key: 'lastMonth', label: t('lastMonth' as any) || 'Last Month' },
        { key: 'thisYear', label: t('thisYear') },
        { key: 'all', label: t('allTime') },
    ];

    // Current Date / Reporting Month formatted in current locale
    const currentReportingMonth = useMemo(() => {
        const now = new Date();
        return new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en-US', { 
            month: 'long', 
            year: 'numeric' 
        }).format(now);
    }, [language]);

    // Time-of-day greeting
    const greetingText = useMemo(() => {
        const hour = new Date().getHours();
        const name = userProfile?.name || '';
        let greeting = t('welcomeBack');
        if (hour < 12) greeting = t('goodMorning');
        else if (hour < 18) greeting = t('goodAfternoon');
        else greeting = t('goodEvening');
        return name ? `${greeting}, ${name}` : greeting;
    }, [userProfile?.name, t]);

    // Filtered income & expenses based on selected periodFilter
    const filteredPeriodData = useMemo(() => {
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const startOfThisYear = new Date(now.getFullYear(), 0, 1);

        const filterItems = (items: Transaction[]) => {
            if (periodFilter === 'all') return items;
            return items.filter(item => {
                const itemDate = parseLocalDate(item.date);
                if (periodFilter === 'thisMonth') return itemDate >= startOfThisMonth && itemDate <= now;
                if (periodFilter === 'lastMonth') return itemDate >= startOfLastMonth && itemDate <= endOfLastMonth;
                if (periodFilter === 'thisYear') return itemDate >= startOfThisYear && itemDate <= now;
                return true;
            });
        };

        const periodIncomeList = filterItems(allIncome);
        const periodExpenseList = filterItems(allExpenses);

        const incomeTotal = periodIncomeList.reduce((sum, item) => addMoney(sum, item.amount), 0);
        const expensesTotal = periodExpenseList.reduce((sum, item) => addMoney(sum, item.amount), 0);
        const netDifference = subtractMoney(incomeTotal, expensesTotal);

        return {
            incomeList: periodIncomeList,
            expenseList: periodExpenseList,
            incomeTotal,
            expensesTotal,
            netDifference,
        };
    }, [allIncome, allExpenses, periodFilter]);

    // Current month actual spending calculation for Spending Progress
    const currentMonthSpending = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthExpenses = allExpenses.filter(item => {
            const d = parseLocalDate(item.date);
            return d >= startOfMonth && d <= now;
        });
        return thisMonthExpenses.reduce((sum, item) => addMoney(sum, item.amount), 0);
    }, [allExpenses]);

    // Spending limit metrics
    const spendingLimit = userProfile?.monthlySpendingLimit || 0;
    const spendingProgressInfo = useMemo(() => {
        if (!spendingLimit || spendingLimit <= 0) {
            return {
                hasLimit: false,
                spent: currentMonthSpending,
                remaining: 0,
                percentage: 0,
                isApproaching: false,
                isExceeded: false,
                overAmount: 0,
            };
        }

        const percentage = Math.min(100, Math.round((currentMonthSpending / spendingLimit) * 100));
        const isExceeded = currentMonthSpending > spendingLimit;
        const isApproaching = !isExceeded && percentage >= 80;
        const remaining = isExceeded ? 0 : subtractMoney(spendingLimit, currentMonthSpending);
        const overAmount = isExceeded ? subtractMoney(currentMonthSpending, spendingLimit) : 0;

        return {
            hasLimit: true,
            spent: currentMonthSpending,
            limit: spendingLimit,
            remaining,
            percentage,
            isApproaching,
            isExceeded,
            overAmount,
        };
    }, [currentMonthSpending, spendingLimit]);

    // Monthly data for Income vs Spending Chart
    const chartMonthlyData = useMemo(() => {
        const grouped: { [key: string]: { date: Date; income: number; expenses: number } } = {};

        const registerTx = (tx: Transaction, type: 'income' | 'expenses') => {
            const date = parseLocalDate(tx.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!grouped[key]) {
                grouped[key] = {
                    date: new Date(date.getFullYear(), date.getMonth(), 1),
                    income: 0,
                    expenses: 0
                };
            }
            grouped[key][type] = addMoney(grouped[key][type], tx.amount);
        };

        allIncome.forEach(t => registerTx(t, 'income'));
        allExpenses.forEach(t => registerTx(t, 'expenses'));

        const sorted = Object.entries(grouped)
            .map(([_, val]) => val)
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        // Slice according to chartTimeframe
        let sliced = sorted;
        if (chartTimeframe === '6m') {
            sliced = sorted.slice(-6);
        } else if (chartTimeframe === '12m') {
            sliced = sorted.slice(-12);
        }

        const monthFormatter = new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en-US', { 
            month: 'short', 
            year: '2-digit' 
        });

        return sliced.map(d => ({
            month: monthFormatter.format(d.date),
            income: d.income,
            expenses: d.expenses,
            difference: subtractMoney(d.income, d.expenses),
        }));
    }, [allIncome, allExpenses, chartTimeframe, language]);

    // Combined recent transactions list
    const recentTransactionsList = useMemo(() => {
        const combined = [
            ...allIncome.map(t => ({ ...t, type: TransactionType.Income })),
            ...allExpenses.map(t => ({ ...t, type: TransactionType.Expense }))
        ];

        let filtered = combined;
        if (txFilter === 'income') {
            filtered = combined.filter(t => t.type === TransactionType.Income);
        } else if (txFilter === 'expense') {
            filtered = combined.filter(t => t.type === TransactionType.Expense);
        }

        return filtered
            .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
            .slice(0, 7);
    }, [allIncome, allExpenses, txFilter]);

    // Combined upcoming bills & subscriptions
    const upcomingPaymentsList = useMemo(() => {
        const items: Array<{
            id: string;
            name: string;
            amount: number;
            category: string;
            dueDate: string;
            kind: 'subscription' | 'scheduled';
            frequency: Frequency;
        }> = [];

        subscriptions.forEach(sub => {
            items.push({
                id: sub.id,
                name: sub.name,
                amount: sub.amount,
                category: sub.category,
                dueDate: sub.renewalDate,
                kind: 'subscription',
                frequency: sub.frequency,
            });
        });

        scheduledTransactions.forEach(sched => {
            items.push({
                id: sched.id,
                name: sched.name,
                amount: sched.amount,
                category: sched.category,
                dueDate: sched.nextDueDate,
                kind: 'scheduled',
                frequency: sched.frequency,
            });
        });

        return items
            .sort((a, b) => {
                const dateA = a.dueDate ? parseLocalDate(a.dueDate).getTime() : Infinity;
                const dateB = b.dueDate ? parseLocalDate(b.dueDate).getTime() : Infinity;
                return dateA - dateB;
            })
            .slice(0, 4);
    }, [subscriptions, scheduledTransactions]);

    // Handler to save spending limit
    const handleSaveLimit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = parseFloat(limitInput);
        if (!isNaN(parsed) && parsed >= 0) {
            if (onUpdateProfile && userProfile) {
                onUpdateProfile({
                    ...userProfile,
                    monthlySpendingLimit: parsed > 0 ? parsed : undefined,
                });
            }
        }
        setIsLimitModalOpen(false);
    };

    return (
        <ViewContainer title={t('dashboard')} icon="fas fa-wallet">
            {/* 1. WELCOME HEADER */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-gray-200/60 dark:border-gray-700/50 shadow-xs">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                            {currentReportingMonth}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Personal Budget Workspace
                        </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight mt-0.5">
                        {greetingText}
                    </h2>
                </div>

                <div className="flex items-center gap-3 self-start md:self-auto">
                    {/* Settings & Profile Access */}
                    <button
                        onClick={() => setActiveView(ViewType.Settings)}
                        className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-gray-100 hover:bg-gray-200/80 dark:bg-gray-700/60 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 cursor-pointer"
                        title={t('settings') || 'Settings & Profile'}
                        aria-label="Open settings and profile"
                    >
                        {userProfile?.avatar ? (
                            <img 
                                src={userProfile.avatar} 
                                alt={userProfile.name || 'User'} 
                                className="w-6 h-6 rounded-full object-cover border border-gray-300 dark:border-gray-600"
                            />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-[10px] font-bold">
                                <i className="fas fa-user"></i>
                            </div>
                        )}
                        <span className="hidden sm:inline">{userProfile?.name || t('profile')}</span>
                        <i className="fas fa-sliders text-[10px] text-gray-400"></i>
                    </button>

                    {/* Prominent Add Transaction Action */}
                    {onQuickAction && (
                        <button
                            onClick={onQuickAction}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:opacity-95 active:scale-95 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 cursor-pointer"
                        >
                            <i className="fas fa-plus text-[11px]"></i>
                            <span>{t('addTransaction') || 'Add Transaction'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 2. MAIN MONEY CARD */}
            <div className="mb-8 rounded-3xl bg-gradient-to-br from-gray-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl shadow-indigo-950/20 border border-indigo-900/40 relative overflow-hidden">
                {/* Subtle calm decorative backlight */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                    {/* Period Switcher & Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                                <p className="text-xs font-extrabold uppercase tracking-widest text-cyan-300">
                                    {t('moneyAvailable') || 'Money Available'}
                                </p>
                            </div>
                            <div className="flex items-baseline gap-3 mt-1.5">
                                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-white">
                                    {formatCurrency(netAmount, currencySettings)}
                                </h1>
                            </div>
                        </div>

                        {/* Period Filter Buttons */}
                        <div className="flex items-center bg-white/10 backdrop-blur-md rounded-2xl p-1 self-start sm:self-auto border border-white/10">
                            {periodOptions.map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => setPeriodFilter(opt.key)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                        periodFilter === opt.key
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-300 hover:text-white'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Breakdown for Selected Period */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
                        {/* Period Income */}
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                            <div className="flex items-center justify-between text-gray-400 text-xs font-bold mb-1">
                                <span>{t('totalIncomePeriod') || 'Total Income'}</span>
                                <i className="fas fa-arrow-down text-emerald-400"></i>
                            </div>
                            <p className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
                                +{formatCurrency(filteredPeriodData.incomeTotal, currencySettings)}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                                {filteredPeriodData.incomeList.length} {filteredPeriodData.incomeList.length === 1 ? 'entry' : 'entries'} in period
                            </p>
                        </div>

                        {/* Period Spending */}
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                            <div className="flex items-center justify-between text-gray-400 text-xs font-bold mb-1">
                                <span>{t('totalSpendingPeriod') || 'Total Spending'}</span>
                                <i className="fas fa-arrow-up text-rose-400"></i>
                            </div>
                            <p className="text-xl sm:text-2xl font-mono font-black text-rose-400">
                                -{formatCurrency(filteredPeriodData.expensesTotal, currencySettings)}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                                {filteredPeriodData.expenseList.length} {filteredPeriodData.expenseList.length === 1 ? 'entry' : 'entries'} in period
                            </p>
                        </div>

                        {/* Period Difference */}
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                            <div className="flex items-center justify-between text-gray-400 text-xs font-bold mb-1">
                                <span>{t('differencePeriod') || 'Net Difference'}</span>
                                <i className="fas fa-balance-scale text-cyan-400"></i>
                            </div>
                            <p className={`text-xl sm:text-2xl font-mono font-black ${
                                filteredPeriodData.netDifference >= 0 ? 'text-cyan-400' : 'text-rose-400'
                            }`}>
                                {filteredPeriodData.netDifference >= 0 ? '+' : ''}
                                {formatCurrency(filteredPeriodData.netDifference, currencySettings)}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                                Income minus spending
                            </p>
                        </div>
                    </div>

                    {/* Explicit Balance Definition Notice */}
                    <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-2.5 text-xs text-gray-400">
                        <i className="fas fa-info-circle text-cyan-400 flex-shrink-0"></i>
                        <p className="text-[11px] leading-relaxed">
                            {t('balanceFormulaNotice') || 'Calculated as: All recorded income minus all recorded expenses. Not a synchronized bank account balance.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* DESKTOP BALANCED TWO-COLUMN WORKSPACE (7–8 Cols Left / 4–5 Cols Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
                
                {/* PRIMARY WORKSPACE (Left Side: 7–8 Cols on Desktop) */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-8">
                    
                    {/* 3. SPENDING PROGRESS */}
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 rounded-3xl border border-gray-200/60 dark:border-gray-700/50 shadow-xs">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm">
                                    <i className="fas fa-gauge-high"></i>
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                                        {t('spendingProgress') || 'Monthly Spending Progress'}
                                    </h3>
                                    <p className="text-[11px] text-gray-400">
                                        {currentReportingMonth}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setLimitInput(userProfile?.monthlySpendingLimit ? String(userProfile.monthlySpendingLimit) : '');
                                    setIsLimitModalOpen(true);
                                }}
                                className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                            >
                                <i className="fas fa-pen text-[10px]"></i>
                                <span>{spendingProgressInfo.hasLimit ? (t('editLimit') || 'Edit Limit') : (t('setSpendingLimit') || 'Set Limit')}</span>
                            </button>
                        </div>

                        {spendingProgressInfo.hasLimit ? (
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                                    <div>
                                        <span className="text-2xl font-black font-mono text-gray-900 dark:text-white">
                                            {formatCurrency(spendingProgressInfo.spent, currencySettings)}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                            {t('spentThisMonth') || 'spent this month'}
                                        </span>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <span className={`text-xs font-bold font-mono ${
                                            spendingProgressInfo.isExceeded 
                                                ? 'text-rose-600 dark:text-rose-400' 
                                                : 'text-gray-600 dark:text-gray-300'
                                        }`}>
                                            {spendingProgressInfo.isExceeded 
                                                ? `${t('overLimit') || 'Over limit by'} ${formatCurrency(spendingProgressInfo.overAmount, currencySettings)}`
                                                : `${formatCurrency(spendingProgressInfo.remaining, currencySettings)} ${t('remainingLimit') || 'remaining'}`
                                            }
                                        </span>
                                        <p className="text-[10px] text-gray-400">
                                            of {formatCurrency(spendingProgressInfo.limit!, currencySettings)} monthly limit
                                        </p>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-700/60 overflow-hidden p-0.5">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            spendingProgressInfo.isExceeded 
                                                ? 'bg-rose-500' 
                                                : spendingProgressInfo.isApproaching
                                                    ? 'bg-amber-500'
                                                    : 'bg-gradient-to-r from-teal-500 to-cyan-500'
                                        }`}
                                        style={{ width: `${Math.min(100, spendingProgressInfo.percentage)}%` }}
                                    />
                                </div>

                                {/* Status callout banner */}
                                {spendingProgressInfo.isExceeded ? (
                                    <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                                        <i className="fas fa-triangle-exclamation text-rose-500 flex-shrink-0"></i>
                                        <span>
                                            {(t('limitExceededWarning') || 'Alert: You have exceeded your monthly spending limit by {0}.').replace('{0}', formatCurrency(spendingProgressInfo.overAmount, currencySettings))}
                                        </span>
                                    </div>
                                ) : spendingProgressInfo.isApproaching ? (
                                    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300">
                                        <i className="fas fa-circle-exclamation text-amber-500 flex-shrink-0"></i>
                                        <span>
                                            {(t('limitApproachingWarning') || 'Warning: You have used {0}% of your monthly spending limit.').replace('{0}', String(spendingProgressInfo.percentage))}
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-gray-400">
                                        On track. You have consumed {spendingProgressInfo.percentage}% of your monthly spending budget.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="p-5 rounded-2xl bg-gray-50/70 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                        {t('noLimitConfigured') || 'No monthly spending limit configured'}
                                    </h4>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-md leading-relaxed">
                                        {t('noLimitConfiguredHelp') || 'Set a monthly spending limit to monitor your cash burn rate and avoid overspending.'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setLimitInput('');
                                        setIsLimitModalOpen(true);
                                    }}
                                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer flex-shrink-0"
                                >
                                    <i className="fas fa-bullseye text-[10px] mr-1.5"></i>
                                    {t('setSpendingLimit') || 'Set Monthly Limit'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 4. MONEY IN AND OUT (Readable Comparison Chart) */}
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-gray-200/60 dark:border-gray-700/50 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-700/50 gap-3">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <i className="fas fa-chart-column text-teal-500"></i>
                                    {t('moneyInOutChart') || 'Money In vs Money Out'}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {t('moneyInOutChartSubtitle') || 'Compare monthly earnings against spending over time'}
                                </p>
                            </div>

                            {/* Chart Timeframe Controls */}
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900/60 p-1 rounded-xl self-start sm:self-auto">
                                <button
                                    onClick={() => setChartTimeframe('6m')}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                        chartTimeframe === '6m'
                                            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    {t('last6Months') || 'Last 6 Months'}
                                </button>
                                <button
                                    onClick={() => setChartTimeframe('12m')}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                        chartTimeframe === '12m'
                                            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    {t('last12Months') || '12 Months'}
                                </button>
                                <button
                                    onClick={() => setChartTimeframe('all')}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                        chartTimeframe === 'all'
                                            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    {t('allMonths') || 'All'}
                                </button>
                            </div>
                        </div>

                        {chartMonthlyData.length > 0 ? (
                            <div className="w-full h-72 sm:h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartMonthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#f1f5f9'} />
                                        <XAxis 
                                            dataKey="month" 
                                            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#64748b', fontSize: 11 }} 
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis 
                                            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#64748b', fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(val) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(val)}
                                        />
                                        <Tooltip content={<ChartTooltip currencySettings={currencySettings} />} cursor={{ fill: 'rgba(128, 128, 128, 0.06)' }} />
                                        <Legend 
                                            wrapperStyle={{ paddingTop: '14px', fontSize: '12px' }} 
                                            iconType="circle"
                                        />
                                        <Bar 
                                            name={t('income')} 
                                            dataKey="income" 
                                            fill="#10b981" 
                                            radius={[6, 6, 0, 0]} 
                                            maxBarSize={36}
                                        />
                                        <Bar 
                                            name={t('expenses')} 
                                            dataKey="expenses" 
                                            fill="#f43f5e" 
                                            radius={[6, 6, 0, 0]} 
                                            maxBarSize={36}
                                        />
                                        <Line 
                                            name={t('differencePeriod') || 'Net Difference'} 
                                            type="monotone" 
                                            dataKey="difference" 
                                            stroke="#0ea5e9" 
                                            strokeWidth={2.5} 
                                            dot={{ r: 3, fill: '#0ea5e9' }} 
                                            activeDot={{ r: 6 }} 
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-2.5 text-gray-400">
                                    <i className="fas fa-chart-line text-lg"></i>
                                </div>
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                    {t('noDataForPeriod') || 'No monthly flow data available'}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1">
                                    Log transactions to visualize your income and spending flow.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 5. RECENT TRANSACTIONS */}
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-gray-200/60 dark:border-gray-700/50 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/50 gap-3">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <i className="fas fa-receipt text-cyan-500"></i>
                                    {t('recentTransactions' as any) || 'Recent Transactions'}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {t('recentTransactionsSubtitle') || 'Latest income and expense records'}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Filter: All / Spending / Income */}
                                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900/60 p-1 rounded-xl">
                                    <button
                                        onClick={() => setTxFilter('all')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                            txFilter === 'all'
                                                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        {t('filterAll') || 'All'}
                                    </button>
                                    <button
                                        onClick={() => setTxFilter('expense')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                            txFilter === 'expense'
                                                ? 'bg-white dark:bg-gray-800 text-rose-600 dark:text-rose-400 shadow-xs'
                                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        {t('filterSpending') || 'Spending'}
                                    </button>
                                    <button
                                        onClick={() => setTxFilter('income')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                            txFilter === 'income'
                                                ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        {t('filterIncome') || 'Income'}
                                    </button>
                                </div>

                                {/* See All Button */}
                                <button
                                    onClick={() => setActiveView(ViewType.Expenses)}
                                    className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 ml-2 cursor-pointer"
                                >
                                    <span>{t('seeAll') || 'See all'}</span>
                                    <i className="fas fa-chevron-right text-[9px]"></i>
                                </button>
                            </div>
                        </div>

                        {recentTransactionsList.length > 0 ? (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                {recentTransactionsList.map((tx) => {
                                    const isIncome = tx.type === TransactionType.Income;
                                    return (
                                        <div key={tx.id} className="py-3.5 flex items-center justify-between group hover:bg-gray-50/60 dark:hover:bg-gray-700/20 px-2 rounded-2xl transition-colors">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm flex-shrink-0 ${
                                                    isIncome
                                                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                                        : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                                                }`}>
                                                    <i className={`fas ${getIconForCategory(tx.category)}`}></i>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                        {tx.name}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                                                        <span className="font-medium text-gray-600 dark:text-gray-300">{tx.category}</span>
                                                        <span aria-hidden="true">·</span>
                                                        <span>{tx.date}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right flex-shrink-0 pl-3">
                                                <span className={`text-sm font-mono font-bold ${
                                                    isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                                }`}>
                                                    {isIncome ? '+' : '-'}{formatCurrency(tx.amount, currencySettings)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-8 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-2 text-gray-400">
                                    <i className="fas fa-receipt text-base"></i>
                                </div>
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                    {t('noTransactionsFound' as any) || 'No transactions found'}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5 mb-3">
                                    Start recording your daily income and spending to see activity here.
                                </p>
                                {onQuickAction && (
                                    <button
                                        onClick={onQuickAction}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold shadow-xs hover:bg-cyan-500 cursor-pointer"
                                    >
                                        <i className="fas fa-plus text-[10px]"></i>
                                        <span>{t('addTransaction') || 'Add Transaction'}</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* SECONDARY WORKSPACE (Right Side: 4–5 Cols on Desktop) */}
                <div className="lg:col-span-5 xl:col-span-4 space-y-6">

                    {/* 6. SAVINGS PROGRESS */}
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 rounded-3xl border border-gray-200/60 dark:border-gray-700/50 shadow-xs">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/50">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                                <i className="fas fa-piggy-bank text-emerald-500"></i>
                                {t('savings') || 'Savings Goals'}
                            </h4>
                            {onSelectFeature && (
                                <button
                                    onClick={() => onSelectFeature(FeatureType.Savings)}
                                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <span>Goals</span>
                                    <i className="fas fa-chevron-right text-[9px]"></i>
                                </button>
                            )}
                        </div>

                        {savingsGoals.length > 0 ? (
                            <div className="space-y-4">
                                {savingsGoals.slice(0, 3).map((goal) => {
                                    const currentSaved = goal.startingBalance;
                                    const progress = goal.targetAmount > 0 
                                        ? Math.min(100, Math.round((currentSaved / goal.targetAmount) * 100)) 
                                        : 0;
                                    const leftToSave = Math.max(0, subtractMoney(goal.targetAmount, currentSaved));

                                    return (
                                        <div key={goal.id} className="p-3.5 rounded-2xl bg-gray-50/70 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800 space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-gray-900 dark:text-white truncate max-w-[160px]">{goal.name}</span>
                                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{progress}%</span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700/70 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" 
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>

                                            <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                                                <span>{t('saved') || 'Saved'}: <strong className="text-gray-800 dark:text-gray-200">{formatCurrency(currentSaved, currencySettings)}</strong></span>
                                                <span>{t('leftToSave') || 'Left'}: <strong className="text-gray-800 dark:text-gray-200">{formatCurrency(leftToSave, currencySettings)}</strong></span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-6 text-center">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mx-auto mb-2 text-emerald-500">
                                    <i className="fas fa-piggy-bank text-sm"></i>
                                </div>
                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{t('noSavingsGoals')}</p>
                                {onSelectFeature && (
                                    <button
                                        onClick={() => onSelectFeature(FeatureType.Savings)}
                                        className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                    >
                                        <i className="fas fa-plus text-[9px]"></i>
                                        <span>{t('newSavingsGoal')}</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 7. UPCOMING PAYMENTS */}
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 rounded-3xl border border-gray-200/60 dark:border-gray-700/50 shadow-xs">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/50">
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                                    <i className="fas fa-calendar-check text-orange-500"></i>
                                    {t('upcomingPayments') || 'Upcoming Payments'}
                                </h4>
                                <p className="text-[10px] text-gray-400">
                                    {t('upcomingPaymentsSubtitle') || 'Next scheduled bills & subscriptions'}
                                </p>
                            </div>
                            {onSelectFeature && (
                                <button
                                    onClick={() => onSelectFeature(FeatureType.BillsAndPayments)}
                                    className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <span>All</span>
                                    <i className="fas fa-chevron-right text-[9px]"></i>
                                </button>
                            )}
                        </div>

                        {upcomingPaymentsList.length > 0 ? (
                            <div className="space-y-2.5">
                                {upcomingPaymentsList.map((item) => (
                                    <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/70 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                    {item.name}
                                                </p>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                                    item.kind === 'subscription'
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                                                        : 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400'
                                                }`}>
                                                    {item.kind === 'subscription' ? 'Sub' : 'Bill'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                {t('nextDue') || 'Due'}: {item.dueDate}
                                            </p>
                                        </div>
                                        <span className="font-mono text-xs font-bold text-rose-500 dark:text-rose-400 flex-shrink-0 pl-2">
                                            -{formatCurrency(item.amount, currencySettings)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-6 text-center">
                                <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center mx-auto mb-2 text-orange-500">
                                    <i className="fas fa-calendar-check text-sm"></i>
                                </div>
                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                    {t('noUpcomingPayments') || 'No upcoming payments'}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                    {t('noUpcomingPaymentsHelp') || 'Active subscriptions and scheduled bills appear here.'}
                                </p>
                            </div>
                        )}

                        {onSelectFeature && (
                            <button
                                onClick={() => onSelectFeature(FeatureType.BillsAndPayments)}
                                className="w-full mt-3 py-2 text-center text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline block cursor-pointer"
                            >
                                {t('viewAllBills') || 'View all bills & regular payments'} →
                            </button>
                        )}
                    </div>

                    {/* OPTIONAL INVESTMENT SUMMARY (if holdings exist) */}
                    {investments.length > 0 && (
                        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 rounded-3xl border border-gray-200/60 dark:border-gray-700/50 shadow-xs">
                            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100 dark:border-gray-700/50">
                                <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                                    <i className="fas fa-chart-line text-blue-500"></i>
                                    {t('investments') || 'Investments'}
                                </h4>
                                <button
                                    onClick={() => setActiveView(ViewType.Investments)}
                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <span>Portfolio</span>
                                    <i className="fas fa-chevron-right text-[9px]"></i>
                                </button>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Portfolio Value</p>
                                <p className="text-2xl font-black font-mono text-gray-900 dark:text-white mt-0.5">
                                    {formatCurrency(
                                        investments.reduce((sum, inv) => addMoney(sum, multiplyMoney(inv.quantity, inv.currentPrice)), 0),
                                        currencySettings
                                    )}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1">
                                    {investments.length} active {investments.length === 1 ? 'asset' : 'assets'} tracked
                                </p>
                            </div>
                        </div>
                    )}

                    {/* QUICK EXPORT CARD */}
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-5 rounded-3xl border border-gray-200/60 dark:border-gray-700/50 shadow-xs">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-xs">
                                    {t('exportCSV') || 'Export Data'}
                                </h4>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                    Download CSV ledger for records
                                </p>
                            </div>
                            <button
                                onClick={exportToCSV}
                                className="px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            >
                                <i className="fas fa-download text-[10px] text-cyan-400"></i>
                                <span>CSV</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL: SET SPENDING LIMIT */}
            {isLimitModalOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsLimitModalOpen(false);
                    }}
                >
                    <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                            <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
                                <i className="fas fa-bullseye text-cyan-500"></i>
                                {t('setLimitModalTitle') || 'Monthly Spending Limit'}
                            </h3>
                            <button
                                onClick={() => setIsLimitModalOpen(false)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <i className="fas fa-times text-xs"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSaveLimit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                    {t('monthlyLimit') || 'Monthly Limit Amount'} ({currencySettings.symbol})
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={limitInput}
                                    onChange={(e) => setLimitInput(e.target.value)}
                                    placeholder={t('spendingLimitPlaceholder') || 'e.g. 2000'}
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                                    autoFocus
                                />
                                <p className="text-[10px] text-gray-400 mt-1">
                                    Set to 0 or leave empty to disable limits.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsLimitModalOpen(false)}
                                    className="w-1/2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-95 text-xs font-bold text-white shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer"
                                >
                                    {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </ViewContainer>
    );
};

export default DashboardView;
