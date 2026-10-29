import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { formatCurrency } from '../constants';

interface GlobalSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    allIncome: Transaction[];
    allExpenses: Transaction[];
    onSelectTransaction?: (transaction: Transaction) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
    isOpen,
    onClose,
    allIncome,
    allExpenses,
    onSelectTransaction
}) => {
    const { t, currencySettings } = useLanguage();
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        } else {
            setQuery('');
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

    const results = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase().trim();

        const combined = [
            ...allIncome.map(t => ({ ...t, type: TransactionType.Income })),
            ...allExpenses.map(t => ({ ...t, type: TransactionType.Expense }))
        ];

        return combined
            .filter(t => 
                t.name.toLowerCase().includes(q) || 
                t.category.toLowerCase().includes(q) ||
                t.date.includes(q) ||
                t.amount.toString().includes(q)
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 12);
    }, [query, allIncome, allExpenses]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Global Transaction Search"
        >
            <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200/80 dark:border-gray-700/70 overflow-hidden transform transition-all">
                {/* Search Input Bar */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                    <i className="fas fa-search text-gray-400 pl-2 text-base"></i>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Type to search transactions, categories, amounts, or dates..."
                        className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none py-1.5"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                    <kbd className="px-2 py-1 text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        ESC
                    </kbd>
                </div>

                {/* Results List */}
                <div className="max-h-96 overflow-y-auto p-2">
                    {query.trim() === '' ? (
                        <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                            <i className="fas fa-receipt text-3xl mb-2 opacity-40"></i>
                            <p className="text-xs">Quickly find any historical transaction in your local records</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                            <i className="fas fa-folder-open text-3xl mb-2 opacity-40"></i>
                            <p className="text-xs">No transactions matching "{query}"</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {results.map((tx) => {
                                const isIncome = tx.type === TransactionType.Income;
                                return (
                                    <div
                                        key={tx.id}
                                        onClick={() => {
                                            onSelectTransaction?.(tx);
                                            onClose();
                                        }}
                                        className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-100/80 dark:hover:bg-gray-800/80 cursor-pointer transition-colors group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${
                                                isIncome
                                                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                                            }`}>
                                                <i className={isIncome ? 'fas fa-arrow-down' : 'fas fa-arrow-up'}></i>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                                    {tx.name}
                                                </p>
                                                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                                                    <span>{tx.category}</span>
                                                    <span>•</span>
                                                    <span>{tx.date}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className={`text-xs font-black font-mono ${
                                                isIncome
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-rose-600 dark:text-rose-400'
                                            }`}>
                                                {isIncome ? '+' : '-'}{formatCurrency(tx.amount, currencySettings)}
                                            </span>
                                            <div className="text-[10px] text-gray-400 uppercase font-semibold">
                                                {isIncome ? 'Income' : 'Expense'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer hint */}
                <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400 flex items-center justify-between">
                    <span>Showing matching records from local storage</span>
                    <span>{results.length} results</span>
                </div>
            </div>
        </div>
    );
};
