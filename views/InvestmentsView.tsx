import React, { useState, useMemo } from 'react';
import { Investment, Transaction } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { formatCurrency, formatLocalDate } from '../constants';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import { addMoney, subtractMoney, multiplyMoney } from '../utils/money';

interface InvestmentsViewProps {
    investments: Investment[];
    addInvestment: (item: Omit<Investment, 'id'>) => void;
    updateInvestment: (item: Investment) => void;
    sellInvestment: (id: string, quantityToSell?: number, salePrice?: number) => void;
    deleteInvestment: (id: string) => void;
    income?: Transaction[];
    expenses?: Transaction[];
}

const InvestmentFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Omit<Investment, 'id'>) => void;
}> = ({ isOpen, onClose, onSave }) => {
    const { t, currencySettings } = useLanguage();
    const [name, setName] = useState('');
    const [type, setType] = useState<Investment['type']>('Stock');
    const [quantity, setQuantity] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [currentPrice, setCurrentPrice] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(formatLocalDate(new Date()));
    const [notes, setNotes] = useState('');
    const [formError, setFormError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const qty = parseFloat(quantity);
        const pPrice = parseFloat(purchasePrice);
        const cPrice = parseFloat(currentPrice || purchasePrice);

        if (!name.trim()) {
            setFormError('Asset name / ticker is required.');
            return;
        }
        if (isNaN(qty) || qty <= 0) {
            setFormError('Quantity must be greater than zero.');
            return;
        }
        if (isNaN(pPrice) || pPrice < 0) {
            setFormError('Purchase price cannot be negative.');
            return;
        }
        if (isNaN(cPrice) || cPrice < 0) {
            setFormError('Current price cannot be negative.');
            return;
        }

        onSave({
            name: name.trim().toUpperCase(),
            type,
            quantity: qty,
            purchasePrice: pPrice,
            currentPrice: cPrice,
            purchaseDate,
            notes: notes.trim() || undefined,
        });
        onClose();
    };
    
    const inputClasses = "w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none transition-all";
    
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-fadeIn" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <header className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div>
                            <h2 className="font-extrabold text-lg text-gray-900 dark:text-white">Record Investment Holding</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Track cost basis and estimated value</p>
                        </div>
                        <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                            <i className="fas fa-times text-xs"></i>
                        </button>
                    </header>
                    <main className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        {formError && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                                {formError}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">Asset Name / Symbol *</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. AAPL, VOO, BTC" className={inputClasses} required />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">Asset Type</label>
                                <select value={type} onChange={e => setType(e.target.value as Investment['type'])} className={inputClasses}>
                                    <option value="Stock">{t('stock') || 'Stock'}</option>
                                    <option value="ETF">{t('etf') || 'ETF'}</option>
                                    <option value="Crypto">{t('crypto') || 'Crypto'}</option>
                                    <option value="Mutual Fund">Mutual Fund</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">Quantity / Shares *</label>
                                <input type="number" step="any" min="0.000001" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="1.0" className={inputClasses} required />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">Purchase Price ({currencySettings.symbol}) *</label>
                                <input type="number" step="any" min="0" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="0.00" className={inputClasses} required />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">Estimated Current Price ({currencySettings.symbol})</label>
                                <input type="number" step="any" min="0" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} placeholder="Defaults to purchase price" className={inputClasses} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">Purchase Date *</label>
                                <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className={inputClasses} required />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">Notes (Optional)</label>
                                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Brokerage account, reason for purchase..." className={inputClasses} />
                            </div>
                        </div>
                    </main>
                    <footer className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 flex-shrink-0">
                        <button type="button" onClick={onClose} className="min-h-[44px] py-2.5 px-5 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400">{t('cancel') || 'Cancel'}</button>
                        <button type="submit" className="min-h-[44px] py-2.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-xs font-bold shadow-sm hover:opacity-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">{t('save') || 'Save Asset'}</button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

const InvestmentCard: React.FC<{
    item: Investment;
    onUpdate: (item: Investment) => void;
    onSell: (item: Investment) => void;
    onDelete: (item: Investment) => void;
}> = ({ item, onUpdate, onSell, onDelete }) => {
    const { t, currencySettings } = useLanguage();
    const [newPrice, setNewPrice] = useState(item.currentPrice.toString());
    const [isEditingPrice, setIsEditingPrice] = useState(false);

    const costBasis = multiplyMoney(item.purchasePrice, item.quantity);
    const estimatedValue = multiplyMoney(item.currentPrice, item.quantity);
    const unrealizedGainLoss = subtractMoney(estimatedValue, costBasis);
    const gainLossPercent = costBasis > 0 ? (unrealizedGainLoss / costBasis) * 100 : 0;
    const isGain = unrealizedGainLoss >= 0;

    const handleSavePrice = () => {
        const parsed = parseFloat(newPrice);
        if (!isNaN(parsed) && parsed >= 0) {
            onUpdate({ ...item, currentPrice: parsed });
        }
        setIsEditingPrice(false);
    };

    return (
        <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 p-5 rounded-3xl shadow-sm flex flex-col justify-between transition-all duration-300">
            <div>
                {/* Header: Asset Name, Type, and Actions */}
                <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">{item.name}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                {item.type}
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Purchased on {item.purchaseDate}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Estimated Value</p>
                        <p className="font-mono font-black text-lg text-gray-900 dark:text-white">
                            {formatCurrency(estimatedValue, currencySettings)}
                        </p>
                        <p className={`font-mono font-bold text-xs ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                            {isGain ? '+' : ''}{formatCurrency(unrealizedGainLoss, currencySettings)} ({gainLossPercent.toFixed(2)}%)
                        </p>
                    </div>
                </div>

                {/* Key Numbers Grid */}
                <div className="grid grid-cols-3 gap-2 text-center p-3 mt-4 bg-gray-50/80 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Quantity</span>
                        <p className="font-mono font-bold text-xs text-gray-800 dark:text-gray-200 mt-0.5">{item.quantity.toLocaleString()}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cost Basis</span>
                        <p className="font-mono font-bold text-xs text-gray-800 dark:text-gray-200 mt-0.5">{formatCurrency(costBasis, currencySettings)}</p>
                        <span className="text-[10px] text-gray-400">({formatCurrency(item.purchasePrice, currencySettings)}/u)</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. Price</span>
                        <p className="font-mono font-bold text-xs text-cyan-600 dark:text-cyan-400 mt-0.5">{formatCurrency(item.currentPrice, currencySettings)}</p>
                        <span className="text-[10px] text-gray-400">per unit</span>
                    </div>
                </div>
            </div>

            {/* Bottom Actions Toolbar */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                {isEditingPrice ? (
                    <div className="flex items-center gap-1.5 animate-fadeIn">
                        <input
                            type="number"
                            step="any"
                            value={newPrice}
                            onChange={e => setNewPrice(e.target.value)}
                            placeholder="New unit price"
                            className="w-24 px-2 py-1 text-xs rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                        <button
                            type="button"
                            onClick={handleSavePrice}
                            className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs"
                            title="Save new price"
                        >
                            <i className="fas fa-check"></i>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsEditingPrice(false)}
                            className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs"
                            title="Cancel"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsEditingPrice(true)}
                        className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1 cursor-pointer"
                    >
                        <i className="fas fa-pen text-[10px]"></i>
                        <span>Update Price</span>
                    </button>
                )}

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onSell(item)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                        <i className="fas fa-dollar-sign text-[10px]"></i>
                        <span>Sell</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="w-8 h-8 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-center cursor-pointer"
                        title="Delete asset"
                        aria-label={`Delete ${item.name}`}
                    >
                        <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

const ALLOCATION_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export const InvestmentsView: React.FC<InvestmentsViewProps> = ({
    investments,
    addInvestment,
    updateInvestment,
    sellInvestment,
    deleteInvestment,
    income = [],
}) => {
    const { t, currencySettings } = useLanguage();
    const [showAddModal, setShowAddModal] = useState(false);
    const [pendingDeleteInvestment, setPendingDeleteInvestment] = useState<Investment | null>(null);
    const [pendingSellInvestment, setPendingSellInvestment] = useState<Investment | null>(null);

    // Portfolio metrics
    const portfolioSummary = useMemo(() => {
        let totalValue = 0;
        let totalCost = 0;

        investments.forEach((inv) => {
            const cost = multiplyMoney(inv.purchasePrice, inv.quantity);
            const val = multiplyMoney(inv.currentPrice, inv.quantity);
            totalCost = addMoney(totalCost, cost);
            totalValue = addMoney(totalValue, val);
        });

        const totalUnrealizedGainLoss = subtractMoney(totalValue, totalCost);
        const totalGainLossPercent = totalCost > 0 ? (totalUnrealizedGainLoss / totalCost) * 100 : 0;

        // Realized gain/loss from sales recorded in income
        const salesRecords = income.filter(tx => tx.category === 'Investment Sale');
        const realizedProceeds = salesRecords.reduce((sum, tx) => addMoney(sum, tx.amount), 0);

        return {
            totalValue,
            totalCost,
            totalUnrealizedGainLoss,
            totalGainLossPercent,
            realizedProceeds,
            holdingsCount: investments.length,
        };
    }, [investments, income]);

    const chartData = useMemo(() => {
        return investments.map(inv => ({
            name: inv.name,
            value: multiplyMoney(inv.currentPrice, inv.quantity)
        })).filter(d => d.value > 0);
    }, [investments]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/60 dark:border-gray-700/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] animate-fadeIn">
            {/* Header & Disclaimer */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700/60">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg">
                            <i className="fas fa-arrow-trend-up"></i>
                        </div>
                        Investment Portfolio
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Secondary tracking workspace for stocks, ETFs, crypto, and mutual funds.
                    </p>
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="h-11 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                    <i className="fas fa-plus text-xs"></i>
                    <span>Add Holding</span>
                </button>
            </div>

            {/* Prominent Estimated Value Disclaimer */}
            <div className="mb-6 p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-blue-900 dark:text-blue-200 flex items-start gap-3">
                <i className="fas fa-info-circle text-blue-500 mt-0.5 text-sm flex-shrink-0"></i>
                <div className="text-xs leading-relaxed">
                    <strong>Estimated Values:</strong> Prices are recorded manually by you. This app is not connected to a live market data feed or exchange, so values represent your manually updated price estimates.
                </div>
            </div>

            {/* Portfolio Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Estimated Portfolio Value
                    </p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white font-mono mt-1">
                        {formatCurrency(portfolioSummary.totalValue, currencySettings)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Across {portfolioSummary.holdingsCount} holdings</p>
                </div>

                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total Purchase Cost
                    </p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white font-mono mt-1">
                        {formatCurrency(portfolioSummary.totalCost, currencySettings)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Net capital invested</p>
                </div>

                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Unrealized Gain / Loss
                    </p>
                    <p className={`text-2xl font-black font-mono mt-1 ${portfolioSummary.totalUnrealizedGainLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {portfolioSummary.totalUnrealizedGainLoss >= 0 ? '+' : ''}{formatCurrency(portfolioSummary.totalUnrealizedGainLoss, currencySettings)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                        {portfolioSummary.totalGainLossPercent.toFixed(2)}% ROI
                    </p>
                </div>

                <div className="p-5 rounded-2xl bg-white/80 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Realized Sale Proceeds
                    </p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                        {formatCurrency(portfolioSummary.realizedProceeds, currencySettings)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Recorded cash from sales</p>
                </div>
            </div>

            {/* Asset Allocation Chart if multiple holdings */}
            {investments.length > 1 && (
                <div className="mb-8 p-6 rounded-3xl bg-gray-50/70 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                        Estimated Portfolio Allocation
                    </h3>
                    <div style={{ width: '100%', height: 220 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name">
                                    {chartData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => formatCurrency(Number(value), currencySettings)} />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Holdings Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {investments.length > 0 ? (
                    investments.map(inv => (
                        <InvestmentCard 
                            key={inv.id} 
                            item={inv} 
                            onUpdate={updateInvestment} 
                            onSell={item => setPendingSellInvestment(item)} 
                            onDelete={item => setPendingDeleteInvestment(item)} 
                        />
                    ))
                ) : (
                    <div className="col-span-full">
                        <EmptyState
                            icon="fas fa-seedling"
                            title={t('noInvestments') || 'No investment assets recorded'}
                            description="Add individual stocks, index funds, or digital assets to monitor your overall net worth."
                            actionLabel="Add Holding"
                            onAction={() => setShowAddModal(true)}
                        />
                    </div>
                )}
            </div>

            {/* Add Asset Modal */}
            <InvestmentFormModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSave={addInvestment}
            />

            {/* Delete Modal */}
            <ConfirmModal
                isOpen={!!pendingDeleteInvestment}
                title={t('confirmDelete') || 'Delete Investment'}
                message={`Are you sure you want to remove ${pendingDeleteInvestment?.name}?`}
                confirmLabel={t('delete') || 'Delete'}
                cancelLabel={t('cancel') || 'Cancel'}
                variant="danger"
                onConfirm={() => {
                    if (pendingDeleteInvestment) {
                        deleteInvestment(pendingDeleteInvestment.id);
                        setPendingDeleteInvestment(null);
                    }
                }}
                onCancel={() => setPendingDeleteInvestment(null)}
            />

            {/* Sell Confirmation Modal */}
            <ConfirmModal
                isOpen={!!pendingSellInvestment}
                title={t('sell') || 'Sell Investment'}
                message={pendingSellInvestment ? `Sell ${pendingSellInvestment.quantity} units of ${pendingSellInvestment.name} at estimated unit price ${formatCurrency(pendingSellInvestment.currentPrice, currencySettings)}? Proceeds will be recorded as cash income.` : ''}
                confirmLabel="Confirm Sale"
                cancelLabel={t('cancel') || 'Cancel'}
                variant="warning"
                onConfirm={() => {
                    if (pendingSellInvestment) {
                        sellInvestment(pendingSellInvestment.id);
                        setPendingSellInvestment(null);
                    }
                }}
                onCancel={() => setPendingSellInvestment(null)}
            />
        </div>
    );
};

export default InvestmentsView;
