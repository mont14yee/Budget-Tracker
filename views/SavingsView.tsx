import React, { useState, useMemo } from 'react';
import { SavingsGoal, ExtraContribution, CompoundingFrequency } from '../types';
import { formatCurrency, parseLocalDate, formatLocalDate } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import { addMoney, subtractMoney, multiplyMoney, divideMoney } from '../utils/money';

interface SavingsViewProps {
    items: SavingsGoal[];
    addSavingsGoal: (item: Omit<SavingsGoal, 'id' | 'extraContributions'>) => void;
    updateSavingsGoal?: (item: SavingsGoal) => void;
    deleteSavingsGoal: (id: string) => void;
    addExtraContribution: (goalId: string, contribution: Omit<ExtraContribution, 'id'>) => void;
    netBalance: number;
    theme: 'light' | 'dark';
}

export const calculateGoalSavedAmount = (goal: SavingsGoal): number => {
    const extraTotal = (goal.extraContributions || []).reduce((sum, c) => addMoney(sum, c.amount), 0);
    return addMoney(goal.startingBalance, extraTotal);
};

export const calculateGoalRemainingAmount = (goal: SavingsGoal): number => {
    const saved = calculateGoalSavedAmount(goal);
    return Math.max(0, subtractMoney(goal.targetAmount, saved));
};

const compoundBalanceFromCurrent = (goal: SavingsGoal, currentSaved: number, fromDate: Date, toDate: Date) => {
    const { monthlyContribution, interestRate, compoundingFrequency } = goal;
    const months = (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth());
    
    if (months <= 0) return { projection: [{ date: new Date(fromDate), balance: currentSaved }], futureValue: currentSaved };

    const n = { [CompoundingFrequency.Daily]: 365, [CompoundingFrequency.Monthly]: 12, [CompoundingFrequency.Yearly]: 1 }[compoundingFrequency] || 12;
    const r = (interestRate || 0) / 100;
    
    const projectionData: { date: Date, balance: number }[] = [];
    let balance = currentSaved;
    let currentDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);

    for (let i = 0; i <= months; i++) {
        projectionData.push({ date: new Date(currentDate), balance });

        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        
        if (interestRate > 0) {
            if (compoundingFrequency === CompoundingFrequency.Monthly) {
                balance = multiplyMoney(balance, 1 + r / n);
            } else if (compoundingFrequency === CompoundingFrequency.Daily) {
                balance = multiplyMoney(balance, Math.pow(1 + r / n, daysInMonth));
            } else if (compoundingFrequency === CompoundingFrequency.Yearly && currentDate.getMonth() === 11) {
                balance = multiplyMoney(balance, 1 + r / n);
            }
        }

        balance = addMoney(balance, monthlyContribution || 0);
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return { projection: projectionData, futureValue: balance };
};

