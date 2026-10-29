import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface DesktopStatusFooterProps {
    totalTransactionsCount: number;
    activeCurrencySymbol: string;
    lastUpdatedText?: string;
}

export const DesktopStatusFooter: React.FC<DesktopStatusFooterProps> = ({
    totalTransactionsCount,
    activeCurrencySymbol,
    lastUpdatedText = 'Real-time'
}) => {
    const { t } = useLanguage();

    return (
        <footer
            id="desktop-status-footer"
            aria-label="Workspace Status Footer"
            className="hidden lg:flex items-center justify-between px-8 py-3 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-t border-gray-200/60 dark:border-gray-800/60 text-[11px] font-medium text-gray-500 dark:text-gray-400 select-none z-10 transition-colors"
        >
            {/* Left: Storage Vault Assurance */}
            <div className="flex items-center gap-3">
                <span className="text-gray-600 dark:text-gray-300 font-medium">
                    Local Device Vault
                </span>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="text-gray-400 dark:text-gray-500">Private offline storage</span>
            </div>

            {/* Middle: Active Ledger Statistics */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <i className="fas fa-coins text-[10px] text-cyan-500"></i>
                    <span>Base Currency: <strong className="text-gray-700 dark:text-gray-200">{activeCurrencySymbol}</strong></span>
                </div>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <div className="flex items-center gap-1.5">
                    <i className="fas fa-receipt text-[10px] text-indigo-500"></i>
                    <span>{totalTransactionsCount} {totalTransactionsCount === 1 ? 'Record' : 'Records'} Tracked</span>
                </div>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <span>Sync: <span className="text-gray-700 dark:text-gray-200">{lastUpdatedText}</span></span>
            </div>

            {/* Right: Keyboard Shortcuts & Version */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-[9px] font-mono font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">⌘K</kbd>
                    <span>Search</span>
                </div>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <span className="font-mono text-gray-400 dark:text-gray-500">Wallet Pro v1.0</span>
            </div>
        </footer>
    );
};
