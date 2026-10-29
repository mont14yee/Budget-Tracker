import React from 'react';
import TransactionView from '../components/TransactionView';
import { Transaction, TransactionType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface ExpensesViewProps {
    items: Transaction[];
    allItems: Transaction[];
    total: number;
    addExpense: (item: Omit<Transaction, 'id'>) => Promise<void> | void;
    deleteExpense: (id: string) => Promise<void> | void;
    updateExpense?: (item: Transaction, originalType?: TransactionType) => Promise<void> | void;
    categoryFilter: string | null;
    onClearFilter: () => void;
    expenseCategories: string[];
    incomeCategories?: string[];
    allIncome?: Transaction[];
    allExpenses?: Transaction[];
    onAddTransaction?: (type: TransactionType, item: Omit<Transaction, 'id'>) => Promise<void> | void;
    onUpdateTransaction?: (type: TransactionType, item: Transaction, originalType?: TransactionType) => Promise<void> | void;
    onDeleteTransaction?: (type: TransactionType, id: string) => Promise<void> | void;
    theme: 'light' | 'dark';
}

const ExpensesView: React.FC<ExpensesViewProps> = ({
    items,
    allItems,
    total,
    addExpense,
    deleteExpense,
    updateExpense,
    categoryFilter,
    onClearFilter,
    expenseCategories,
    incomeCategories,
    allIncome,
    allExpenses,
    onAddTransaction,
    onUpdateTransaction,
    onDeleteTransaction,
    theme,
}) => {
    const { t } = useLanguage();
    return (
        <TransactionView
            title={t('expenseManagement')}
            icon="fas fa-receipt"
            items={items}
            total={total}
            onAddItem={addExpense}
            onDeleteItem={deleteExpense}
            onUpdateItem={updateExpense}
            categories={expenseCategories}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            allIncome={allIncome || []}
            allExpenses={allExpenses || allItems}
            defaultTransactionType="expense"
            onAddTransaction={onAddTransaction}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
            itemIcon="fas fa-receipt"
            itemColor="text-rose-500"
            formTitle={t('addNewExpense')}
            nameLabel={t('expenseName')}
            namePlaceholder={t('expenseNamePlaceholder')}
            totalLabel={t('totalExpenses')}
            amountColor="text-rose-600"
            categoryFilter={categoryFilter}
            onClearFilter={onClearFilter}
            allItems={allItems}
            theme={theme}
            chartTitle={t('monthlyExpenseFlow')}
            chartDataKey="expense"
            chartColor="#f43f5e"
            pageBg="bg-rose-50/50 dark:bg-rose-950/20"
            textColor="text-rose-900 dark:text-rose-100"
            borderColor="border-rose-200/80 dark:border-rose-800/60"
            summaryBgColor="from-rose-100 to-rose-200 dark:from-rose-900/40 dark:to-rose-800/40"
        />
    );
};

export default ExpensesView;