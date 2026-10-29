import React, { useState, useMemo } from 'react';
import { Loan, LoanType, Repayment, InterestType, RepaymentSchedule } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { formatCurrency, parseLocalDate, formatLocalDate } from '../constants';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import { addMoney, subtractMoney, multiplyMoney, divideMoney } from '../utils/money';

interface LoansViewProps {
    loans: Loan[];
    addLoan: (loan: Omit<Loan, 'id' | 'repayments' | 'outstandingAmount'>) => void;
    deleteLoan: (id: string) => void;
    addRepayment: (loanId: string, repayment: Omit<Repayment, 'id'>) => void;
}

const LoanForm: React.FC<{
    onSave: LoansViewProps['addLoan'];
    onCancel: () => void;
}> = ({ onSave, onCancel }) => {
    const { t, currencySettings } = useLanguage();
    const [type, setType] = useState<LoanType>(LoanType.Borrowed);
    const [person, setPerson] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [interestRate, setInterestRate] = useState('0');
    const [interestType, setInterestType] = useState<InterestType>(InterestType.Simple);
    const [date, setDate] = useState(formatLocalDate(new Date()));
    const [dueDate, setDueDate] = useState('');
    const [repaymentSchedule, setRepaymentSchedule] = useState<RepaymentSchedule>(RepaymentSchedule.OneTime);
    const [notes, setNotes] = useState('');
    const [formError, setFormError] = useState('');

    const calculateEMI = () => {
        const p = parseFloat(totalAmount);
        const annualRate = parseFloat(interestRate) / 100;
        const start = parseLocalDate(date);
        const end = parseLocalDate(dueDate);

        if (repaymentSchedule !== RepaymentSchedule.Monthly || isNaN(p) || p <= 0 || !date || !dueDate || end <= start) {
            return 0;
        }

        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        if (months <= 0) return 0;

        if (isNaN(annualRate) || annualRate <= 0) {
            return divideMoney(p, months);
        }

        if (interestType === InterestType.Simple) {
            const years = months / 12;
            const totalInterest = multiplyMoney(p, annualRate * years);
            return divideMoney(addMoney(p, totalInterest), months);
        }
        
        const monthlyRate = annualRate / 12;
        const emi = divideMoney(multiplyMoney(p, monthlyRate * Math.pow(1 + monthlyRate, months)), Math.pow(1 + monthlyRate, months) - 1);
        return emi;
    };

    const emi = useMemo(calculateEMI, [totalAmount, interestRate, date, dueDate, interestType, repaymentSchedule]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsedAmount = parseFloat(totalAmount);
        if (!person.trim()) {
            setFormError('Please provide a person or institution name.');
            return;
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setFormError('Please enter a valid loan amount greater than zero.');
            return;
        }
        if (!dueDate) {
            setFormError('Due date is required.');
            return;
        }

        onSave({
            type,
            person: person.trim(),
            totalAmount: parsedAmount,
            interestRate: parseFloat(interestRate) || 0,
            interestType,
            date,
            dueDate,
            repaymentSchedule,
            notes: notes.trim(),
        });
    };

    const inputClasses = "w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none transition-all";

    return (
        <div className="bg-gray-50 dark:bg-gray-900/60 p-6 rounded-3xl mb-8 border border-gray-200 dark:border-gray-700/60 animate-fadeIn">
            <h3 className="text-base font-extrabold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <i className="fas fa-hand-holding-usd text-cyan-500"></i> Record New Loan
            </h3>

            {formError && (
                <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                    {formError}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                            Loan Direction *
                        </label>
                        <div className="flex gap-2 p-1 bg-gray-200/80 dark:bg-gray-800 rounded-xl max-w-md">
                            <button
                                type="button"
                                onClick={() => setType(LoanType.Borrowed)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    type === LoanType.Borrowed 
                                        ? 'bg-amber-500 text-white shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                            >
                                <i className="fas fa-arrow-down mr-1 text-[10px]"></i> Money You Borrowed
                            </button>
                            <button
                                type="button"
                                onClick={() => setType(LoanType.Lent)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    type === LoanType.Lent 
                                        ? 'bg-emerald-600 text-white shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                            >
                                <i className="fas fa-arrow-up mr-1 text-[10px]"></i> Money Others Owe You
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            {type === LoanType.Lent ? 'Borrower Name (Who owes you?)' : 'Lender Name (Who did you borrow from?)'} *
                        </label>
                        <input
                            type="text"
                            value={person}
                            onChange={e => setPerson(e.target.value)}
                            placeholder="e.g. Bank, Friend's name, Family"
                            className={inputClasses}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Original Amount ({currencySettings.symbol}) *
                        </label>
                        <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={totalAmount}
                            onChange={e => setTotalAmount(e.target.value)}
                            placeholder="0.00"
                            className={inputClasses}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Annual Interest Rate (%)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={interestRate}
                            onChange={e => setInterestRate(e.target.value)}
                            placeholder="0.0"
                            className={inputClasses}
                        />
                    </div>

                    {parseFloat(interestRate) > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Interest Calculation
                            </label>
                            <select
                                value={interestType}
                                onChange={e => setInterestType(e.target.value as InterestType)}
                                className={inputClasses}
                            >
                                <option value={InterestType.Simple}>Simple Interest</option>
                                <option value={InterestType.Compound}>Compound Interest</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Loan Start Date *
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className={inputClasses}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Final Due Date *
                        </label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            className={inputClasses}
                            required
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Repayment Schedule
                        </label>
                        <select
                            value={repaymentSchedule}
                            onChange={e => setRepaymentSchedule(e.target.value as RepaymentSchedule)}
                            className={inputClasses}
                        >
                            <option value={RepaymentSchedule.OneTime}>One-time lump sum</option>
                            <option value={RepaymentSchedule.Monthly}>Monthly installments</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Notes / Terms (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Loan purpose, agreed terms, reference..."
                            className={inputClasses}
                        />
                    </div>
                </div>

                {type === LoanType.Borrowed && emi > 0 && (
                    <div className="mt-4 p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-center">
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Estimated Monthly Payment</p>
                        <p className="font-extrabold font-mono text-lg text-blue-600 dark:text-blue-400">
                            {formatCurrency(emi, currencySettings)}
                        </p>
                    </div>
                )}
                
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        type="submit"
                        className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-xs font-bold shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                        Save Loan
                    </button>
                </div>
            </form>
        </div>
    );
};

const AddRepaymentForm: React.FC<{
    loanId: string;
    outstandingAmount: number;
    onAddRepayment: LoansViewProps['addRepayment'];
}> = ({ loanId, outstandingAmount, onAddRepayment }) => {
    const { currencySettings } = useLanguage();
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(formatLocalDate(new Date()));
    const [repayError, setRepayError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) {
            setRepayError('Repayment amount must be greater than zero.');
            return;
        }
        if (parsed > outstandingAmount) {
            setRepayError(`Repayment cannot exceed the remaining balance of ${formatCurrency(outstandingAmount, currencySettings)}.`);
            return;
        }

        setRepayError('');
        onAddRepayment(loanId, { amount: parsed, date });
        setAmount('');
    };

    if (outstandingAmount <= 0) {
        return (
            <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl flex items-center justify-center gap-1.5 font-bold">
                <i className="fas fa-check-circle"></i> This loan is completely paid off.
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="mt-4 p-3.5 bg-gray-100/90 dark:bg-gray-900/60 rounded-2xl flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                <div className="flex-1">
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                        Record Repayment Amount ({currencySettings.symbol})
                    </label>
                    <div className="flex items-center gap-1.5 mt-1">
                        <input
                            type="number"
                            step="any"
                            min="0.01"
                            max={outstandingAmount}
                            value={amount}
                            onChange={e => {
                                setAmount(e.target.value);
                                if (repayError) setRepayError('');
                            }}
                            placeholder={`Max ${formatCurrency(outstandingAmount, currencySettings)}`}
                            className="w-full text-xs p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setAmount(outstandingAmount.toString());
                                if (repayError) setRepayError('');
                            }}
                            className="px-2.5 py-2 text-[10px] font-bold rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 transition-colors whitespace-nowrap cursor-pointer"
                            title="Fill full remaining balance"
                        >
                            Full Balance
                        </button>
                    </div>
                </div>

                <div className="w-full sm:w-36">
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                        Date Paid
                    </label>
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full text-xs p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 mt-1"
                        required
                    />
                </div>

                <button
                    type="submit"
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                    <i className="fas fa-plus text-[10px]"></i>
                    <span>Apply</span>
                </button>
            </div>
            {repayError && (
                <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">{repayError}</p>
            )}
        </form>
    );
};

const LoanCard: React.FC<{
    loan: Loan;
    onDelete: (id: string) => void;
    onAddRepayment: LoansViewProps['addRepayment'];
    isExpanded: boolean;
    onToggleExpand: () => void;
}> = ({ loan, onDelete, onAddRepayment, isExpanded, onToggleExpand }) => {
    const { t, currencySettings } = useLanguage();
    const isLent = loan.type === LoanType.Lent;
    const isOverdue = parseLocalDate(loan.dueDate) < new Date() && loan.outstandingAmount > 0;
    const repaidAmount = Math.max(0, subtractMoney(loan.totalAmount, loan.outstandingAmount));
    const progressPercent = loan.totalAmount > 0 ? Math.min(100, (repaidAmount / loan.totalAmount) * 100) : 0;
    const isFullyPaid = loan.outstandingAmount <= 0;

    return (
        <div className={`p-5 rounded-3xl border shadow-sm transition-all duration-300 ${
            isLent 
                ? 'bg-white/85 dark:bg-gray-800/85 border-emerald-100 dark:border-emerald-950/40' 
                : 'bg-white/85 dark:bg-gray-800/85 border-amber-100 dark:border-amber-950/40'
        }`}>
            {/* Header: Title, due date, actions */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm flex-shrink-0 ${
                        isLent 
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' 
                            : 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                    }`}>
                        <i className={`fas ${isLent ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                                {loan.person}
                            </h3>
                            {isFullyPaid ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                    Paid in full
                                </span>
                            ) : isOverdue ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 animate-pulse">
                                    Overdue
                                </span>
                            ) : null}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Due date: <strong className="text-gray-700 dark:text-gray-300">{loan.dueDate}</strong>
                            {loan.interestRate > 0 && <span className="ml-2 font-medium">({loan.interestRate}% interest)</span>}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                        onClick={onToggleExpand}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition-colors cursor-pointer"
                        title={isExpanded ? 'Collapse loan details' : 'Expand loan details'}
                        aria-expanded={isExpanded}
                    >
                        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-xs`}></i>
                    </button>
                    <button
                        onClick={() => onDelete(loan.id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Delete loan record"
                        aria-label={`Delete loan with ${loan.person}`}
                    >
                        <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            </div>

            {/* Balances Grid: Original, Repaid, Remaining */}
            <div className="grid grid-cols-3 gap-2 p-3 mt-4 rounded-2xl bg-gray-50/80 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 text-center">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Original Amount</span>
                    <p className="font-mono font-bold text-xs sm:text-sm text-gray-900 dark:text-white mt-0.5">
                        {formatCurrency(loan.totalAmount, currencySettings)}
                    </p>
                </div>
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Amount Repaid</span>
                    <p className="font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {formatCurrency(repaidAmount, currencySettings)}
                    </p>
                </div>
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Remaining</span>
                    <p className={`font-mono font-bold text-xs sm:text-sm mt-0.5 ${isLent ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        {formatCurrency(loan.outstandingAmount, currencySettings)}
                    </p>
                </div>
            </div>

            {/* Repayment Progress bar */}
            <div className="mt-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-1">
                    <span>Repayment Progress</span>
                    <span className="font-mono">{progressPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                        className={`h-2 rounded-full transition-all duration-500 ${isLent ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Expanded Details and Repayment Form */}
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60 animate-fadeIn text-xs">
                    <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-300 mb-3">
                        <p><strong>Loan Started:</strong> {loan.date}</p>
                        <p><strong>Schedule:</strong> {t(loan.repaymentSchedule as any) || loan.repaymentSchedule}</p>
                        {loan.interestRate > 0 && (
                            <p><strong>Interest Type:</strong> {loan.interestType}</p>
                        )}
                        {loan.notes && (
                            <p className="col-span-2 italic text-gray-500"><strong>Notes:</strong> {loan.notes}</p>
                        )}
                    </div>

                    {/* Repayment History */}
                    <div className="mt-3">
                        <h4 className="font-bold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                            Repayment History ({loan.repayments?.length || 0})
                        </h4>
                        {loan.repayments && loan.repayments.length > 0 ? (
                            <ul className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                {loan.repayments.map(rp => (
                                    <li key={rp.id} className="flex justify-between items-center text-xs p-2 rounded-xl bg-gray-50 dark:bg-gray-900/40">
                                        <span className="text-gray-500">{rp.date}</span>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                            +{formatCurrency(rp.amount, currencySettings)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-gray-400 py-1 italic">No repayments recorded yet.</p>
                        )}

                        <AddRepaymentForm
                            loanId={loan.id}
                            outstandingAmount={loan.outstandingAmount}
                            onAddRepayment={onAddRepayment}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export const LoansView: React.FC<LoansViewProps> = ({ loans, addLoan, deleteLoan, addRepayment }) => {
    const { t, currencySettings } = useLanguage();
    const [activeTab, setActiveTab] = useState<LoanType>(LoanType.Borrowed);
    const [showForm, setShowForm] = useState(false);
    const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const { lentLoans, borrowedLoans, totalLent, totalBorrowed } = useMemo(() => {
        const lent = loans.filter(l => l.type === LoanType.Lent);
        const borrowed = loans.filter(l => l.type === LoanType.Borrowed);
        return {
            lentLoans: lent,
            borrowedLoans: borrowed,
            totalLent: lent.reduce((sum, l) => addMoney(sum, l.outstandingAmount), 0),
            totalBorrowed: borrowed.reduce((sum, l) => addMoney(sum, l.outstandingAmount), 0),
        };
    }, [loans]);
    
    const displayedLoans = activeTab === LoanType.Lent ? lentLoans : borrowedLoans;

    const handleSaveLoan = (loanData: Omit<Loan, 'id' | 'repayments' | 'outstandingAmount'>) => {
        addLoan(loanData);
        setShowForm(false);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700/60">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">
                            <i className="fas fa-hand-holding-usd"></i>
                        </div>
                        Loans & Money Owed
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Track debts you are repaying and money others owe to you.
                    </p>
                </div>

                <button 
                    onClick={() => setShowForm(!showForm)} 
                    className="h-11 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-bold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                    aria-expanded={showForm}
                >
                    <i className={`fas fa-${showForm ? 'times' : 'plus'} text-xs`}></i>
                    <span>{showForm ? t('cancel') || 'Cancel' : 'Record Loan'}</span>
                </button>
            </div>
            
            {/* Two Distinct Groups Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
                <div 
                    onClick={() => setActiveTab(LoanType.Borrowed)}
                    className={`p-6 rounded-3xl border transition-all cursor-pointer ${
                        activeTab === LoanType.Borrowed 
                            ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-md' 
                            : 'bg-white/80 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                            Money You Borrowed (Debts)
                        </span>
                        <i className="fas fa-arrow-down text-amber-500 text-sm"></i>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400 my-2">
                        {formatCurrency(totalBorrowed, currencySettings)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {borrowedLoans.length} active loan{borrowedLoans.length === 1 ? '' : 's'} to repay
                    </p>
                </div>

                <div 
                    onClick={() => setActiveTab(LoanType.Lent)}
                    className={`p-6 rounded-3xl border transition-all cursor-pointer ${
                        activeTab === LoanType.Lent 
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 shadow-md' 
                            : 'bg-white/80 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                            Money Others Owe You (Lent)
                        </span>
                        <i className="fas fa-arrow-up text-emerald-500 text-sm"></i>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 my-2">
                        {formatCurrency(totalLent, currencySettings)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {lentLoans.length} active loan{lentLoans.length === 1 ? '' : 's'} owed to you
                    </p>
                </div>
            </div>

            {showForm && <LoanForm onSave={handleSaveLoan} onCancel={() => setShowForm(false)} />}
            
            {/* Tabs for switching between groups */}
            <div className="mb-6 flex gap-2 p-1.5 bg-gray-100 dark:bg-gray-900/60 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab(LoanType.Borrowed)}
                    className={`py-2 px-5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeTab === LoanType.Borrowed 
                            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                >
                    Money You Borrowed ({borrowedLoans.length})
                </button>
                <button
                    onClick={() => setActiveTab(LoanType.Lent)}
                    className={`py-2 px-5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeTab === LoanType.Lent 
                            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                >
                    Money Others Owe You ({lentLoans.length})
                </button>
            </div>

            {/* Loans Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {displayedLoans.length > 0 ? (
                    displayedLoans.map(loan => (
                        <LoanCard 
                            key={loan.id} 
                            loan={loan} 
                            onDelete={id => setPendingDeleteId(id)} 
                            onAddRepayment={addRepayment}
                            isExpanded={expandedLoanId === loan.id}
                            onToggleExpand={() => setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)}
                        />
                    ))
                ) : (
                    <div className="col-span-full">
                        <EmptyState
                            icon="fas fa-hand-holding-usd"
                            title={activeTab === LoanType.Borrowed ? 'No borrowed loans recorded' : 'No lent money recorded'}
                            description={
                                activeTab === LoanType.Borrowed
                                    ? 'Track money you borrowed, outstanding balances, repayment schedules, and due dates.'
                                    : 'Keep track of funds lent to friends, colleagues, or family and record their repayments.'
                            }
                            actionLabel="Record Loan"
                            onAction={() => setShowForm(true)}
                        />
                    </div>
                )}
            </div>

            {/* Delete Modal */}
            <ConfirmModal
                isOpen={!!pendingDeleteId}
                title={t('confirmDelete') || 'Delete Loan'}
                message="Are you sure you want to delete this loan record? This will permanently remove the repayment history."
                confirmLabel={t('delete') || 'Delete'}
                cancelLabel={t('cancel') || 'Cancel'}
                variant="danger"
                onConfirm={() => {
                    if (pendingDeleteId) {
                        deleteLoan(pendingDeleteId);
                        setPendingDeleteId(null);
                    }
                }}
                onCancel={() => setPendingDeleteId(null)}
            />
        </div>
    );
};

export default LoansView;