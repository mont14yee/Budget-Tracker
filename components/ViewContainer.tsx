
import React from 'react';

interface ViewContainerProps {
    title: string;
    icon: string;
    actionButton?: React.ReactNode;
    children: React.ReactNode;
    bgColor?: string;
    textColor?: string;
    borderColor?: string;
}

const ViewContainer: React.FC<ViewContainerProps> = ({ title, icon, actionButton, children, bgColor = "bg-transparent", textColor = "text-gray-900 dark:text-gray-100", borderColor = "border-gray-200 dark:border-gray-700/50" }) => {
    return (
        <div className={`bg-white/60 dark:bg-gray-900/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-3xl p-4 sm:p-6 mb-6 animate-fadeIn transition-all duration-500 shadow-sm`}>
            {children}
        </div>
    );
};

export default ViewContainer;

