import React, { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { formatLocalDate } from '../constants';
import { getActiveSessionToken } from '../services/localAuthService';

interface GlobalQuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddIncome: (transaction: Omit<Transaction, 'id'>) => void;
    onAddExpense: (transaction: Omit<Transaction, 'id'>) => void;
    incomeCategories: string[];
    expenseCategories: string[];
    showToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const GlobalQuickAddModal: React.FC<GlobalQuickAddModalProps> = ({
    isOpen,
    onClose,
    onAddIncome,
    onAddExpense,
    incomeCategories,
    expenseCategories,
    showToast
}) => {
    const { t, currencySettings } = useLanguage();
    const [type, setType] = useState<TransactionType>(TransactionType.Expense);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState(formatLocalDate(new Date()));
    const [mood, setMood] = useState<'happy' | 'neutral' | 'sad'>('neutral');
    const [isCategorizing, setIsCategorizing] = useState(false);
    
    const amountInputRef = useRef<HTMLInputElement>(null);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                amountInputRef.current?.focus();
            }, 100);
        } else {
            // Reset fields
            setName('');
            setAmount('');
            setCategory('');
            setDate(formatLocalDate(new Date()));
            setMood('neutral');
        }
    }, [isOpen]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const currentCategories = type === TransactionType.Income ? incomeCategories : expenseCategories;

    // AI Categorization helper
    const handleAiCategorize = async () => {
        if (!name.trim()) {
            showToast?.('info', 'Please enter a description first');
            return;
        }

        setIsCategorizing(true);
        try {
            const token = getActiveSessionToken();
            const res = await fetch('/api/categorize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    description: name,
                    categories: currentCategories,
                    type: type
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.category && currentCategories.includes(data.category)) {
                    setCategory(data.category);
                    showToast?.('success', `Categorized as ${data.category}`);
                } else if (currentCategories.length > 0) {
                    setCategory(currentCategories[0]);
                }
            }
        } catch {
            // Fallback gracefully
        } finally {
            setIsCategorizing(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            showToast?.('error', 'Please enter a valid positive amount');
            return;
        }

        const selectedCat = category || (currentCategories.length > 0 ? currentCategories[0] : 'General');

        const newTx = {
            name: name.trim() || (type === TransactionType.Income ? 'Income' : 'Expense'),
            amount: parsedAmount,
            category: selectedCat,
            date: date || formatLocalDate(new Date()),
            type: type,
            mood: mood
        };

        if (type === TransactionType.Income) {
            onAddIncome(newTx);
            showToast?.('success', `Recorded ${currencySettings.symbol}${parsedAmount.toFixed(2)} income`);
        } else {
            onAddExpense(newTx);
            showToast?.('success', `Recorded ${currencySettings.symbol}${parsedAmount.toFixed(2)} expense`);
        }

        onClose();
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-add-title"
        >
            <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200/80 dark:border-gray-700/70 overflow-hidden transform transition-all">
                {/* Header with Type Toggle */}
                <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 id="quick-add-title" className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
                            {t('addNew') || 'Add Transaction'}
                        </h2>
                        <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Quickly record cash inflow or outflow
                        </p>
                    </div>

                    {/* Segmented Switcher */}
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                setType(TransactionType.Expense);
                                setCategory('');
                            }}
                            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                                type === TransactionType.Expense
                                    ? 'bg-rose-500 text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            {t('expense') || 'Expense'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setType(TransactionType.Income);
                                setCategory('');
                            }}
                            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                                type === TransactionType.Income
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            {t('income') || 'Income'}
                        </button>
                    </div>
                </div>

                {/* Form Body - Scrollable */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
                    {/* Amount Input (Prominent) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                            {t('amount')} ({currencySettings.symbol}) *
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-lg">
                                {currencySettings.symbol}
                            </span>
                            <input
                                ref={amountInputRef}
                                type="number"
                                step="any"
                                min="0.01"
                                required
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-10 pr-4 py-3 text-2xl font-black rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-mono"
                            />
                        </div>
                    </div>

                    {/* Description / Name */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('description' as any) || 'Description'} *
                            </label>
                            {name.trim().length > 2 && (
                                <button
                                    type="button"
                                    onClick={handleAiCategorize}
                                    disabled={isCategorizing}
                                    className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <i className={`fas fa-magic ${isCategorizing ? 'fa-spin' : ''}`}></i>
                                    <span>AI Suggest Category</span>
                                </button>
                            )}
                        </div>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={type === TransactionType.Income ? "e.g., Monthly Salary, Freelance project" : "e.g., Grocery shopping, Electricity bill"}
                            className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                        />
                    </div>

                    {/* Category & Date Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Category */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                                {t('category')} *
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all cursor-pointer"
                            >
                                <option value="">Select Category</option>
                                {currentCategories.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                                {t('date')} *
                            </label>
                            <input
                                type="date"
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Mood Selector */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                            Transaction Sentiment
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['happy', 'neutral', 'sad'] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setMood(m)}
                                    className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                                        mood === m
                                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    <i className={`fas ${m === 'happy' ? 'fa-smile text-emerald-500' : m === 'sad' ? 'fa-frown text-rose-500' : 'fa-meh text-amber-500'}`}></i>
                                    <span className="capitalize">{m}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 cursor-pointer"
                        >
                            {t('cancel') || 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            className={`min-h-[44px] px-6 py-2.5 rounded-2xl text-xs font-bold text-white shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer ${
                                type === TransactionType.Income
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/25'
                                    : 'bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 shadow-rose-500/25'
                            }`}
                        >
                            <i className="fas fa-check mr-1.5"></i>
                            {t('save') || 'Record Entry'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
