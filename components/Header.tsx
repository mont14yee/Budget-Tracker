
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ViewType, FeatureType, UserProfile } from '../types';

interface HeaderProps {
    activeView: ViewType;
    userProfile?: UserProfile;
    onSelectFeature?: (feature: FeatureType, origin?: { x: number, y: number }) => void;
    setActiveView?: (view: ViewType) => void;
    onQuickAction?: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeView, userProfile, onSelectFeature, setActiveView, onQuickAction }) => {
    const { t } = useLanguage();

    const titleText = (activeView === ViewType.Income || activeView === ViewType.Expenses)
        ? (t('incomeAndSpending') || 'Income & Spending')
        : t(activeView);

    if (activeView === ViewType.Dashboard) {
        return (
            <header className="pt-6 sm:pt-8 pb-3 px-4 sm:px-6 relative z-20 bg-transparent flex items-center justify-between">
                <button 
                    onClick={() => setActiveView?.(ViewType.Settings)}
                    className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-2xl group min-h-[44px]"
                    aria-label="Open profile settings"
                >
                    <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white/60 dark:border-gray-700 shadow-sm bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-transform group-hover:scale-105 flex-shrink-0">
                        {userProfile?.avatar ? (
                            <img src={userProfile.avatar} alt="User avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                            <i className="fas fa-user text-gray-400 text-sm"></i>
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[11px] text-gray-400 font-medium tracking-wide truncate">{t('welcome') || 'Welcome'}</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors truncate">{userProfile?.name || 'Wallet User'}</span>
                    </div>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button 
                        onClick={onQuickAction ? onQuickAction : () => setActiveView?.(ViewType.Expenses)}
                        className="h-11 px-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-xs font-bold tracking-wide hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                        aria-label="Add transaction"
                    >
                        <i className="fas fa-plus text-[10px]"></i>
                        <span className="whitespace-nowrap">{t('addNew') || 'Add Entry'}</span>
                    </button>
                    <button 
                        aria-label={t('settings')}
                        onClick={() => setActiveView?.(ViewType.Settings)}
                        className="w-11 h-11 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/60 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-95 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    >
                        <i className="fas fa-cog text-sm"></i>
                    </button>
                </div>
            </header>
        );
    }

    return (
        <header className="pt-6 sm:pt-8 pb-3 px-4 sm:px-6 relative z-20 bg-transparent flex items-center justify-between">
            <button 
                aria-label="Back to dashboard" 
                className="w-11 h-11 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/60 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-95 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" 
                onClick={() => setActiveView?.(ViewType.Dashboard)}
            >
                 <i className="fas fa-chevron-left text-xs"></i>
            </button>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate px-2">{titleText}</h1>
            <button 
                aria-label={t('settings')} 
                onClick={() => setActiveView?.(ViewType.Settings)}
                className="w-11 h-11 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/60 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-95 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
                 <i className="fas fa-cog text-sm"></i>
            </button>
        </header>
    );
};

export default Header;
