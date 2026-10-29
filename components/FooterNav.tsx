import React from 'react';
import { ViewType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface NavItem {
    id: ViewType;
    icon: string;
    labelKey: 'home' | 'income' | 'expenses' | 'more' | 'invest';
}

const NAV_ITEMS: NavItem[] = [
    { id: ViewType.Dashboard, icon: 'fas fa-home', labelKey: 'home' },
    { id: ViewType.Income, icon: 'fas fa-wallet', labelKey: 'income' },
    { id: ViewType.Expenses, icon: 'fas fa-credit-card', labelKey: 'expenses' },
    { id: ViewType.Investments, icon: 'fas fa-chart-line', labelKey: 'invest' },
    { id: ViewType.More, icon: 'fas fa-chart-pie', labelKey: 'more' },
];

interface FooterNavProps {
    activeView: ViewType;
    setActiveView: (view: ViewType) => void;
}

const FooterNav: React.FC<FooterNavProps> = ({ activeView, setActiveView }) => {
    const { t } = useLanguage();
    
    return (
        <div className="fixed bottom-5 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
            <nav className="pointer-events-auto flex items-center justify-between px-2.5 py-2 w-full max-w-md bg-white/85 dark:bg-gray-900/85 backdrop-blur-2xl rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] border border-white/60 dark:border-gray-700/60 transition-all">
                {NAV_ITEMS.map((item) => {
                    const isActive = activeView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={`relative flex items-center justify-center transition-all duration-300 ease-out h-11 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 ${
                                isActive 
                                    ? 'w-auto px-4 bg-gradient-to-r from-purple-500 to-cyan-500 shadow-md shadow-cyan-500/30' 
                                    : 'w-11 hover:bg-gray-100/80 dark:hover:bg-gray-800/80'
                            }`}
                            aria-label={t(item.labelKey)}
                        >
                            <i className={`${item.icon} text-base sm:text-lg transition-colors duration-200 ${
                                isActive ? 'text-white' : 'text-gray-400 dark:text-gray-400'
                            }`}></i>
                            
                            {isActive && (
                                <span className="ml-2 text-xs sm:text-sm font-bold tracking-wide text-white uppercase whitespace-nowrap overflow-hidden max-w-[90px] truncate">
                                    {t(item.labelKey)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default FooterNav;