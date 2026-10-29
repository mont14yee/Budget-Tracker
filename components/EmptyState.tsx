import React from 'react';

interface EmptyStateProps {
    icon: string;
    title: string;
    message?: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, description, actionLabel, onAction, className = '' }) => {
    const text = description || message || '';
    return (
        <div className={`flex flex-col items-center justify-center py-12 px-4 text-center animate-fadeIn ${className}`}>
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800/80 flex items-center justify-center mb-4 shadow-sm border border-gray-200/60 dark:border-gray-700/60">
                <i className={`${icon} text-2xl text-gray-400 dark:text-gray-500`}></i>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1.5">{title}</h3>
            {text && (
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed mb-4">
                    {text}
                </p>
            )}
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 hover:opacity-95 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none cursor-pointer"
                >
                    <i className="fas fa-plus text-[10px]"></i>
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
