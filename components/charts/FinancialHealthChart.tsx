import React from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '../../constants';
import { useLanguage } from '../../contexts/LanguageContext';

interface ChartDataPoint {
    month: string;
    income: number;
    expenses: number;
    balance: number;
}
interface FinancialHealthChartProps {
    theme: 'light' | 'dark';
    data: ChartDataPoint[];
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    const { t, currencySettings } = useLanguage();
    if (active && payload && payload.length) {
      return (
        <div className="p-3 min-w-[150px] bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl text-sm">
          <p className="label font-bold text-lg mb-2 text-gray-800 dark:text-gray-200">{`${label}`}</p>
          {payload.map((pld: any) => (
            <div key={pld.dataKey} className="flex justify-between items-center" style={{color: pld.color}}>
                <span>{pld.name}:</span>
                <span className="font-bold ml-2">{formatCurrency(pld.value, currencySettings)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
};


const FinancialHealthChart: React.FC<FinancialHealthChartProps> = ({ theme, data }) => {
    const { t } = useLanguage();
    const textColor = theme === 'dark' ? '#a0aec0' : '#4a5568';
    const gridColor = theme === 'dark' ? '#4a5568' : '#e2e8f0';

    const localizedData = data.map(d => ({
        ...d,
        [t('income')]: d.income,
        [t('expenses')]: d.expenses,
        [t('netBalance')]: d.balance,
    }));


    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">{t('noDataForPeriod')}</div>;
    }

    return (
        <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
                <ComposedChart data={localizedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="month" tick={{ fill: textColor }} fontSize={12} />
                    <YAxis tick={{ fill: textColor }} fontSize={12} tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value as number)}/>
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
                    <Legend wrapperStyle={{ color: textColor }} />
                    <Bar dataKey={t('income')} fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={t('expenses')} fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey={t('netBalance')} stroke="#2196f3" strokeWidth={3} dot={{r: 4}} activeDot={{ r: 8 }} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

export default FinancialHealthChart;