import React from 'react';
import { ViewType, FeatureType, UserProfile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface DesktopSidebarProps {
    activeView: ViewType;
    activeFeature: FeatureType | null;
    onNavigateView: (view: ViewType) => void;
    onNavigateFeature: (feature: FeatureType) => void;
    userProfile?: UserProfile | null;
    counts?: {
        savings?: number;
        loans?: number;
        billsAndPayments?: number;
        subscriptions?: number;
        scheduled?: number;
        investments?: number;
    };
    onOpenAiAssistant?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
    activeView,
    activeFeature,
    onNavigateView,
    onNavigateFeature,
    userProfile,
    counts,
    onOpenAiAssistant
}) => {
    const { t } = useLanguage();

    const isHomeActive = activeView === ViewType.Dashboard && activeFeature === null;
    const isIncomeSpendingActive = (activeView === ViewType.Expenses || activeView === ViewType.Income) && activeFeature === null;
    const isSavingsActive = activeFeature === FeatureType.Savings;
    const isBillsActive = activeFeature === FeatureType.BillsAndPayments;
    const isLoansActive = activeFeature === FeatureType.Loans;
    const isReportsActive = activeFeature === FeatureType.Reports;
    const isInvestmentsActive = activeView === ViewType.Investments && activeFeature === null;
    const isSettingsActive = activeView === ViewType.Settings && activeFeature === null;

    const billsCount = counts?.billsAndPayments ?? ((counts?.subscriptions ?? 0) + (counts?.scheduled ?? 0));

    // The 8 simplified primary navigation items
    const navItems = [
        {
            id: 'home',
            label: t('home') || 'Home',
            icon: 'fas fa-home',
            isActive: isHomeActive,
            onClick: () => onNavigateView(ViewType.Dashboard),
        },
        {
            id: 'income-spending',
            label: t('incomeAndSpending') || 'Income & spending',
            icon: 'fas fa-exchange-alt',
            isActive: isIncomeSpendingActive,
            onClick: () => onNavigateView(ViewType.Expenses),
        },
        {
            id: 'savings',
            label: t('savings') || 'Savings',
            icon: 'fas fa-piggy-bank',
            isActive: isSavingsActive,
            onClick: () => onNavigateFeature(FeatureType.Savings),
            count: counts?.savings,
        },
        {
            id: 'bills-regular-payments',
            label: t('billsAndPayments') || 'Bills & regular payments',
            icon: 'fas fa-calendar-check',
            isActive: isBillsActive,
            onClick: () => onNavigateFeature(FeatureType.BillsAndPayments),
            count: billsCount,
        },
        {
            id: 'loans-money-owed',
            label: t('loansAndMoneyOwed') || 'Loans & money owed',
            icon: 'fas fa-hand-holding-usd',
            isActive: isLoansActive,
            onClick: () => onNavigateFeature(FeatureType.Loans),
            count: counts?.loans,
        },
        {
            id: 'reports',
            label: t('reports') || 'Reports',
            icon: 'fas fa-file-invoice-dollar',
            isActive: isReportsActive,
            onClick: () => onNavigateFeature(FeatureType.Reports),
        },
        {
            id: 'investments',
            label: t('investments') || 'Investments',
            icon: 'fas fa-arrow-trend-up',
            isActive: isInvestmentsActive,
            onClick: () => onNavigateView(ViewType.Investments),
            count: counts?.investments,
        },
        {
            id: 'settings',
            label: t('settings') || 'Settings',
            icon: 'fas fa-cog',
            isActive: isSettingsActive,
            onClick: () => onNavigateView(ViewType.Settings),
        },
    ];

    return (
        <aside 
            id="desktop-sidebar"
            aria-label="Desktop Navigation Rail"
            className="hidden lg:flex flex-col w-64 xl:w-72 fixed top-0 bottom-0 left-0 z-30 bg-white/85 dark:bg-gray-900/85 backdrop-blur-2xl border-r border-gray-200/70 dark:border-gray-800/70 select-none shadow-sm transition-all"
        >
            {/* Wallet Branding Header */}
            <div className="h-20 px-6 flex items-center justify-between border-b border-gray-200/50 dark:border-gray-800/50 flex-shrink-0">
                <button 
                    onClick={() => onNavigateView(ViewType.Dashboard)}
                    className="flex items-center gap-3 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-2xl cursor-pointer"
                    aria-label="Wallet Pro Home"
                >
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                        <i className="fas fa-wallet text-base"></i>
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-black text-base tracking-wider text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                WALLET
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                PRO
                            </span>
                        </div>
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
                            Personal Budget
                        </p>
                    </div>
                </button>
            </div>

            {/* Scrollable Navigation List (8 Clean Items) */}
            <nav aria-label="Main Navigation" className="flex-1 overflow-y-auto px-3.5 py-5 space-y-1 custom-scrollbar">
                {navItems.map((item) => {
                    return (
                        <button
                            key={item.id}
                            onClick={item.onClick}
                            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold tracking-wide transition-all group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                                item.isActive
                                    ? 'bg-gradient-to-r from-purple-500/15 via-indigo-500/10 to-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-500/30 shadow-xs'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
                            }`}
                            aria-current={item.isActive ? 'page' : undefined}
                        >
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-transform group-hover:scale-105 ${
                                    item.isActive 
                                        ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-sm' 
                                        : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400'
                                }`}>
                                    <i className={item.icon}></i>
                                </div>
                                <span className="truncate">{item.label}</span>
                            </div>

                            {item.count !== undefined && item.count > 0 && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    item.isActive
                                        ? 'bg-cyan-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                }`}>
                                    {item.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* AI Assistant Quick Trigger & User Profile Footer */}
            <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50 space-y-2.5 flex-shrink-0 bg-white/40 dark:bg-black/20">
                {onOpenAiAssistant && (
                    <button
                        onClick={onOpenAiAssistant}
                        className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 hover:from-purple-500/20 hover:to-cyan-500/20 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 flex items-center justify-between text-xs font-bold transition-all shadow-xs group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                        aria-label="Open AI Assistant"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-500 to-cyan-400 text-white flex items-center justify-center text-[10px] shadow-sm group-hover:scale-105 transition-transform">
                                <i className="fas fa-robot"></i>
                            </div>
                            <span>Financial AI</span>
                        </div>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-300">
                            Ask
                        </span>
                    </button>
                )}

                {/* Profile Mini Card */}
                <button
                    onClick={() => onNavigateView(ViewType.Settings)}
                    className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-100/80 dark:hover:bg-gray-800/60 transition-colors text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    aria-label="Profile Settings"
                >
                    <div className="w-9 h-9 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                        {userProfile?.avatar ? (
                            <img src={userProfile.avatar} alt="User" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                            <i className="fas fa-user text-gray-400 text-xs"></i>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                            {userProfile?.name || 'Wallet User'}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                            {userProfile?.email || 'Local Account'}
                        </p>
                    </div>
                    <i className="fas fa-chevron-right text-[10px] text-gray-400 group-hover:translate-x-0.5 transition-transform"></i>
                </button>
            </div>
        </aside>
    );
};

export default DesktopSidebar;
