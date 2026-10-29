import React, { useMemo } from 'react';
import { ViewType, FeatureType, UserProfile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface DesktopHeaderProps {
    activeView: ViewType;
    activeFeature: FeatureType | null;
    userProfile?: UserProfile | null;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    onQuickAction: () => void;
    onOpenSearch: () => void;
    onNavigateSettings: () => void;
    onOpenAiAssistant?: () => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
    activeView,
    activeFeature,
    userProfile,
    theme,
    setTheme,
    onQuickAction,
    onOpenSearch,
    onNavigateSettings,
    onOpenAiAssistant
}) => {
    const { t, language, setLanguage } = useLanguage();

    // Determine current view/feature title & icon
    const currentContext = useMemo(() => {
        if (activeFeature) {
            switch (activeFeature) {
                case FeatureType.Savings:
                    return { title: t('savings') || 'Savings Goals', subtitle: 'Target planning & milestone progress', icon: 'fas fa-piggy-bank' };
                case FeatureType.Loans:
                    return { title: t('loans') || 'Loans & Debts', subtitle: 'Money you owe & money lent', icon: 'fas fa-hand-holding-usd' };
                case FeatureType.BillsAndPayments:
                    return { title: t('billsAndPayments') || 'Bills & Regular Payments', subtitle: 'Subscriptions, recurring bills & transfers', icon: 'fas fa-calendar-check' };
                case FeatureType.Reports:
                    return { title: t('reports') || 'Financial Reports', subtitle: 'Statements, breakdowns & CSV exports', icon: 'fas fa-file-invoice-dollar' };
                default:
                    return { title: 'Workspace', subtitle: 'Budget Management', icon: 'fas fa-layer-group' };
            }
        }

        switch (activeView) {
            case ViewType.Dashboard:
                return { title: t('dashboard') || 'Financial Dashboard', subtitle: 'Money in and out & overview', icon: 'fas fa-chart-line' };
            case ViewType.Income:
            case ViewType.Expenses:
                return { title: t('incomeAndSpending') || 'Income & Spending', subtitle: 'Transaction ledger & cash flow entry', icon: 'fas fa-exchange-alt' };
            case ViewType.Investments:
                return { title: t('invest') || t('investments') || 'Investments', subtitle: 'Holdings & portfolio value', icon: 'fas fa-arrow-trend-up' };
            case ViewType.Settings:
                return { title: t('settings') || 'Settings & Profile', subtitle: 'Preferences, security & vault', icon: 'fas fa-cog' };
            default:
                return { title: 'Workspace', subtitle: 'Budget Management', icon: 'fas fa-layer-group' };
        }
    }, [activeView, activeFeature, t]);

    // Current formatted date and reporting month
    const { formattedDate, reportingPeriod } = useMemo(() => {
        const now = new Date();
        const dateStr = new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).format(now);
        const periodStr = new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en-US', {
            month: 'long',
            year: 'numeric'
        }).format(now);
        return { formattedDate: dateStr, reportingPeriod: periodStr };
    }, [language]);

    return (
        <header
            id="desktop-header"
            aria-label="Workspace Top Navigation"
            className="hidden lg:flex items-center justify-between sticky top-0 z-20 h-20 px-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl border-b border-gray-200/70 dark:border-gray-800/70 transition-colors"
        >
            {/* Left: View Title, Period & Context */}
            <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-lg border border-cyan-500/20 shadow-sm flex-shrink-0">
                    <i className={currentContext.icon}></i>
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white truncate">
                            {currentContext.title}
                        </h1>
                        <span className="hidden xl:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/50">
                            <i className="fas fa-calendar-alt text-[10px]"></i>
                            <span>{reportingPeriod}</span>
                        </span>
                        <span className="hidden 2xl:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200/60 dark:border-gray-700/60">
                            {formattedDate}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium truncate">
                        {currentContext.subtitle}
                    </p>
                </div>
            </div>

            {/* Middle: Fast Search Bar */}
            <div className="flex-1 max-w-md mx-6">
                <button
                    onClick={onOpenSearch}
                    className="w-full h-11 px-4 rounded-2xl bg-gray-100/80 dark:bg-gray-800/60 hover:bg-gray-200/70 dark:hover:bg-gray-800 border border-gray-200/70 dark:border-gray-700/50 text-gray-500 dark:text-gray-400 flex items-center justify-between transition-all group shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    aria-label="Search transactions"
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <i className="fas fa-search text-xs text-gray-400 group-hover:text-cyan-500 transition-colors"></i>
                        <span className="text-xs text-gray-400 font-medium truncate">
                            {t('searchPlaceholder') || 'Search transactions, categories...'}
                        </span>
                    </div>
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-bold text-gray-400 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xs">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </button>
            </div>

            {/* Right: Quick Action & Controls */}
            <div className="flex items-center gap-3 flex-shrink-0">
                {/* Primary Quick Action: Add Transaction */}
                <button
                    onClick={onQuickAction}
                    className="h-11 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-xs font-bold tracking-wide shadow-md shadow-cyan-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                    aria-label="Add New Transaction"
                >
                    <i className="fas fa-plus text-[11px]"></i>
                    <span className="whitespace-nowrap">{t('addNew') || 'Add Entry'}</span>
                </button>

                {/* AI Assistant Quick Button */}
                <button
                    onClick={onOpenAiAssistant}
                    className="h-11 px-3.5 rounded-2xl border border-cyan-500/30 bg-cyan-50/50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold hover:bg-cyan-100/70 dark:hover:bg-cyan-900/30 transition-all flex items-center gap-2 cursor-pointer shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    aria-label="Financial AI Assistant"
                >
                    <i className="fas fa-robot text-xs"></i>
                    <span className="hidden xl:inline text-xs">AI Copilot</span>
                </button>

                {/* Language Switcher */}
                <button
                    onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
                    className="h-11 px-3 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-xs font-bold font-mono shadow-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    aria-label="Toggle language between English and Amharic"
                    title="Change Language"
                >
                    {language === 'en' ? 'አማ' : 'EN'}
                </button>

                {/* Theme Switcher */}
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="w-11 h-11 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center justify-center shadow-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    aria-label="Toggle dark mode"
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {theme === 'dark' ? (
                        <i className="fas fa-sun text-sm text-amber-400"></i>
                    ) : (
                        <i className="fas fa-moon text-sm text-slate-600"></i>
                    )}
                </button>

                {/* User Profile Pill */}
                <button
                    onClick={onNavigateSettings}
                    className="flex items-center gap-2.5 pl-2 pr-3 h-11 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-xs cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    aria-label="User Profile and Settings"
                >
                    <div className="w-8 h-8 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center border border-gray-200 dark:border-gray-600">
                        {userProfile?.avatar ? (
                            <img src={userProfile.avatar} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                            <i className="fas fa-user text-gray-400 text-xs"></i>
                        )}
                    </div>
                    <div className="text-left hidden xl:block">
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100 group-hover:text-cyan-500 transition-colors leading-tight">
                            {userProfile?.name || 'User'}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">
                            Settings
                        </p>
                    </div>
                </button>
            </div>
        </header>
    );
};
