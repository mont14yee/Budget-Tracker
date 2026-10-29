import React, { useState, useMemo } from 'react';
import { 
    Subscription, 
    ScheduledTransaction, 
    SubscriptionType, 
    SubscriptionHealth, 
    Frequency, 
    TransactionType, 
    Transaction,
    AllTransaction 
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { formatCurrency, parseLocalDate, formatLocalDate } from '../constants';
import ViewContainer from '../components/ViewContainer';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import BloomingFlowerChart from '../components/charts/BloomingFlowerChart';
import { addMoney, subtractMoney, multiplyMoney } from '../utils/money';

interface BillsAndPaymentsViewProps {
    subscriptions: Subscription[];
    scheduled: ScheduledTransaction[];
    allTransactions?: AllTransaction[];
    addSubscription: (sub: Omit<Subscription, 'id'>) => void;
    updateSubscription: (sub: Subscription) => void;
    deleteSubscription: (id: string) => void;
    addScheduled: (item: Omit<ScheduledTransaction, 'id'>) => void;
    updateScheduled: (item: ScheduledTransaction) => void;
    deleteScheduled: (id: string) => void;
    logTransaction: (type: TransactionType, item: Omit<Transaction, 'id'>) => void;
    expenseCategories: string[];
    incomeCategories: string[];
    theme: 'light' | 'dark';
}

type TabType = 'all' | 'subscriptions' | 'scheduled';
type PaymentStatus = 'paid' | 'upcoming' | 'overdue' | 'paused';

const FREQUENCY_MULTIPLIER_TO_MONTHLY: Record<Frequency, number> = {
    [Frequency.Weekly]: 4.333,
    [Frequency.Biweekly]: 2.167,
    [Frequency.Monthly]: 1,
    [Frequency.Yearly]: 1 / 12,
    [Frequency.None]: 1,
};

export const getNextDueDate = (lastDueDate: string, frequency: Frequency): string => {
    const nextDate = parseLocalDate(lastDueDate);
    switch (frequency) {
        case Frequency.Weekly:
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case Frequency.Biweekly:
            nextDate.setDate(nextDate.getDate() + 14);
            break;
        case Frequency.Monthly:
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        case Frequency.Yearly:
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        default:
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
    }
    return formatLocalDate(nextDate);
};

export const determinePaymentStatus = (
    name: string,
    dueDateStr: string,
    isPaused: boolean | undefined,
    allTransactions: AllTransaction[] = []
): { status: PaymentStatus; label: string; lastRecordDate?: string } => {
    if (isPaused) {
        return { status: 'paused', label: 'Paused' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = parseLocalDate(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);

    const normName = name.trim().toLowerCase();
    
    // Look for real transaction matching name in current month or around due date
    const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const matchingTx = allTransactions.find((tx) => {
        const txNorm = tx.name.toLowerCase();
        const matchesName = txNorm.includes(normName) || normName.includes(txNorm);
        const matchesCycle = tx.date.startsWith(currentMonthPrefix);
        return matchesName && matchesCycle;
    });

    if (matchingTx) {
        return { status: 'paid', label: 'Paid', lastRecordDate: matchingTx.date };
    }

    if (dueDate.getTime() < today.getTime()) {
        return { status: 'overdue', label: 'Overdue' };
    }

    return { status: 'upcoming', label: 'Upcoming' };
};

export const BillsAndPaymentsView: React.FC<BillsAndPaymentsViewProps> = ({
    subscriptions,
    scheduled,
    allTransactions = [],
    addSubscription,
    updateSubscription,
    deleteSubscription,
    addScheduled,
    updateScheduled,
    deleteScheduled,
    logTransaction,
    expenseCategories,
    incomeCategories,
    theme,
}) => {
    const { t, currencySettings } = useLanguage();
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // Add / Edit form state
    const [editingItem, setEditingItem] = useState<{
        kind: 'subscription' | 'scheduled';
        rawSub?: Subscription;
        rawScheduled?: ScheduledTransaction;
    } | null>(null);

    const [commitmentType, setCommitmentType] = useState<'subscription' | 'scheduled'>('scheduled');
    const [txType, setTxType] = useState<TransactionType.Expense | TransactionType.Income>(TransactionType.Expense);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [frequency, setFrequency] = useState<Frequency>(Frequency.Monthly);
    const [date, setDate] = useState(formatLocalDate(new Date()));
    const [category, setCategory] = useState('');
    const [notes, setNotes] = useState('');
    const [cancellationUrl, setCancellationUrl] = useState('');
    const [formError, setFormError] = useState('');

    // Delete modal confirmation state
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; kind: 'subscription' | 'scheduled' } | null>(null);

    // Monthly regular totals calculation
    const summary = useMemo(() => {
        let monthlyOutflow = 0;
        let monthlyInflow = 0;

        subscriptions.forEach(sub => {
            if (sub.isPaused) return;
            const mult = FREQUENCY_MULTIPLIER_TO_MONTHLY[sub.frequency] || 1;
            const normalized = multiplyMoney(sub.amount, mult);
            if (sub.type === SubscriptionType.Income) {
                monthlyInflow = addMoney(monthlyInflow, normalized);
            } else {
                monthlyOutflow = addMoney(monthlyOutflow, normalized);
            }
        });

        scheduled.forEach(item => {
            if (item.isPaused) return;
            const mult = FREQUENCY_MULTIPLIER_TO_MONTHLY[item.frequency] || 1;
            const normalized = multiplyMoney(item.amount, mult);
            if (item.type === TransactionType.Income) {
                monthlyInflow = addMoney(monthlyInflow, normalized);
            } else {
                monthlyOutflow = addMoney(monthlyOutflow, normalized);
            }
        });

        const netRegular = subtractMoney(monthlyInflow, monthlyOutflow);
        const totalCount = subscriptions.length + scheduled.length;

        return {
            monthlyOutflow,
            monthlyInflow,
            netRegular,
            totalCount,
        };
    }, [subscriptions, scheduled]);

    // Unified combined list for all / filter
    const combinedItems = useMemo(() => {
        const subItems = subscriptions.map(sub => {
            const statusInfo = determinePaymentStatus(sub.name, sub.renewalDate, sub.isPaused, allTransactions);
            return {
                id: sub.id,
                name: sub.name,
                amount: sub.amount,
                frequency: sub.frequency,
                dueDate: sub.renewalDate,
                category: sub.category,
                isIncome: sub.type === SubscriptionType.Income,
                kind: 'subscription' as const,
                health: sub.health,
                cancellationUrl: sub.cancellationUrl,
                isPaused: sub.isPaused,
                statusInfo,
                notes: undefined as string | undefined,
                rawSub: sub as Subscription | undefined,
                rawScheduled: undefined as ScheduledTransaction | undefined,
            };
        });

        const schedItems = scheduled.map(item => {
            const statusInfo = determinePaymentStatus(item.name, item.nextDueDate, item.isPaused, allTransactions);
            return {
                id: item.id,
                name: item.name,
                amount: item.amount,
                frequency: item.frequency,
                dueDate: item.nextDueDate,
                category: item.category,
                isIncome: item.type === TransactionType.Income,
                kind: 'scheduled' as const,
                health: undefined as SubscriptionHealth | undefined,
                cancellationUrl: undefined as string | undefined,
                notes: item.notes,
                isPaused: item.isPaused,
                statusInfo,
                rawSub: undefined as Subscription | undefined,
                rawScheduled: item as ScheduledTransaction | undefined,
            };
        });

        let list = [...subItems, ...schedItems];

        if (activeTab === 'subscriptions') {
            list = list.filter(i => i.kind === 'subscription');
        } else if (activeTab === 'scheduled') {
            list = list.filter(i => i.kind === 'scheduled');
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(i => 
                i.name.toLowerCase().includes(q) || 
                i.category.toLowerCase().includes(q)
            );
        }

        return list.sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());
    }, [subscriptions, scheduled, activeTab, searchQuery, allTransactions]);

    const handleRecordPayment = (item: {
        kind: 'subscription' | 'scheduled';
        name: string;
        amount: number;
        category: string;
        isIncome: boolean;
        frequency: Frequency;
        dueDate: string;
        rawScheduled?: ScheduledTransaction;
        rawSub?: Subscription;
    }) => {
        logTransaction(item.isIncome ? TransactionType.Income : TransactionType.Expense, {
            name: `${item.name} (${t('regularPayment') || 'Payment'})`,
            amount: item.amount,
            date: formatLocalDate(new Date()),
            category: item.category,
        });

        // Advance next due date on the scheduled transaction or subscription
        const newDueDate = getNextDueDate(item.dueDate, item.frequency);
        if (item.kind === 'scheduled' && item.rawScheduled) {
            updateScheduled({
                ...item.rawScheduled,
                nextDueDate: newDueDate,
            });
        } else if (item.kind === 'subscription' && item.rawSub) {
            updateSubscription({
                ...item.rawSub,
                renewalDate: newDueDate,
            });
        }
    };

    const handleTogglePause = (item: {
        kind: 'subscription' | 'scheduled';
        rawScheduled?: ScheduledTransaction;
        rawSub?: Subscription;
    }) => {
        if (item.kind === 'scheduled' && item.rawScheduled) {
            updateScheduled({
                ...item.rawScheduled,
                isPaused: !item.rawScheduled.isPaused,
            });
        } else if (item.kind === 'subscription' && item.rawSub) {
            updateSubscription({
                ...item.rawSub,
                isPaused: !item.rawSub.isPaused,
            });
        }
    };

    const openEditModal = (item: {
        kind: 'subscription' | 'scheduled';
        rawSub?: Subscription;
        rawScheduled?: ScheduledTransaction;
    }) => {
        setEditingItem(item);
        setCommitmentType(item.kind);
        setFormError('');

        if (item.kind === 'subscription' && item.rawSub) {
            const s = item.rawSub;
            setName(s.name);
            setAmount(s.amount.toString());
            setTxType(s.type === SubscriptionType.Income ? TransactionType.Income : TransactionType.Expense);
            setFrequency(s.frequency);
            setDate(s.renewalDate);
            setCategory(s.category);
            setCancellationUrl(s.cancellationUrl || '');
            setNotes('');
        } else if (item.kind === 'scheduled' && item.rawScheduled) {
            const sc = item.rawScheduled;
            setName(sc.name);
            setAmount(sc.amount.toString());
            setTxType(sc.type);
            setFrequency(sc.frequency);
            setDate(sc.nextDueDate);
            setCategory(sc.category);
            setNotes(sc.notes || '');
            setCancellationUrl('');
        }
        setIsAddModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingItem(null);
        setName('');
        setAmount('');
        setCategory('');
        setNotes('');
        setCancellationUrl('');
        setDate(formatLocalDate(new Date()));
        setFormError('');
        setIsAddModalOpen(false);
    };

    const handleSaveForm = (e: React.FormEvent) => {
        e.preventDefault();
        const parsedAmount = parseFloat(amount);
        if (!name.trim()) {
            setFormError('Payment name is required.');
            return;
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setFormError('Please enter a valid amount greater than zero.');
            return;
        }

        const effectiveCat = category.trim() || (txType === TransactionType.Income ? (incomeCategories[0] || 'Income') : (expenseCategories[0] || 'Bills'));

        if (editingItem) {
            if (editingItem.kind === 'subscription' && editingItem.rawSub) {
                updateSubscription({
                    ...editingItem.rawSub,
                    name: name.trim(),
                    amount: parsedAmount,
                    type: txType === TransactionType.Income ? SubscriptionType.Income : SubscriptionType.Expense,
                    frequency,
                    renewalDate: date,
                    category: effectiveCat,
                    cancellationUrl: cancellationUrl.trim() || undefined,
                });
            } else if (editingItem.kind === 'scheduled' && editingItem.rawScheduled) {
                updateScheduled({
                    ...editingItem.rawScheduled,
                    name: name.trim(),
                    amount: parsedAmount,
                    type: txType,
                    frequency,
                    nextDueDate: date,
                    category: effectiveCat,
                    notes: notes.trim() || undefined,
                });
            }
        } else {
            if (commitmentType === 'subscription') {
                addSubscription({
                    name: name.trim(),
                    amount: parsedAmount,
                    type: txType === TransactionType.Income ? SubscriptionType.Income : SubscriptionType.Expense,
                    frequency,
                    renewalDate: date,
                    category: effectiveCat,
                    cancellationUrl: cancellationUrl.trim() || undefined,
                    health: SubscriptionHealth.Good,
                });
            } else {
                addScheduled({
                    name: name.trim(),
                    amount: parsedAmount,
                    type: txType,
                    frequency,
                    startDate: date,
                    nextDueDate: date,
                    category: effectiveCat,
                    notes: notes.trim() || undefined,
                });
            }
        }

        handleCloseModal();
    };

    const handleConfirmDelete = () => {
        if (!deleteTarget) return;
        if (deleteTarget.kind === 'subscription') {
            deleteSubscription(deleteTarget.id);
        } else {
            deleteScheduled(deleteTarget.id);
        }
        setDeleteTarget(null);
    };

    const frequencyLabel = (freq: Frequency) => {
        switch (freq) {
            case Frequency.Weekly: return t('weekly') || 'Weekly';
            case Frequency.Biweekly: return t('biweekly') || 'Bi-weekly';
            case Frequency.Monthly: return t('monthly') || 'Monthly';
            case Frequency.Yearly: return t('yearly') || 'Yearly';
            default: return 'Recurring';
        }
    };

    const renderStatusBadge = (statusInfo: { status: PaymentStatus; label: string; lastRecordDate?: string }) => {
        switch (statusInfo.status) {
            case 'paid':
                return (
                    <span 
                        title={statusInfo.lastRecordDate ? `Confirmed payment recorded on ${statusInfo.lastRecordDate}` : 'Paid record confirmed'}
                        className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                    >
                        <i className="fas fa-check-circle mr-1 text-[9px]"></i>Paid
                    </span>
                );
            case 'overdue':
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-300 dark:border-rose-800 animate-pulse">
                        <i className="fas fa-exclamation-triangle mr-1 text-[9px]"></i>Overdue
                    </span>
                );
            case 'paused':
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-300 dark:border-gray-700">
                        <i className="fas fa-pause-circle mr-1 text-[9px]"></i>Paused
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        <i className="fas fa-clock mr-1 text-[9px]"></i>Upcoming
                    </span>
                );
        }
    };

    return (
        <ViewContainer 
            title={t('billsAndPayments') || 'Bills & Regular Payments'} 
            icon="fas fa-calendar-check"
        >
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 shadow-sm">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('monthlyRegularOutflow') || 'Monthly Regular Outflow'}
                    </p>
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">
                        -{formatCurrency(summary.monthlyOutflow, currencySettings)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Recurring outgoing commitments</p>
                </div>

                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 shadow-sm">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('monthlyRegularInflow') || 'Monthly Regular Inflow'}
                    </p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                        +{formatCurrency(summary.monthlyInflow, currencySettings)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Salary & regular income streams</p>
                </div>

                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 shadow-sm">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('netRegularImpact') || 'Net Regular Balance'}
                    </p>
                    <p className={`text-2xl font-black font-mono mt-1 ${summary.netRegular >= 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-rose-500'}`}>
                        {formatCurrency(summary.netRegular, currencySettings)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Recurring cash flow balance</p>
                </div>

                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Active Commitments
                        </p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white font-mono mt-1">
                            {summary.totalCount}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {subscriptions.length} subs · {scheduled.length} bills
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setIsAddModalOpen(true);
                        }}
                        className="h-11 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-xs font-bold shadow-md shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                        aria-label="Add Regular Payment"
                    >
                        <i className="fas fa-plus text-xs"></i>
                        <span>{t('addRegularPayment') || 'Add Payment'}</span>
                    </button>
                </div>
            </div>

            {/* Main Workspace Surface */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-gray-700/50 shadow-sm">
                {/* Segmented Controls & Search Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700/60">
                    <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-900/60 rounded-xl overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                activeTab === 'all'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            All ({summary.totalCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('subscriptions')}
                            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                activeTab === 'subscriptions'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            Subscriptions ({subscriptions.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('scheduled')}
                            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                activeTab === 'scheduled'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            Scheduled Bills ({scheduled.length})
                        </button>
                    </div>

                    <div className="relative max-w-xs w-full">
                        <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400"></i>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter payments or category..."
                            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                        />
                    </div>
                </div>

                {/* Subscriptions Visual garden on subscriptions tab */}
                {activeTab === 'subscriptions' && subscriptions.length > 0 && (
                    <div className="mb-6 p-6 rounded-2xl bg-gray-50/70 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                            Subscription Cost Distribution
                        </h4>
                        <div className="flex justify-center">
                            <BloomingFlowerChart data={subscriptions} theme={theme} />
                        </div>
                    </div>
                )}

                {/* List of Payments */}
                {combinedItems.length > 0 ? (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {combinedItems.map((item) => (
                            <div 
                                key={`${item.kind}-${item.id}`} 
                                className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 rounded-2xl transition-colors ${
                                    item.isPaused ? 'opacity-60 bg-gray-50/30 dark:bg-gray-900/20' : 'hover:bg-gray-50/60 dark:hover:bg-gray-700/20'
                                }`}
                            >
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm flex-shrink-0 ${
                                        item.isIncome
                                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                            : item.kind === 'subscription'
                                                ? 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                                                : 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400'
                                    }`}>
                                        <i className={
                                            item.isIncome 
                                                ? 'fas fa-arrow-down' 
                                                : item.kind === 'subscription' 
                                                    ? 'fas fa-sync-alt' 
                                                    : 'fas fa-receipt'
                                        }></i>
                                    </div>

                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                                {item.name}
                                            </h4>
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                item.kind === 'subscription'
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40'
                                                    : 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/40'
                                            }`}>
                                                {item.kind === 'subscription' ? 'Subscription' : 'Scheduled Bill'}
                                            </span>
                                            {renderStatusBadge(item.statusInfo)}
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap">
                                            <span>{item.category}</span>
                                            <span aria-hidden="true">·</span>
                                            <span>{frequencyLabel(item.frequency)}</span>
                                            <span aria-hidden="true">·</span>
                                            <span>Next due: <strong className="text-gray-700 dark:text-gray-300">{item.dueDate}</strong></span>
                                            {item.notes && (
                                                <>
                                                    <span aria-hidden="true">·</span>
                                                    <span className="italic text-gray-400 truncate max-w-xs">{item.notes}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0">
                                    <div className="text-left sm:text-right">
                                        <p className={`font-mono font-extrabold text-sm sm:text-base ${
                                            item.isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                        }`}>
                                            {item.isIncome ? '+' : '-'}{formatCurrency(item.amount, currencySettings)}
                                        </p>
                                        <p className="text-[10px] text-gray-400">/{frequencyLabel(item.frequency).toLowerCase()}</p>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {/* Record Payment (Mark Paid) */}
                                        <button
                                            onClick={() => handleRecordPayment(item)}
                                            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                            title="Record payment transaction and advance due date"
                                        >
                                            <i className="fas fa-check text-[10px]"></i>
                                            <span>{t('pay') || 'Record Payment'}</span>
                                        </button>

                                        {/* Pause / Resume */}
                                        <button
                                            onClick={() => handleTogglePause(item)}
                                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-colors cursor-pointer ${
                                                item.isPaused
                                                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-300'
                                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                            title={item.isPaused ? 'Resume payment tracking' : 'Pause payment tracking'}
                                            aria-label={item.isPaused ? 'Resume payment' : 'Pause payment'}
                                        >
                                            <i className={`fas ${item.isPaused ? 'fa-play' : 'fa-pause'}`}></i>
                                        </button>

                                        {/* Edit Action */}
                                        <button
                                            onClick={() => openEditModal(item)}
                                            className="w-8 h-8 rounded-xl text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors flex items-center justify-center cursor-pointer"
                                            title="Edit payment details"
                                            aria-label={`Edit ${item.name}`}
                                        >
                                            <i className="fas fa-pen text-xs"></i>
                                        </button>

                                        {/* External cancellation link if subscription */}
                                        {item.kind === 'subscription' && item.cancellationUrl && (
                                            <a
                                                href={item.cancellationUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-8 h-8 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors flex items-center justify-center cursor-pointer"
                                                title="Open provider cancellation / manage page"
                                                aria-label={`Provider portal for ${item.name}`}
                                            >
                                                <i className="fas fa-external-link-alt text-[10px]"></i>
                                            </a>
                                        )}

                                        {/* Delete Action */}
                                        <button
                                            onClick={() => setDeleteTarget({ id: item.id, name: item.name, kind: item.kind })}
                                            className="w-8 h-8 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center justify-center cursor-pointer"
                                            title="Delete payment schedule"
                                            aria-label={`Delete ${item.name}`}
                                        >
                                            <i className="fas fa-trash-alt text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon="fas fa-calendar-check"
                        title={t('noRegularPayments') || 'No regular payments recorded yet'}
                        description="Track subscriptions, utility bills, rent, and recurring transfers together in one unified schedule."
                        actionLabel={t('addRegularPayment') || 'Add Regular Payment'}
                        onAction={() => {
                            setEditingItem(null);
                            setIsAddModalOpen(true);
                        }}
                    />
                )}
            </div>

            {/* Modal: Add / Edit Regular Payment */}
            {isAddModalOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) handleCloseModal();
                    }}
                >
                    <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">
                                    {editingItem ? 'Edit Regular Payment' : (t('addRegularPayment') || 'Add Regular Payment')}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Keep subscriptions and recurring bills on schedule
                                </p>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                            >
                                <i className="fas fa-times text-xs"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSaveForm} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                            {formError && (
                                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                                    {formError}
                                </div>
                            )}

                            {/* Commitment Kind Picker (only in add mode) */}
                            {!editingItem && (
                                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => setCommitmentType('scheduled')}
                                        className={`py-2 text-xs font-bold rounded-xl transition-all ${
                                            commitmentType === 'scheduled'
                                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                                                : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                    >
                                        <i className="fas fa-receipt mr-1.5 text-[10px]"></i>
                                        Scheduled Bill
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCommitmentType('subscription')}
                                        className={`py-2 text-xs font-bold rounded-xl transition-all ${
                                            commitmentType === 'subscription'
                                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                                                : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                    >
                                        <i className="fas fa-sync-alt mr-1.5 text-[10px]"></i>
                                        Subscription
                                    </button>
                                </div>
                            )}

                            {/* Inflow vs Outflow toggle */}
                            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => setTxType(TransactionType.Expense)}
                                    className={`py-2 text-xs font-bold rounded-xl transition-all ${
                                        txType === TransactionType.Expense
                                            ? 'bg-rose-500 text-white shadow-xs'
                                            : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                >
                                    Outgoing Payment
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTxType(TransactionType.Income)}
                                    className={`py-2 text-xs font-bold rounded-xl transition-all ${
                                        txType === TransactionType.Income
                                            ? 'bg-emerald-500 text-white shadow-xs'
                                            : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                >
                                    Incoming Stream
                                </button>
                            </div>

                            {/* Name & Amount */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                        Payment Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={commitmentType === 'subscription' ? 'e.g. Netflix, Spotify' : 'e.g. Electricity, Rent'}
                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500/30 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                        Amount ({currencySettings.symbol}) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        required
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500/30 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Frequency & Due Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                        Repeats How Often?
                                    </label>
                                    <select
                                        value={frequency}
                                        onChange={(e) => setFrequency(e.target.value as Frequency)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500/30 outline-none"
                                    >
                                        <option value={Frequency.Weekly}>{t('weekly') || 'Weekly'}</option>
                                        <option value={Frequency.Biweekly}>{t('biweekly') || 'Bi-weekly'}</option>
                                        <option value={Frequency.Monthly}>{t('monthly') || 'Monthly'}</option>
                                        <option value={Frequency.Yearly}>{t('yearly') || 'Yearly'}</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                        Next Due Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500/30 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                    Category
                                </label>
                                <input
                                    list="regular-categories-list"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    placeholder="Select or type a category"
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500/30 outline-none"
                                />
                                <datalist id="regular-categories-list">
                                    {(txType === TransactionType.Income ? incomeCategories : expenseCategories).map(cat => (
                                        <option key={cat} value={cat} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Notes or URL */}
                            {commitmentType === 'subscription' ? (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                        Cancellation / Provider URL (Optional)
                                    </label>
                                    <input
                                        type="url"
                                        value={cancellationUrl}
                                        onChange={(e) => setCancellationUrl(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500/30 outline-none"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                        Notes (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Reference number, autopay enabled, etc."
                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500/30 outline-none"
                                    />
                                </div>
                            )}

                            {/* Submit Buttons */}
                            <div className="pt-3 flex items-center justify-end gap-3 flex-shrink-0 border-t border-gray-100 dark:border-gray-800">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 cursor-pointer"
                                >
                                    {t('cancel') || 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-xs font-bold shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                                >
                                    {editingItem ? 'Update Payment' : (t('save') || 'Save Payment')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={deleteTarget !== null}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={handleConfirmDelete}
                title={t('deleteRegularPayment') || 'Delete Regular Payment'}
                message={`Are you sure you want to remove "${deleteTarget?.name}"? Future occurrences will no longer be tracked.`}
                confirmLabel={t('delete') || 'Delete'}
                variant="danger"
            />
        </ViewContainer>
    );
};

export default BillsAndPaymentsView;
