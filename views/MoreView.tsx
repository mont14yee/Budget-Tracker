import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { FeatureType } from '../types';
import ViewContainer from '../components/ViewContainer';

interface MoreViewProps {
    onSelectFeature: (feature: FeatureType, origin?: { x: number, y: number }) => void;
}

const FeatureCard: React.FC<{
    icon: string;
    title: string;
    description: string;
    onClick: (e: React.MouseEvent) => void;
    iconBg: string;
    iconColor: string;
}> = ({ icon, title, description, onClick, iconBg, iconColor }) => {
    return (
        <button
            onClick={onClick}
            className="group relative text-left w-full p-5 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm hover:shadow-xl dark:hover:shadow-cyan-950/20 transition-all duration-300 transform hover:-translate-y-1 overflow-hidden"
        >
            <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm ${iconBg} ${iconColor}`}>
                    <i className={icon}></i>
                </div>
                <div className="pr-6">
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{description}</p>
                </div>
            </div>
            <div className="absolute top-5 right-5 text-gray-300 dark:text-gray-600 group-hover:text-cyan-500 group-hover:translate-x-1 transition-all">
                <i className="fas fa-chevron-right text-xs"></i>
            </div>
        </button>
    );
};

const MoreView: React.FC<MoreViewProps> = ({ onSelectFeature }) => {
    const { t } = useLanguage();

    const features = [
        {
            type: FeatureType.Savings,
            icon: 'fas fa-piggy-bank',
            title: t('savings') || 'Savings Goals',
            description: t('savingsDescription') || 'Plan and grow your savings targets.',
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
            iconColor: 'text-emerald-600 dark:text-emerald-400'
        },
        {
            type: FeatureType.Loans,
            icon: 'fas fa-hand-holding-usd',
            title: t('loans') || 'Loans & Debts',
            description: t('loansDescription') || 'Track money you owe and money you have lent.',
            iconBg: 'bg-amber-50 dark:bg-amber-950/40',
            iconColor: 'text-amber-600 dark:text-amber-400'
        },
        {
            type: FeatureType.BillsAndPayments,
            icon: 'fas fa-calendar-check',
            title: t('billsAndPayments') || 'Bills & Regular Payments',
            description: t('billsAndPaymentsDescription') || 'Manage subscriptions, scheduled bills, and recurring transfers.',
            iconBg: 'bg-indigo-50 dark:bg-indigo-950/40',
            iconColor: 'text-indigo-600 dark:text-indigo-400'
        },
        {
            type: FeatureType.Reports,
            icon: 'fas fa-file-invoice-dollar',
            title: t('reports') || 'Financial Reports',
            description: t('reportsDescription') || 'Analyze income, outgoings, categories, and export records.',
            iconBg: 'bg-teal-50 dark:bg-teal-950/40',
            iconColor: 'text-teal-600 dark:text-teal-400'
        },
    ];

    return (
        <ViewContainer title={t('more')} icon="fas fa-layer-group">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {features.map(feature => (
                    <FeatureCard
                        key={feature.type}
                        icon={feature.icon}
                        title={feature.title}
                        description={feature.description}
                        iconBg={feature.iconBg}
                        iconColor={feature.iconColor}
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            onSelectFeature(feature.type, {
                                x: rect.left + rect.width / 2,
                                y: rect.top + rect.height / 2
                            });
                        }}
                    />
                ))}
            </div>

            <div className="mt-16 mb-24 flex justify-center w-full">
                <div className="relative p-8 rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] text-center w-full max-w-sm overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-400/5 dark:to-teal-400/5 transition-opacity duration-500 opacity-0 group-hover:opacity-100"></div>
                    
                    <h2 className="relative text-3xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 mb-2 drop-shadow-sm">
                        WALLET
                    </h2>
                    
                    <div className="relative inline-flex items-center px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 mb-6 shadow-sm">
                        <span className="text-[10px] uppercase font-mono font-semibold tracking-widest text-slate-500 dark:text-slate-400">
                            Version 1.0 <span className="text-slate-400 dark:text-slate-500">(Build 2026)</span>
                        </span>
                    </div>
                    
                    <div className="relative flex items-center justify-center gap-3 text-xs tracking-widest uppercase">
                        <span className="h-px w-6 bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-600"></span>
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                            Designed by <span className="font-bold text-slate-800 dark:text-slate-200">Menkir</span>
                        </span>
                        <span className="h-px w-6 bg-gradient-to-l from-transparent to-slate-300 dark:to-slate-600"></span>
                    </div>
                </div>
            </div>
        </ViewContainer>
    );
};

export default MoreView;