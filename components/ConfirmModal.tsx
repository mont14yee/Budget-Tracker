import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export interface ConfirmModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel,
    variant = 'danger',
    onConfirm,
    onCancel,
}) => {
    const { t } = useLanguage();
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        // Focus the cancel button by default for safety on destructive actions
        const timer = setTimeout(() => {
            if (variant === 'danger') {
                cancelButtonRef.current?.focus();
            } else {
                confirmButtonRef.current?.focus();
            }
        }, 50);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onCancel, variant]);

    if (!isOpen) return null;

    const resolvedTitle = title || (variant === 'danger' ? t('delete') : t('confirmAction'));
    const resolvedConfirmLabel = confirmLabel || (variant === 'danger' ? t('delete') : t('confirm'));
    const resolvedCancelLabel = cancelLabel || t('cancel');

    const iconClasses = variant === 'danger'
        ? 'fas fa-trash-alt text-red-500 dark:text-red-400'
        : variant === 'warning'
        ? 'fas fa-exclamation-triangle text-amber-500 dark:text-amber-400'
        : 'fas fa-info-circle text-cyan-500 dark:text-cyan-400';

    const iconBgClasses = variant === 'danger'
        ? 'bg-red-100 dark:bg-red-950/50'
        : variant === 'warning'
        ? 'bg-amber-100 dark:bg-amber-950/50'
        : 'bg-cyan-100 dark:bg-cyan-950/50';

    const confirmBtnClasses = variant === 'danger'
        ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800'
        : 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:opacity-90 active:scale-95 text-white focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800';

    return (
        <div
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            role="presentation"
            onClick={onCancel}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-desc"
                className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm sm:max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700 text-center space-y-4 transition-transform transform scale-100"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`w-14 h-14 rounded-2xl ${iconBgClasses} mx-auto flex items-center justify-center text-2xl shadow-inner`}>
                    <i className={iconClasses}></i>
                </div>

                <div className="space-y-1">
                    <h3 id="confirm-dialog-title" className="text-lg font-bold text-gray-900 dark:text-white">
                        {resolvedTitle}
                    </h3>
                    <p id="confirm-dialog-desc" className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed px-2">
                        {message}
                    </p>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                    <button
                        ref={cancelButtonRef}
                        type="button"
                        onClick={onCancel}
                        className="w-full sm:w-1/2 min-h-[44px] py-2.5 px-4 rounded-2xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:outline-none cursor-pointer"
                    >
                        {resolvedCancelLabel}
                    </button>
                    <button
                        ref={confirmButtonRef}
                        type="button"
                        onClick={() => {
                            onConfirm();
                            onCancel();
                        }}
                        className={`w-full sm:w-1/2 min-h-[44px] py-2.5 px-4 rounded-2xl text-sm font-bold shadow-sm transition-all focus-visible:outline-none cursor-pointer ${confirmBtnClasses}`}
                    >
                        {resolvedConfirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
