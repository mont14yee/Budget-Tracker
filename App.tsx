import { addMoney, subtractMoney, multiplyMoney, divideMoney } from './utils/money';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ViewType, Transaction, SavingsGoal, TransactionType, AllTransaction, UserProfile, FeatureType, Loan, LoanType, Repayment, ExtraContribution, Subscription, ScheduledTransaction, Investment, Frequency, ActivityLogEntry } from './types';
import { generateId, getDeviceId, INITIAL_INCOME, INITIAL_EXPENSES, INITIAL_SAVINGS_GOALS, getIncomeCategories, getAllExpenseCategories, getShoppingCategories, INITIAL_LOANS, INITIAL_SUBSCRIPTIONS, INITIAL_SCHEDULED_TRANSACTIONS, INITIAL_INVESTMENTS, parseLocalDate, formatLocalDate } from './constants';
import Header from './components/Header';
import FooterNav from './components/FooterNav';
import DashboardView from './views/DashboardView';
import IncomeView from './views/IncomeView';
import ExpensesView from './views/ExpensesView';
import SavingsView from './views/SavingsView';
import MoreView from './views/MoreView';
import Chatbot from './components/Chatbot';
import { useLanguage } from './contexts/LanguageContext';
import ReportsView from './views/ReportsView';
import SettingsAndAboutView from './views/SettingsAndAboutView';
import LoansView from './views/LoansView';
import BillsAndPaymentsView from './views/BillsAndPaymentsView';
import InvestmentsView from './views/InvestmentsView';
import { DesktopHeader } from './components/DesktopHeader';
import { DesktopSidebar } from './components/DesktopSidebar';
import { DesktopStatusFooter } from './components/DesktopStatusFooter';
import { GlobalQuickAddModal } from './components/GlobalQuickAddModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';

import { useAuth } from './contexts/AuthContext';
import { dbService } from './services/dbService';
import { formatUserErrorMessage } from './services/errors';
import { NotificationToast, ToastMessage } from './components/NotificationToast';
import AuthView from './views/AuthView';
import { buildSafeCsv, downloadCsvFile } from './utils/csvSecurity';

const FullScreenContainer: React.FC<{
    title: string;
    icon: string;
    children: React.ReactNode;
    theme: 'light' | 'dark';
    animationStyle: React.CSSProperties;
    onClose: () => void;
}> = ({ title, icon, children, theme, animationStyle, onClose }) => (
    <div className={`fixed inset-0 z-[100] flex flex-col ${theme === 'dark' ? 'bg-[#0b0f19]' : 'bg-[#fcfdfd]'}`} style={animationStyle}>
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            {theme === 'light' ? (
                <>
                    <div className="absolute -bottom-[15%] -left-[20%] w-[80%] h-[50%] rounded-full bg-[#7dd3fc]/30 blur-[100px]" />
                    <div className="absolute -bottom-[10%] -right-[20%] w-[80%] h-[60%] rounded-full bg-[#d8b4fe]/20 blur-[120px]" />
                </>
            ) : (
                <>
                    <div className="absolute -bottom-[15%] -left-[20%] w-[80%] h-[50%] rounded-full bg-[#0284c7]/15 blur-[120px]" />
                </>
            )}
        </div>
            
        <header className="flex-shrink-0 pt-10 pb-4 px-4 sm:px-6 relative z-10 flex items-center justify-between no-print">
            <button 
                onClick={onClose} 
                className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-white/60 dark:bg-black/40 border border-gray-200/80 dark:border-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 cursor-pointer" 
                aria-label="Back / Close"
            >
                <i className="fas fa-chevron-left text-sm"></i>
            </button>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-gray-900 dark:text-gray-50 flex items-center gap-2 truncate px-2">
                {title}
            </h2>
            <div className="w-11 h-11 flex-shrink-0"></div>
        </header>
        <main className="flex-1 overflow-y-auto relative z-10 px-2 sm:px-4">
            {children}
        </main>
    </div>
);

