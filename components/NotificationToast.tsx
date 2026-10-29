import React from 'react';

export interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
}

interface NotificationToastProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ toasts, onDismiss }) => {
    if (toasts.length === 0) return null;

    return (
        <aside
            aria-label="Notifications"
            className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none"
        >
            {toasts.map((toast) => {
                const isError = toast.type === 'error';
                const isSuccess = toast.type === 'success';

                return (
                    <div
                        key={toast.id}
                        role={isError ? "alert" : "status"}
                        className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
                            isError
                                ? 'bg-red-950/90 text-red-200 border-red-800/80 shadow-red-950/40'
                                : isSuccess
                                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800/80 shadow-emerald-950/40'
                                : 'bg-slate-900/90 text-slate-200 border-slate-700/80 shadow-slate-950/40'
                        }`}
                    >
                        <span className="mt-0.5 text-lg shrink-0">
                            {isError && <i className="fas fa-exclamation-circle text-red-400" />}
                            {isSuccess && <i className="fas fa-check-circle text-emerald-400" />}
                            {!isError && !isSuccess && <i className="fas fa-info-circle text-sky-400" />}
                        </span>
                        <div className="flex-1 text-sm font-medium leading-snug">
                            {toast.message}
                        </div>
                        <button
                            type="button"
                            onClick={() => onDismiss(toast.id)}
                            className="text-slate-400 hover:text-white transition-colors p-1 -mr-1 -mt-1 rounded-lg"
                            aria-label="Dismiss notification"
                        >
                            <i className="fas fa-times text-xs" />
                        </button>
                    </div>
                );
            })}
        </aside>
    );
};