const GrowthChart: React.FC<{ goal: SavingsGoal; projection: any[]; theme: 'light' | 'dark' }> = ({ goal, projection, theme }) => {
    const { t } = useLanguage();
    const milestones = useMemo(() => {
        return [0.25, 0.50, 0.75, 1.0].map(p => {
            const target = goal.targetAmount * p;
            const point = projection.find(d => d.balance >= target);
            if (point) return { ...point, label: `${Math.round(p * 100)}%` };
            return null;
        }).filter(Boolean);
    }, [goal.targetAmount, projection]);

    return (
        <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
                <LineChart data={projection} margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                    <XAxis dataKey="date" tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} fontSize={10} />
                    <YAxis tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} fontSize={10} domain={['dataMin', Math.max(goal.targetAmount * 1.05, 100)]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="balance" name={t('balance') || 'Projected Balance'} stroke="#10b981" strokeWidth={2.5} dot={false} />
                    {milestones.map((m, i) => m && <ReferenceDot key={i} x={m.date} y={m.balance} r={4.5} fill="#f59e0b" stroke="white" strokeWidth={1.5} />)}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

const SavingsGoalCard: React.FC<{
    item: SavingsGoal;
    onEdit: (goal: SavingsGoal) => void;
    onDelete: (id: string) => void;
    onAddExtra: (goalId: string, contribution: Omit<ExtraContribution, 'id'>) => void;
    theme: 'light' | 'dark';
}> = ({ item, onEdit, onDelete, onAddExtra, theme }) => {
    const { t, currencySettings } = useLanguage();
    const [contributionInput, setContributionInput] = useState('');
    const [contributionError, setContributionError] = useState('');

    const savedAmount = useMemo(() => calculateGoalSavedAmount(item), [item]);
    const remainingAmount = useMemo(() => calculateGoalRemainingAmount(item), [item]);
    const progressPercent = item.targetAmount > 0 ? Math.min(100, (savedAmount / item.targetAmount) * 100) : 0;
    const isCompleted = savedAmount >= item.targetAmount && item.targetAmount > 0;

    const { projection, futureValue } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = parseLocalDate(item.deadline);
        const { projection: rawProj, futureValue: fVal } = compoundBalanceFromCurrent(item, savedAmount, today, endDate);
        const monthFormatter = new Intl.DateTimeFormat('default', { month: 'short', year: '2-digit' });
        return {
            projection: rawProj.map(p => ({ date: monthFormatter.format(p.date), balance: p.balance })),
            futureValue: fVal
        };
    }, [item, savedAmount]);

    const handleAddContribution = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(contributionInput);
        if (isNaN(amt) || amt <= 0) {
            setContributionError('Enter a valid contribution amount greater than 0.');
            return;
        }
        setContributionError('');
        onAddExtra(item.id, {
            amount: amt,
            date: formatLocalDate(new Date()),
        });
        setContributionInput('');
    };

    return (
        <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/60 dark:border-gray-700/60 flex flex-col justify-between transition-all duration-300">
            <div>
                {/* Header: Name, Target Date, Actions */}
                <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">{item.name}</h3>
                            {isCompleted && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                    Target Met
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                            <span><i className="far fa-calendar-alt text-xs mr-1 text-gray-400"></i>Target date: <strong className="text-gray-700 dark:text-gray-300">{item.deadline || 'No date set'}</strong></span>
                            {item.interestRate > 0 && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span>{item.interestRate}% APY</span>
                                </>
                            )}
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors cursor-pointer"
                            title="Edit goal"
                            aria-label={`Edit ${item.name}`}
                        >
                            <i className="fas fa-pen text-xs"></i>
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(item.id)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete goal"
                            aria-label={`Delete ${item.name}`}
                        >
                            <i className="fas fa-trash-alt text-xs"></i>
                        </button>
                    </div>
                </div>

                {/* Progress Visual & Key Figures */}
                <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 mb-5">
                    <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Savings Progress
                        </span>
                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                            {progressPercent.toFixed(1)}%
                        </span>
                    </div>

                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-800 text-center">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Amount Saved</p>
                            <p className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                                {formatCurrency(savedAmount, currencySettings)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Target Amount</p>
                            <p className="font-mono font-bold text-sm text-gray-900 dark:text-white mt-0.5">
                                {formatCurrency(item.targetAmount, currencySettings)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Remaining</p>
                            <p className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                                {formatCurrency(remainingAmount, currencySettings)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Projected Compound Growth */}
                {projection.length > 1 && (
                    <div className="mb-5">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Projected Compound Trajectory
                            </h4>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Target Value: <strong className="text-gray-800 dark:text-gray-200">{formatCurrency(futureValue, currencySettings)}</strong>
                            </span>
                        </div>
                        <GrowthChart goal={item} projection={projection} theme={theme} />
                    </div>
                )}
            </div>

            {/* Add Contribution Form */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800/80">
                <form onSubmit={handleAddContribution} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                                {currencySettings.symbol}
                            </span>
                            <input
                                type="number"
                                step="any"
                                min="0.01"
                                value={contributionInput}
                                onChange={(e) => {
                                    setContributionInput(e.target.value);
                                    if (contributionError) setContributionError('');
                                }}
                                placeholder="Add contribution..."
                                className="w-full pl-7 pr-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            <i className="fas fa-plus text-[10px]"></i>
                            <span>Contribute</span>
                        </button>
                    </div>
                    {contributionError && (
                        <p className="text-[11px] text-rose-500 dark:text-rose-400">{contributionError}</p>
                    )}
                </form>
            </div>
        </div>
    );
};

export const SavingsView: React.FC<SavingsViewProps> = ({
    items,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    addExtraContribution,
    netBalance,
    theme,
}) => {
    const { t, currencySettings } = useLanguage();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    // Form inputs state
    const [name, setName] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [deadline, setDeadline] = useState(formatLocalDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1))));
    const [startingBalance, setStartingBalance] = useState('0');
    const [monthlyContribution, setMonthlyContribution] = useState('50');
    const [interestRate, setInterestRate] = useState('4.5');
    const [compoundingFrequency, setCompoundingFrequency] = useState<CompoundingFrequency>(CompoundingFrequency.Monthly);
    const [formError, setFormError] = useState('');

    // Summary calculations across all goals
    const totals = useMemo(() => {
        let totalTarget = 0;
        let totalSaved = 0;

        items.forEach((g) => {
            totalTarget = addMoney(totalTarget, g.targetAmount);
            totalSaved = addMoney(totalSaved, calculateGoalSavedAmount(g));
        });

        const totalRemaining = Math.max(0, subtractMoney(totalTarget, totalSaved));
        const overallProgress = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

        return {
            totalTarget,
            totalSaved,
            totalRemaining,
            overallProgress,
            activeCount: items.length,
        };
    }, [items]);

    const resetForm = () => {
        setName('');
        setTargetAmount('');
        setStartingBalance('0');
        setMonthlyContribution('50');
        setDeadline(formatLocalDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1))));
        setInterestRate('4.5');
        setCompoundingFrequency(CompoundingFrequency.Monthly);
        setFormError('');
        setShowCreateModal(false);
        setEditingGoal(null);
    };

    const openEditModal = (goal: SavingsGoal) => {
        setEditingGoal(goal);
        setName(goal.name);
        setTargetAmount(goal.targetAmount.toString());
        setDeadline(goal.deadline);
        setStartingBalance(goal.startingBalance.toString());
        setMonthlyContribution(goal.monthlyContribution.toString());
        setInterestRate(goal.interestRate.toString());
        setCompoundingFrequency(goal.compoundingFrequency);
        setFormError('');
        setShowCreateModal(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsedTarget = parseFloat(targetAmount);
        const parsedStarting = parseFloat(startingBalance) || 0;
        const parsedMonthly = parseFloat(monthlyContribution) || 0;
        const parsedRate = parseFloat(interestRate) || 0;

        if (!name.trim()) {
            setFormError('Goal name is required.');
            return;
        }
        if (isNaN(parsedTarget) || parsedTarget <= 0) {
            setFormError('Target amount must be greater than zero.');
            return;
        }
        if (parsedStarting < 0) {
            setFormError('Starting balance cannot be negative.');
            return;
        }
        if (!deadline) {
            setFormError('Target completion date is required.');
            return;
        }

        if (editingGoal && updateSavingsGoal) {
            updateSavingsGoal({
                ...editingGoal,
                name: name.trim(),
                targetAmount: parsedTarget,
                deadline,
                startingBalance: parsedStarting,
                monthlyContribution: parsedMonthly,
                interestRate: parsedRate,
                compoundingFrequency,
            });
        } else {
            addSavingsGoal({
                name: name.trim(),
                targetAmount: parsedTarget,
                deadline,
                startingBalance: parsedStarting,
                monthlyContribution: parsedMonthly,
                interestRate: parsedRate,
                compoundingFrequency,
            });
        }
        resetForm();
    };

    const inputClasses = "w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none transition-all";
    const labelClasses = "block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1";

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/60 dark:border-gray-700/50 mb-8 animate-fadeIn">
            {/* Header & Quick Action */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-gray-700/50">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
                            <i className="fas fa-piggy-bank"></i>
                        </div>
                        {t('savings') || 'Savings Goals'}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Track progress toward your targets and watch compound contributions grow.
                    </p>
                </div>

                <button
                    onClick={() => {
                        resetForm();
                        setShowCreateModal(true);
                    }}
                    className="h-11 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                    <i className="fas fa-plus text-xs"></i>
                    <span>{t('newSavingsGoal') || 'Create Savings Goal'}</span>
                </button>
            </div>

            {/* Overview Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total Saved
                    </p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                        {formatCurrency(totals.totalSaved, currencySettings)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Across {totals.activeCount} active goals</p>
                </div>

                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total Targets
                    </p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white font-mono mt-1">
                        {formatCurrency(totals.totalTarget, currencySettings)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Cumulative goal objectives</p>
                </div>

                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Remaining to Save
                    </p>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                        {formatCurrency(totals.totalRemaining, currencySettings)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Balance needed to reach all targets</p>
                </div>

                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Overall Completion
                    </p>
                    <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400 font-mono mt-1">
                        {totals.overallProgress.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Portfolio progress rate</p>
                </div>
            </div>

            {/* Goals Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {items.length > 0 ? (
                    items.map(item => (
                        <SavingsGoalCard
                            key={item.id}
                            item={item}
                            onEdit={openEditModal}
                            onDelete={id => setPendingDeleteId(id)}
                            onAddExtra={addExtraContribution}
                            theme={theme}
                        />
                    ))
                ) : (
                    <div className="col-span-full">
                        <EmptyState
                            icon="fas fa-piggy-bank"
                            title={t('noSavingsGoals') || 'No savings goals created yet'}
                            description={t('savingsDescription') || 'Create your first savings goal to track your progress, amount remaining, and projected compound growth.'}
                            actionLabel={t('newSavingsGoal') || 'Create Savings Goal'}
                            onAction={() => {
                                resetForm();
                                setShowCreateModal(true);
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Modal: Create or Edit Goal */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) resetForm();
                    }}
                >
                    <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">
                                    {editingGoal ? 'Edit Savings Goal' : (t('newSavingsGoal') || 'Create Savings Goal')}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Define your goal target, timeline, and contribution pace
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                            >
                                <i className="fas fa-times text-xs"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                            {formError && (
                                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label htmlFor="goal-name" className={labelClasses}>
                                    Goal Name *
                                </label>
                                <input
                                    id="goal-name"
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Emergency Fund, New Car, Vacation"
                                    className={inputClasses}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="goal-target" className={labelClasses}>
                                        Target Amount ({currencySettings.symbol}) *
                                    </label>
                                    <input
                                        id="goal-target"
                                        type="number"
                                        min="0.01"
                                        step="any"
                                        value={targetAmount}
                                        onChange={e => setTargetAmount(e.target.value)}
                                        placeholder="0.00"
                                        className={inputClasses}
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="goal-deadline" className={labelClasses}>
                                        Target Date *
                                    </label>
                                    <input
                                        id="goal-deadline"
                                        type="date"
                                        value={deadline}
                                        onChange={e => setDeadline(e.target.value)}
                                        className={inputClasses}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="goal-starting" className={labelClasses}>
                                        Starting Balance ({currencySettings.symbol})
                                    </label>
                                    <input
                                        id="goal-starting"
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={startingBalance}
                                        onChange={e => setStartingBalance(e.target.value)}
                                        className={inputClasses}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="goal-monthly" className={labelClasses}>
                                        Monthly Deposit ({currencySettings.symbol})
                                    </label>
                                    <input
                                        id="goal-monthly"
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={monthlyContribution}
                                        onChange={e => setMonthlyContribution(e.target.value)}
                                        className={inputClasses}
                                    />
                                    {netBalance > 0 && (
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            Current monthly cash surplus: {formatCurrency(netBalance, currencySettings)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="goal-rate" className={labelClasses}>
                                        Annual Interest / APY (%)
                                    </label>
                                    <input
                                        id="goal-rate"
                                        type="number"
                                        step="0.01"
                                        value={interestRate}
                                        onChange={e => setInterestRate(e.target.value)}
                                        placeholder="0.0"
                                        className={inputClasses}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="goal-compounding" className={labelClasses}>
                                        Compounding Frequency
                                    </label>
                                    <select
                                        id="goal-compounding"
                                        value={compoundingFrequency}
                                        onChange={e => setCompoundingFrequency(e.target.value as CompoundingFrequency)}
                                        className={inputClasses}
                                    >
                                        <option value={CompoundingFrequency.Daily}>{t('daily') || 'Daily'}</option>
                                        <option value={CompoundingFrequency.Monthly}>{t('monthly') || 'Monthly'}</option>
                                        <option value={CompoundingFrequency.Yearly}>{t('yearly') || 'Yearly'}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-3 flex-shrink-0 border-t border-gray-100 dark:border-gray-800">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 cursor-pointer"
                                >
                                    {t('cancel') || 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                                >
                                    {editingGoal ? 'Update Goal' : (t('save') || 'Save Goal')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Accessible Confirmation Modal for Delete */}
            <ConfirmModal
                isOpen={!!pendingDeleteId}
                title={t('confirmDelete') || 'Delete Savings Goal'}
                message={t('confirmDeleteGoal') || 'Are you sure you want to delete this savings goal? This action cannot be undone.'}
                confirmLabel={t('delete') || 'Delete'}
                cancelLabel={t('cancel') || 'Cancel'}
                variant="danger"
                onConfirm={() => {
                    if (pendingDeleteId) {
                        deleteSavingsGoal(pendingDeleteId);
                        setPendingDeleteId(null);
                    }
                }}
                onCancel={() => setPendingDeleteId(null)}
            />
        </div>
    );
};

export default SavingsView;