const App: React.FC = () => {
    const { language, t, currencySettings } = useLanguage();
    const [activeView, setActiveView] = useState<ViewType>(ViewType.Dashboard);
    const [activeFeature, setActiveFeature] = useState<FeatureType | null>(null);
    const [featureOrigin, setFeatureOrigin] = useState<{x: number, y: number} | null>(null);
    
    
    const { user, isLoading: authLoading, signOut } = useAuth();
    const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const [income, setIncome] = useState<Transaction[]>([]);
    const [expenses, setExpenses] = useState<Transaction[]>([]);
    const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [scheduledTransactions, setScheduledTransactions] = useState<ScheduledTransaction[]>([]);
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);


    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const savedTheme = localStorage.getItem('theme');
        return (savedTheme === 'dark' || savedTheme === 'light') ? savedTheme : 'dark';
    });

    useEffect(() => {
        localStorage.setItem('theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
        
        if (user) {
            dbService.updateUserPreferences(user.id, { theme }).catch(e => console.error(e));
        }
    }, [theme, user]);
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [isChatbotOpen, setChatbotOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    // Global keyboard shortcuts (Cmd/Ctrl + K for Search)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
        const id = generateId();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4500);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);


    const loadData = useCallback(async () => {
        if (!user) {
            setAuthReady(false);
            setUserProfileState(null);
            setIncome([]);
            setExpenses([]);
            setSavingsGoals([]);
            setLoans([]);
            setSubscriptions([]);
            setScheduledTransactions([]);
            setInvestments([]);
            setActivityLogs([]);
            return;
        }

        try {
            // Fetch preferences (e.g. theme) from local database
            try {
                const prefs = await dbService.getUserPreferences(user.id);
                if (prefs?.theme && (prefs.theme === 'light' || prefs.theme === 'dark')) {
                    setTheme(prefs.theme);
                }
            } catch (prefErr) {
                console.warn('Preferences initialization note:', prefErr);
            }

            // Fetch profile or bootstrap fallback from auth user metadata
            try {
                const prof = await dbService.getProfile(user.id);
                if (prof && prof.name) {
                    setUserProfileState({
                        name: prof.name,
                        avatar: prof.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
                        email: user.email || '',
                    });
                } else {
                    const fallbackName = user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'User');
                    const fallbackAvatar = user.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80';
                    const newProfile: UserProfile = {
                        name: fallbackName,
                        avatar: fallbackAvatar,
                        email: user.email || '',
                    };
                    await dbService.updateProfile(user.id, newProfile);
                    setUserProfileState(newProfile);
                }
            } catch (profErr) {
                console.warn('Profile initialization note:', profErr);
                setUserProfileState({
                    name: user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'User'),
                    avatar: user.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
                    email: user.email || '',
                });
            }

            const [inc, exp, goals, lns, subs, scheds, invs, acts] = await Promise.all([
                dbService.getIncome(user.id),
                dbService.getExpenses(user.id),
                dbService.getSavingsGoals(user.id),
                dbService.getLoans(user.id),
                dbService.getSubscriptions(user.id),
                dbService.getScheduledTransactions(user.id),
                dbService.getInvestments(user.id),
                dbService.getActivityLogs(user.id),
            ]);

            setIncome(inc);
            setExpenses(exp);
            setSavingsGoals(goals);
            setLoans(lns);
            setSubscriptions(subs);
            setScheduledTransactions(scheds);
            setInvestments(invs);
            setActivityLogs(acts);
        } catch (err) {
            console.error("Error loading data:", err);
        } finally {
            setAuthReady(true);
        }
    }, [user]);

    const refreshActivities = useCallback(async () => {
        if (!user) return;
        try {
            const acts = await dbService.getActivityLogs(user.id);
            setActivityLogs(acts);
        } catch (e) {
            console.error('Failed to refresh activities:', e);
        }
    }, [user]);


    useEffect(() => {
        loadData();
    }, [loadData]);

    const setUserProfile = async (profile: UserProfile) => {
        setUserProfileState(profile);
        if (user) {
            try {
                await dbService.updateProfile(user.id, profile);
            } catch (e) {
                console.error('Failed to update profile:', e);
            }
        }
    };
    const [incomeCategories, setIncomeCategories] = useState<string[]>(getIncomeCategories(language));
    const [allExpenseCategories, setAllExpenseCategories] = useState<string[]>(getAllExpenseCategories(language));
    const [shoppingCategories, setShoppingCategories] = useState<string[]>(getShoppingCategories(language));

    useEffect(() => {
        setIncomeCategories(getIncomeCategories(language));
        setAllExpenseCategories(getAllExpenseCategories(language));
        setShoppingCategories(getShoppingCategories(language));
    }, [language]);









    useEffect(() => {
        // Clear category filter when navigating away from transaction lists
        if (activeView !== ViewType.Expenses && activeView !== ViewType.Income) {
            setCategoryFilter(null);
        }
    }, [activeView]);


    const allTransactions: AllTransaction[] = useMemo(() => {
        const incomeWithType = income.map(t => ({ ...t, type: TransactionType.Income as const }));
        const expensesWithType = expenses.map(t => ({
          ...t,
          type: shoppingCategories.includes(t.category) ? TransactionType.Shopping : TransactionType.Expense,
        }));
        return [...incomeWithType, ...expensesWithType];
    }, [income, expenses, shoppingCategories]);

    const totalIncome = useMemo(() => income.reduce((sum, item) => addMoney(sum, item.amount), 0), [income]);
    const totalExpenses = useMemo(() => expenses.reduce((sum, item) => addMoney(sum, item.amount), 0), [expenses]);
    const netAmount = useMemo(() => subtractMoney(totalIncome, totalExpenses), [totalIncome, totalExpenses]);

    const totalAssetsLent = useMemo(() => loans.filter(l => l.type === LoanType.Lent).reduce((sum, item) => addMoney(sum, item.outstandingAmount), 0), [loans]);
    const totalLiabilitiesBorrowed = useMemo(() => loans.filter(l => l.type === LoanType.Borrowed).reduce((sum, item) => addMoney(sum, item.outstandingAmount), 0), [loans]);
    const investmentsValue = useMemo(() => investments.reduce((sum, inv) => addMoney(sum, multiplyMoney(inv.currentPrice, inv.quantity)), 0), [investments]);
    
    // Net Worth Calculation
    const totalAssets = useMemo(() => {
        // Cash Balance + Loans Lent + Investments Value
        const cashBalance = Math.max(0, netAmount); // Only count positive cash as asset
        return addMoney(cashBalance, totalAssetsLent, investmentsValue);
    }, [netAmount, totalAssetsLent, investmentsValue]);

    const totalLiabilities = useMemo(() => {
        const negativeCash = netAmount < 0 ? Math.abs(netAmount) : 0;
        return addMoney(totalLiabilitiesBorrowed, negativeCash);
    }, [totalLiabilitiesBorrowed, netAmount]);
    
    const netWorth = useMemo(() => subtractMoney(totalAssets, totalLiabilities), [totalAssets, totalLiabilities]);


    const allTransactionsForExport = useMemo(() => {
        return [
            ...income.map(tx => ({...tx, type: t('income')})),
            ...expenses.map(tx => ({...tx, type: t('expense')})),
        ].sort((a,b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
    }, [income, expenses, t]);
    
    const exportToCSV = () => {
        const data = allTransactionsForExport;
        const filename = `wallet_transactions_${new Date().toISOString().split('T')[0]}.csv`;
        if (!data || data.length === 0) {
            showToast('info', t('noDataToExport') || 'No data to export.');
            return;
        }

        const headers = [
            t('csvType'), 
            t('csvDate'), 
            t('csvName'), 
            t('csvCategory'), 
            `${t('csvAmount')} (${currencySettings.symbol})`
        ];
        
        const rows = data.map(item => [
            item.type,
            item.date,
            item.name,
            item.category,
            Number(item.amount).toFixed(currencySettings.decimalPlaces ?? 2),
        ]);

        const csvString = buildSafeCsv(headers, rows);
        downloadCsvFile(csvString, filename);
        showToast('success', `${t('exportCSV')}: ${filename}`);
    };

    const addTransaction = useCallback(async (type: TransactionType, item: Omit<Transaction, 'id'>) => {
        if (!user) return;
        if (isNaN(item.amount) || item.amount <= 0) {
            showToast('error', (t as any)('invalidAmount') || 'Please enter a valid amount greater than zero.');
            return;
        }
        if (!item.date || isNaN(new Date(item.date).getTime())) {
            showToast('error', (t as any)('invalidDate') || 'Please enter a valid date.');
            return;
        }
        
        try {
            if (type === TransactionType.Income) {
                const added = await dbService.addIncome(user.id, item);
                setIncome(prev => [added, ...prev]);
                showToast('success', `${t('income') || 'Income'} recorded successfully.`);
            } else {
                const added = await dbService.addExpense(user.id, item);
                setExpenses(prev => [added, ...prev]);
                showToast('success', `${t('expense') || 'Expense'} recorded successfully.`);
            }
            refreshActivities();
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to save transaction.'));
        }
    }, [user, showToast, t, refreshActivities]);

    const deleteTransaction = useCallback(async (type: TransactionType, id: string) => {
        if (!user) return;
        try {
            if (type === TransactionType.Income) {
                await dbService.deleteIncome(user.id, id);
                setIncome(prev => prev.filter(i => i.id !== id));
            } else {
                await dbService.deleteExpense(user.id, id);
                setExpenses(prev => prev.filter(i => i.id !== id));
            }
            refreshActivities();
            showToast('info', t('transactionDeleted') || 'Transaction deleted.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to delete transaction.'));
        }
    }, [user, showToast, t, refreshActivities]);

    const updateTransaction = useCallback(async (
        targetType: TransactionType,
        item: Transaction,
        originalType?: TransactionType
    ) => {
        if (!user) return;
        if (isNaN(item.amount) || item.amount <= 0) {
            showToast('error', (t as any)('invalidAmount') || 'Please enter a valid amount greater than zero.');
            return;
        }
        if (!item.date || isNaN(new Date(item.date).getTime())) {
            showToast('error', (t as any)('invalidDate') || 'Please enter a valid date.');
            return;
        }
        if (!item.name.trim()) {
            showToast('error', 'Please enter a description for the transaction.');
            return;
        }

        try {
            const actualOriginalType = originalType || targetType;
            if (actualOriginalType !== targetType) {
                // Type converted (e.g. from Income to Expense or vice-versa)
                if (actualOriginalType === TransactionType.Income) {
                    await dbService.deleteIncome(user.id, item.id);
                    setIncome(prev => prev.filter(i => i.id !== item.id));
                    const added = await dbService.addExpense(user.id, {
                        ...item,
                        id: item.id
                    });
                    setExpenses(prev => [added, ...prev]);
                } else {
                    await dbService.deleteExpense(user.id, item.id);
                    setExpenses(prev => prev.filter(e => e.id !== item.id));
                    const added = await dbService.addIncome(user.id, {
                        ...item,
                        id: item.id
                    });
                    setIncome(prev => [added, ...prev]);
                }
            } else {
                if (targetType === TransactionType.Income) {
                    const updated = await dbService.updateIncome(user.id, item);
                    setIncome(prev => prev.map(i => i.id === updated.id ? updated : i));
                } else {
                    const updated = await dbService.updateExpense(user.id, item);
                    setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
                }
            }
            refreshActivities();
            showToast('success', t('transactionUpdated') || 'Transaction updated successfully.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to update transaction.'));
        }
    }, [user, showToast, t, refreshActivities]);

    const addSavingsGoal = useCallback(async (item: Omit<SavingsGoal, 'id' | 'extraContributions'>) => {
        if (!user) return;
        if (isNaN(item.targetAmount) || item.targetAmount <= 0) {
            showToast('error', 'Target amount must be greater than zero.');
            return;
        }
        if (isNaN(item.startingBalance) || item.startingBalance < 0) {
            showToast('error', 'Starting balance cannot be negative.');
            return;
        }
        if (isNaN(item.monthlyContribution) || item.monthlyContribution < 0) {
            showToast('error', 'Monthly contribution cannot be negative.');
            return;
        }
        if (isNaN(item.interestRate) || item.interestRate < 0) {
            showToast('error', 'Interest rate cannot be negative.');
            return;
        }
        if (!item.deadline || isNaN(new Date(item.deadline).getTime())) {
            showToast('error', 'Please provide a valid deadline date.');
            return;
        }

        try {
            const added = await dbService.addSavingsGoal(user.id, item);
            setSavingsGoals(prev => [added, ...prev]);
            refreshActivities();
            showToast('success', 'Savings goal created.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to save savings goal.'));
        }
    }, [user, showToast, refreshActivities]);

    const updateSavingsGoal = useCallback(async (updatedItem: SavingsGoal) => {
        if (!user) return;
        if (isNaN(updatedItem.targetAmount) || updatedItem.targetAmount <= 0) {
            showToast('error', 'Target amount must be greater than zero.');
            return;
        }
        if (isNaN(updatedItem.startingBalance) || updatedItem.startingBalance < 0) {
            showToast('error', 'Starting balance cannot be negative.');
            return;
        }
        if (!updatedItem.deadline || isNaN(new Date(updatedItem.deadline).getTime())) {
            showToast('error', 'Please provide a valid deadline date.');
            return;
        }

        try {
            await dbService.updateSavingsGoal(user.id, updatedItem);
            setSavingsGoals(prev => prev.map(g => g.id === updatedItem.id ? updatedItem : g));
            refreshActivities();
            showToast('success', 'Savings goal updated.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to update savings goal.'));
        }
    }, [user, showToast, refreshActivities]);

    const deleteSavingsGoal = useCallback(async (id: string) => {
        if (!user) return;
        try {
            await dbService.deleteSavingsGoal(user.id, id);
            setSavingsGoals(prev => prev.filter(g => g.id !== id));
            refreshActivities();
            showToast('info', 'Savings goal deleted.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to delete savings goal.'));
        }
    }, [user, showToast, refreshActivities]);
    
    const addExtraContribution = useCallback(async (goalId: string, contribution: Omit<ExtraContribution, 'id'>) => {
        if (!user) return;
        if (isNaN(contribution.amount) || contribution.amount <= 0) {
            showToast('error', 'Contribution amount must be greater than zero.');
            return;
        }
        if (!contribution.date || isNaN(new Date(contribution.date).getTime())) {
            showToast('error', 'Please provide a valid contribution date.');
            return;
        }
        try {
            const addedContribution = await dbService.addExtraContribution(user.id, goalId, contribution);
            setSavingsGoals(prev => prev.map(g => {
                if (g.id !== goalId) return g;
                return {
                    ...g,
                    extraContributions: [addedContribution, ...(g.extraContributions || [])],
                };
            }));
            refreshActivities();
            showToast('success', 'Contribution added successfully.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to record contribution.'));
        }
    }, [user, showToast, refreshActivities]);

    const addIncomeCategory = useCallback((category: string) => {
        if (!incomeCategories.includes(category)) {
            setIncomeCategories(prev => [...prev, category]);
        }
    }, [incomeCategories]);

    const addLoan = useCallback(async (item: Omit<Loan, 'id' | 'repayments' | 'outstandingAmount'>) => {
        if (!user) return;
        if (isNaN(item.totalAmount) || item.totalAmount <= 0) {
            showToast('error', 'Loan amount must be greater than zero.');
            return;
        }
        if (isNaN(item.interestRate) || item.interestRate < 0) {
            showToast('error', 'Interest rate cannot be negative.');
            return;
        }
        if (!item.date || isNaN(new Date(item.date).getTime())) {
            showToast('error', 'Please provide a valid loan start date.');
            return;
        }
        if (!item.dueDate || isNaN(new Date(item.dueDate).getTime())) {
            showToast('error', 'Please provide a valid due date.');
            return;
        }
        
        try {
            const txName = item.type === LoanType.Lent
                ? `${t('loanTo') || 'Loan to'} ${item.person}`
                : `${t('loanFrom') || 'Loan from'} ${item.person}`;
            
            const result = await dbService.recordLoanDisbursement(user.id, item, txName);
            setLoans(prev => [result.loan, ...prev]);
            
            if (result.transaction) {
                const tx = result.transaction;
                if (item.type === LoanType.Lent) {
                    setExpenses(prev => [tx, ...prev]);
                } else {
                    setIncome(prev => [tx, ...prev]);
                }
            }
            refreshActivities();
            showToast('success', 'Loan created and cash flow updated.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to create loan.'));
        }
    }, [user, showToast, t, refreshActivities]);

    const deleteLoan = useCallback(async (id: string) => {
        if (!user) return;
        try {
            await dbService.deleteLoan(user.id, id);
            setLoans(prev => prev.filter(l => l.id !== id));
            refreshActivities();
            showToast('info', 'Loan deleted.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to delete loan.'));
        }
    }, [user, showToast, refreshActivities]);

    const addRepaymentToLoan = useCallback(async (loanId: string, repayment: Omit<Repayment, 'id'>) => {
        if (!user) return;
        if (isNaN(repayment.amount) || repayment.amount <= 0) {
            showToast('error', 'Repayment amount must be greater than zero.');
            return;
        }
        if (!repayment.date || isNaN(new Date(repayment.date).getTime())) {
            showToast('error', 'Please provide a valid repayment date.');
            return;
        }
        
        const targetLoan = loans.find(l => l.id === loanId);
        if (!targetLoan) return;

        if (targetLoan.outstandingAmount <= 0) {
            showToast('error', 'This loan is already fully repaid.');
            return;
        }
        if (repayment.amount > targetLoan.outstandingAmount) {
            showToast('error', `Repayment cannot exceed the outstanding balance of ${targetLoan.outstandingAmount.toFixed(2)}.`);
            return;
        }

        try {
            const txName = targetLoan.type === LoanType.Lent
                ? `${t('repaymentFrom') || 'Repayment from'} ${targetLoan.person}`
                : `${t('paymentTo') || 'Payment to'} ${targetLoan.person}`;

            const result = await dbService.recordLoanRepayment(user.id, loanId, repayment, txName);

            setLoans(prev => prev.map(l => {
                if (l.id !== loanId) return l;
                return {
                    ...result.loan,
                    repayments: [result.repayment, ...(l.repayments || [])],
                };
            }));

            if (result.transaction) {
                const tx = result.transaction;
                if (targetLoan.type === LoanType.Lent) {
                    setIncome(prev => [tx, ...prev]);
                } else {
                    setExpenses(prev => [tx, ...prev]);
                }
            }
            refreshActivities();
            showToast('success', 'Repayment recorded and balance updated.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to record repayment.'));
        }
    }, [user, loans, showToast, t, refreshActivities]);

    const addSubscription = useCallback(async (item: Omit<Subscription, 'id'>) => {
        if (!user) return;
        if (isNaN(item.amount) || item.amount < 0) {
            showToast('error', 'Subscription amount cannot be negative.');
            return;
        }
        if (!item.renewalDate || isNaN(new Date(item.renewalDate).getTime())) {
            showToast('error', 'Please provide a valid renewal date.');
            return;
        }
        if (!Object.values(Frequency).includes(item.frequency as Frequency)) {
            showToast('error', 'Please select a valid billing frequency.');
            return;
        }
        
        try {
            const added = await dbService.addSubscription(user.id, item);
            setSubscriptions(prev => [added, ...prev]);
            refreshActivities();
            showToast('success', 'Subscription added.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to add subscription.'));
        }
    }, [user, showToast, refreshActivities]);

    const updateSubscription = useCallback(async (updatedItem: Subscription) => {
        if (!user) return;
        try {
            await dbService.updateSubscription(user.id, updatedItem);
            setSubscriptions(prev => prev.map(s => s.id === updatedItem.id ? updatedItem : s));
            refreshActivities();
            showToast('success', 'Subscription updated.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to update subscription.'));
        }
    }, [user, showToast, refreshActivities]);

    const deleteSubscription = useCallback(async (id: string) => {
        if (!user) return;
        try {
            await dbService.deleteSubscription(user.id, id);
            setSubscriptions(prev => prev.filter(s => s.id !== id));
            refreshActivities();
            showToast('info', 'Subscription removed.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to delete subscription.'));
        }
    }, [user, showToast, refreshActivities]);

    const addScheduledTransaction = useCallback(async (item: Omit<ScheduledTransaction, 'id'>) => {
        if (!user) return;
        if (isNaN(item.amount) || item.amount < 0) {
            showToast('error', 'Amount cannot be negative.');
            return;
        }
        if (!item.startDate || isNaN(new Date(item.startDate).getTime())) {
            showToast('error', 'Please provide a valid start date.');
            return;
        }
        if (!Object.values(Frequency).includes(item.frequency as Frequency)) {
            showToast('error', 'Please select a valid recurrence frequency.');
            return;
        }
        
        try {
            const added = await dbService.addScheduledTransaction(user.id, item);
            setScheduledTransactions(prev => [added, ...prev]);
            refreshActivities();
            showToast('success', 'Scheduled transaction created.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to schedule transaction.'));
        }
    }, [user, showToast, refreshActivities]);

    const updateScheduledTransaction = useCallback(async (updatedItem: ScheduledTransaction) => {
        if (!user) return;
        try {
            await dbService.updateScheduledTransaction(user.id, updatedItem);
            setScheduledTransactions(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
            refreshActivities();
            showToast('success', 'Scheduled transaction updated.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to update scheduled transaction.'));
        }
    }, [user, showToast, refreshActivities]);

    const deleteScheduledTransaction = useCallback(async (id: string) => {
        if (!user) return;
        try {
            await dbService.deleteScheduledTransaction(user.id, id);
            setScheduledTransactions(prev => prev.filter(s => s.id !== id));
            refreshActivities();
            showToast('info', 'Scheduled transaction deleted.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to delete scheduled transaction.'));
        }
    }, [user, showToast, refreshActivities]);
    
    const addInvestment = useCallback(async (item: Omit<Investment, 'id'>) => {
        if (!user) return;
        if (isNaN(item.quantity) || item.quantity <= 0) {
            showToast('error', 'Quantity must be greater than zero.');
            return;
        }
        if (isNaN(item.purchasePrice) || item.purchasePrice < 0) {
            showToast('error', 'Purchase price cannot be negative.');
            return;
        }
        if (isNaN(item.currentPrice) || item.currentPrice < 0) {
            showToast('error', 'Current price cannot be negative.');
            return;
        }
        if (!item.purchaseDate || isNaN(new Date(item.purchaseDate).getTime())) {
            showToast('error', 'Please provide a valid purchase date.');
            return;
        }
        
        try {
            const categoryName = t('investmentPurchaseCategory') || 'Investment Purchase';
            const result = await dbService.recordInvestmentPurchase(user.id, item, categoryName);
            setInvestments(prev => [result.investment, ...prev]);
            if (result.transaction) {
                const tx = result.transaction;
                setExpenses(prev => [tx, ...prev]);
            }
            refreshActivities();
            showToast('success', 'Investment purchased and cash outflow recorded.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to record investment purchase.'));
        }
    }, [user, showToast, t, refreshActivities]);

    const updateInvestment = useCallback(async (updatedItem: Investment) => {
        if (!user) return;
        if (isNaN(updatedItem.quantity) || updatedItem.quantity <= 0) {
            showToast('error', 'Quantity must be greater than zero.');
            return;
        }
        if (isNaN(updatedItem.currentPrice) || updatedItem.currentPrice < 0) {
            showToast('error', 'Current price cannot be negative.');
            return;
        }
        if (isNaN(updatedItem.purchasePrice) || updatedItem.purchasePrice < 0) {
            showToast('error', 'Purchase price cannot be negative.');
            return;
        }
        try {
            await dbService.updateInvestment(user.id, updatedItem);
            setInvestments(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
            refreshActivities();
            showToast('success', 'Investment updated.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to update investment.'));
        }
    }, [user, showToast, refreshActivities]);

    const sellInvestment = useCallback(async (id: string, quantityToSell?: number, salePrice?: number) => {
        if (!user) return;
        const investmentToSell = investments.find(inv => inv.id === id);
        if (!investmentToSell) return;

        try {
            const categoryName = t('investmentSaleCategory') || 'Investment Sale';
            const result = await dbService.recordInvestmentSale(
                user.id,
                id,
                quantityToSell,
                salePrice,
                formatLocalDate(new Date()),
                categoryName
            );

            if (result.remainingQuantity <= 0) {
                setInvestments(prev => prev.filter(i => i.id !== id));
            } else {
                setInvestments(prev => prev.map(i => i.id === id ? { ...i, quantity: result.remainingQuantity } : i));
            }

            setIncome(prev => [result.transaction, ...prev]);
            const gainText = result.realizedGainLoss >= 0 ? `+${result.realizedGainLoss.toFixed(2)}` : result.realizedGainLoss.toFixed(2);
            refreshActivities();
            showToast('success', `Sold investment: Proceeds ${result.saleProceeds.toFixed(2)} (Gain/Loss: ${gainText}).`);
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to sell investment.'));
        }
    }, [user, investments, showToast, t, refreshActivities]);

    const deleteInvestment = useCallback(async (id: string) => {
        if (!user) return;
        try {
            await dbService.deleteInvestment(user.id, id);
            setInvestments(prev => prev.filter(i => i.id !== id));
            refreshActivities();
            showToast('info', 'Investment removed.');
        } catch(e) {
            console.error(e);
            showToast('error', formatUserErrorMessage(e, 'Failed to delete investment.'));
        }
    }, [user, showToast, refreshActivities]);

    const renderView = () => {
        const filteredIncome = categoryFilter ? income.filter(i => i.category === categoryFilter) : income;
        const filteredExpenses = categoryFilter ? expenses.filter(e => e.category === categoryFilter) : expenses;

        switch (activeView) {
            case ViewType.Dashboard:
                return <DashboardView 
                            theme={theme}
                            income={totalIncome} 
                            expenses={totalExpenses} 
                            netAmount={netAmount} 
                            allIncome={income}
                            allExpenses={expenses} 
                            setActiveView={setActiveView}
                            setCategoryFilter={setCategoryFilter}
                            exportToCSV={exportToCSV}
                            assets={totalAssets} 
                            netWorth={netWorth}
                            liabilities={totalLiabilities}
                            savingsGoals={savingsGoals}
                            scheduledTransactions={scheduledTransactions}
                            subscriptions={subscriptions}
                            investments={investments}
                            loans={loans}
                            userProfile={userProfile}
                            onUpdateProfile={setUserProfile}
                            onSelectFeature={(feat) => setActiveFeature(feat)}
                            onQuickAction={() => setIsQuickAddOpen(true)}
                        />;
            case ViewType.Income:
                return <IncomeView 
                            items={filteredIncome} 
                            allItems={income}
                            total={totalIncome} 
                            addIncome={(item: Omit<Transaction, 'id'>) => addTransaction(TransactionType.Income, item)} 
                            deleteIncome={(id: string) => deleteTransaction(TransactionType.Income, id)}
                            updateIncome={(item: Transaction, originalType?: TransactionType) => updateTransaction(TransactionType.Income, item, originalType)}
                            categoryFilter={categoryFilter}
                            onClearFilter={() => setCategoryFilter(null)}
                            categories={incomeCategories}
                            expenseCategories={allExpenseCategories}
                            allIncome={income}
                            allExpenses={expenses}
                            onAddTransaction={addTransaction}
                            onUpdateTransaction={updateTransaction}
                            onDeleteTransaction={deleteTransaction}
                            addCategory={addIncomeCategory}
                            theme={theme}
                        />;
            case ViewType.Expenses:
                return <ExpensesView 
                            items={filteredExpenses} 
                            allItems={expenses}
                            total={totalExpenses} 
                            addExpense={(item: Omit<Transaction, 'id'>) => addTransaction(TransactionType.Expense, item)} 
                            deleteExpense={(id: string) => deleteTransaction(TransactionType.Expense, id)}
                            updateExpense={(item: Transaction, originalType?: TransactionType) => updateTransaction(TransactionType.Expense, item, originalType)}
                            categoryFilter={categoryFilter}
                            onClearFilter={() => setCategoryFilter(null)}
                            expenseCategories={allExpenseCategories}
                            incomeCategories={incomeCategories}
                            allIncome={income}
                            allExpenses={expenses}
                            onAddTransaction={addTransaction}
                            onUpdateTransaction={updateTransaction}
                            onDeleteTransaction={deleteTransaction}
                            theme={theme}
                        />;
            case ViewType.More:
                return <MoreView onSelectFeature={(feature: FeatureType, origin?: { x: number; y: number; }) => {
                    setFeatureOrigin(origin || null);
                    setActiveFeature(feature);
                }} />;
            case ViewType.Investments:
                 return <div className="min-h-screen pt-4 pb-24"><InvestmentsView
                        investments={investments}
                        addInvestment={addInvestment}
                        updateInvestment={updateInvestment}
                        sellInvestment={sellInvestment}
                        deleteInvestment={deleteInvestment}
                        income={income}
                        expenses={expenses}
                    /></div>;
            case ViewType.Settings:
                 return (
                    <div className="min-h-screen pt-4">
                        <SettingsAndAboutView
                            theme={theme}
                            setTheme={setTheme}
                            userProfile={userProfile}
                            setUserProfile={setUserProfile}
                            allIncome={income}
                            allExpenses={expenses}
                            savingsGoals={savingsGoals}
                            loans={loans}
                            subscriptions={subscriptions}
                            scheduledTransactions={scheduledTransactions}
                            investments={investments}
                            onDataReload={loadData}
                            showToast={showToast}
                        />
                    </div>
                 );
            default:
                return <DashboardView 
                            theme={theme}
                            income={totalIncome} 
                            expenses={totalExpenses} 
                            netAmount={netAmount} 
                            allIncome={income}
                            allExpenses={expenses} 
                            setActiveView={setActiveView}
                            setCategoryFilter={setCategoryFilter}
                            exportToCSV={exportToCSV}
                            assets={totalAssets} 
                            netWorth={netWorth}
                            liabilities={totalLiabilities}
                            savingsGoals={savingsGoals}
                            scheduledTransactions={scheduledTransactions}
                            investments={investments}
                            loans={loans}
                            onSelectFeature={(feat) => setActiveFeature(feat)}
                            onQuickAction={() => setIsQuickAddOpen(true)}
                        />;
        }
    };

    const renderFeatureInner = (feature: FeatureType) => {
        switch (feature) {
            case FeatureType.Savings:
                return (
                    <SavingsView 
                        items={savingsGoals} 
                        addSavingsGoal={addSavingsGoal} 
                        updateSavingsGoal={updateSavingsGoal}
                        deleteSavingsGoal={deleteSavingsGoal}
                        addExtraContribution={addExtraContribution}
                        netBalance={netAmount}
                        theme={theme}
                    />
                );
            case FeatureType.Loans:
                return (
                    <LoansView
                        loans={loans}
                        addLoan={addLoan}
                        deleteLoan={deleteLoan}
                        addRepayment={addRepaymentToLoan}
                    />
                );
            case FeatureType.BillsAndPayments:
                return (
                    <BillsAndPaymentsView
                        subscriptions={subscriptions}
                        scheduled={scheduledTransactions}
                        allTransactions={allTransactions}
                        addSubscription={addSubscription}
                        updateSubscription={updateSubscription}
                        deleteSubscription={deleteSubscription}
                        addScheduled={addScheduledTransaction}
                        updateScheduled={updateScheduledTransaction}
                        deleteScheduled={deleteScheduledTransaction}
                        logTransaction={addTransaction}
                        expenseCategories={allExpenseCategories}
                        incomeCategories={incomeCategories}
                        theme={theme}
                    />
                );
            case FeatureType.Reports:
                return (
                    <ReportsView
                        userProfile={userProfile}
                        allTransactions={allTransactions}
                        savingsGoals={savingsGoals}
                        incomeCategories={incomeCategories}
                        expenseCategories={allExpenseCategories}
                        shoppingCategories={shoppingCategories}
                    />
                );
            default:
                return null;
        }
    };

    const renderFeatureView = () => {
        if (!activeFeature) return null;
    
        const animationStyle: React.CSSProperties = featureOrigin ? {
             '--origin-x': `${featureOrigin.x}px`,
             '--origin-y': `${featureOrigin.y}px`,
             animation: 'clipReveal 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards'
        } as React.CSSProperties : {
             animation: 'fadeIn 0.2s ease-out forwards'
        };

        const featureInfo = (() => {
            switch (activeFeature) {
                case FeatureType.Savings: return { title: t('savings') || 'Savings Goals', icon: 'fas fa-piggy-bank' };
                case FeatureType.Loans: return { title: t('loans') || 'Loans & Debts', icon: 'fas fa-hand-holding-usd' };
                case FeatureType.BillsAndPayments: return { title: t('billsAndPayments') || 'Bills & Regular Payments', icon: 'fas fa-calendar-check' };
                case FeatureType.Reports: return { title: t('reports') || 'Financial Reports', icon: 'fas fa-file-invoice-dollar' };
                default: return { title: '', icon: '' };
            }
        })();

        return (
            <FullScreenContainer 
                theme={theme} 
                animationStyle={animationStyle} 
                onClose={() => setActiveFeature(null)} 
                title={featureInfo.title} 
                icon={featureInfo.icon}
            >
                {renderFeatureInner(activeFeature)}
            </FullScreenContainer>
        );
    };

    if (authLoading) return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'dark bg-[#0b0f19] text-white' : 'bg-[#fcfdfd] text-gray-900'}`}>
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                {theme === 'light' ? (
                    <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-[#7dd3fc]/40 blur-[100px]" />
                ) : (
                    <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-[#0284c7]/20 blur-[120px]" />
                )}
            </div>
            <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-800 border-t-cyan-500 rounded-full animate-spin"></div>
                <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse tracking-wide uppercase text-xs">
                    {t('loadingSecureEnvironment') || 'Loading Secure Environment'}
                </p>
            </div>
        </div>
    );

    if (!user) return <AuthView theme={theme} />;

    if (!authReady) return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'dark bg-[#0b0f19] text-white' : 'bg-[#fcfdfd] text-gray-900'}`}>
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                {theme === 'light' ? (
                    <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-[#7dd3fc]/40 blur-[100px]" />
                ) : (
                    <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-[#0284c7]/20 blur-[120px]" />
                )}
            </div>
            <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-800 border-t-cyan-500 rounded-full animate-spin"></div>
                <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse tracking-wide uppercase text-xs">
                    {t('decryptingFinancialData') || 'Decrypting Financial Data'}
                </p>
            </div>
        </div>
    );

    if (!userProfile) {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'dark bg-[#0b0f19] text-white' : 'bg-[#fcfdfd] text-gray-900'}`}>
                <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                    {theme === 'light' ? (
                        <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-[#7dd3fc]/40 blur-[100px]" />
                    ) : (
                        <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-[#0284c7]/20 blur-[120px]" />
                    )}
                </div>
                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-800 border-t-cyan-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse tracking-wide uppercase text-xs">
                        {t('preparingProfile') || 'Preparing Profile'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen pb-24 lg:pb-0 px-0 relative font-sans transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0b0f19] text-gray-100' : 'bg-[#fcfdfd] text-gray-900'}`}>
            {/* Premium Background Elements */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                {theme === 'light' ? (
                    <>
                        <div className="absolute -bottom-[15%] -left-[20%] w-[80%] h-[50%] rounded-full bg-[#7dd3fc]/40 blur-[100px]" />
                        <div className="absolute -bottom-[10%] -right-[20%] w-[80%] h-[60%] rounded-full bg-[#d8b4fe]/30 blur-[120px]" />
                        <div className="absolute top-[5%] right-[0%] w-[40%] h-[30%] rounded-full bg-[#a5f3fc]/20 blur-[90px]" />
                    </>
                ) : (
                    <>
                        <div className="absolute -bottom-[15%] -left-[20%] w-[80%] h-[50%] rounded-full bg-[#0284c7]/20 blur-[120px]" />
                        <div className="absolute -bottom-[10%] -right-[20%] w-[80%] h-[60%] rounded-full bg-[#a21caf]/15 blur-[120px]" />
                    </>
                )}
            </div>

            {/* MOBILE & TABLET LAYOUT (< lg) */}
            <div className="lg:hidden">
                <div className="w-full relative z-10 max-w-xl mx-auto shadow-2xl shadow-gray-200/50 dark:shadow-black/50 min-h-screen bg-white/40 dark:bg-black/20 backdrop-blur-3xl overflow-hidden sm:rounded-3xl sm:my-4 sm:border sm:border-white/20 dark:sm:border-white/5">
                    <Header 
                        activeView={activeView} 
                        userProfile={userProfile}
                        setActiveView={setActiveView}
                        onQuickAction={() => setIsQuickAddOpen(true)}
                        onSelectFeature={(feature: FeatureType, origin?: { x: number; y: number; }) => {
                            setFeatureOrigin(origin || null);
                            setActiveFeature(feature);
                        }}
                    />
                    <main className="px-2">
                        {renderView()}
                    </main>
                </div>
                <FooterNav activeView={activeView} setActiveView={setActiveView} />
                {renderFeatureView()}
            </div>

            {/* DESKTOP PROFESSIONAL WORKSPACE LAYOUT (>= lg) */}
            <div className="hidden lg:flex w-full min-h-screen relative z-10">
                {/* Fixed Professional Sidebar */}
                <aside className="w-72 flex-shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-gray-200/70 dark:border-gray-800/70 bg-white/75 dark:bg-gray-900/75 backdrop-blur-2xl">
                    <DesktopSidebar
                        activeView={activeView}
                        activeFeature={activeFeature}
                        onNavigateView={(view) => {
                            setActiveView(view);
                            setActiveFeature(null);
                        }}
                        onNavigateFeature={(feat) => {
                            setActiveFeature(feat);
                        }}
                        userProfile={userProfile}
                        counts={{
                            savings: savingsGoals.length,
                            loans: loans.length,
                            billsAndPayments: subscriptions.length + scheduledTransactions.length,
                            investments: investments.length,
                        }}
                        onOpenAiAssistant={() => setChatbotOpen(true)}
                    />
                </aside>

                {/* Main Workspace Column */}
                <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-transparent">
                    <DesktopHeader
                        activeView={activeView}
                        activeFeature={activeFeature}
                        userProfile={userProfile}
                        theme={theme}
                        setTheme={setTheme}
                        onQuickAction={() => setIsQuickAddOpen(true)}
                        onOpenSearch={() => setIsSearchOpen(true)}
                        onNavigateSettings={() => {
                            setActiveView(ViewType.Settings);
                            setActiveFeature(null);
                        }}
                        onOpenAiAssistant={() => setChatbotOpen(true)}
                    />

                    <main className="flex-1 p-6 lg:p-8 xl:p-10 max-w-[1600px] w-full mx-auto">
                        {activeFeature ? (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-gray-800/60">
                                    <button
                                        onClick={() => setActiveFeature(null)}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow transition-all cursor-pointer"
                                    >
                                        <i className="fas fa-arrow-left text-xs"></i>
                                        <span>Back to Dashboard</span>
                                    </button>
                                </div>
                                {renderFeatureInner(activeFeature)}
                            </div>
                        ) : (
                            renderView()
                        )}
                    </main>

                    <DesktopStatusFooter
                        totalTransactionsCount={allTransactions.length}
                        activeCurrencySymbol={currencySettings.symbol}
                        lastUpdatedText="Live Local"
                    />
                </div>
            </div>

            {/* Global Chatbot Floating Action */}
            <button
                onClick={() => setChatbotOpen(true)}
                className="fixed bottom-24 right-5 sm:bottom-28 sm:right-12 lg:bottom-12 lg:right-10 w-14 h-14 bg-gradient-to-tr from-purple-500 to-cyan-400 text-white rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 z-40 flex items-center justify-center border border-white/20 cursor-pointer"
                aria-label={t('financialAssistant')}
            >
                <i className="fas fa-robot fa-lg"></i>
            </button>
            <Chatbot 
                isOpen={isChatbotOpen} 
                onClose={() => setChatbotOpen(false)}
                financialContext={{
                    totalIncome,
                    totalExpenses,
                    netBalance: netAmount,
                    recentTransactions: allTransactions.slice(0, 5).map(t => ({ name: t.name, amount: t.amount, type: t.type }))
                }}
            />

            {/* Global Search and Quick Add Modals */}
            <GlobalQuickAddModal
                isOpen={isQuickAddOpen}
                onClose={() => setIsQuickAddOpen(false)}
                onAddIncome={(item) => addTransaction(TransactionType.Income, item)}
                onAddExpense={(item) => addTransaction(TransactionType.Expense, item)}
                incomeCategories={incomeCategories}
                expenseCategories={allExpenseCategories}
                showToast={showToast}
            />

            <GlobalSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                allIncome={income}
                allExpenses={expenses}
            />

            <NotificationToast toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
};

export default App;