import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '../../constants';
import { useLanguage } from '../../contexts/LanguageContext';

interface MonthlyFlowChartProps {
    theme: 'light' | 'dark';
    data: any[];
    dataKey: string;
    color: string;
    onMonthClick?: (monthKey: string) => void;
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    const { t, currencySettings } = useLanguage();
    if (active && payload && payload.length) {
      return (
        <div className="p-3 min-w-[120px] bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl">
          <p className="label font-bold text-gray-800 dark:text-gray-200 text-lg mb-1">{`${label}`}</p>
          <div className="flex justify-between items-center text-sm" style={{color: payload[0].fill}}>
            <span>{payload[0].name}:</span>
            <span className="font-bold ml-2">{formatCurrency(payload[0].value, currencySettings)}</span>
          </div>
        </div>
      );
    }
    return null;
};


const MonthlyFlowChart: React.FC<MonthlyFlowChartProps> = ({ theme, data, dataKey, color, onMonthClick }) => {
    const { t } = useLanguage();
    const textColor = theme === 'dark' ? '#a0aec0' : '#4a5568';
    const gridColor = theme === 'dark' ? '#4a5568' : '#e2e8f0';

    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">{t('noDataForPeriod')}</div>;
    }
    
    const handleChartClick = (data: any) => {
        if (onMonthClick && data && data.activePayload && data.activePayload.length > 0) {
            const monthKey = data.activePayload[0].payload.monthKey;
            if (monthKey) {
                onMonthClick(monthKey);
            }
        }
    };

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <BarChart data={data} onClick={onMonthClick ? handleChartClick : undefined}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="month" tick={{ fill: textColor }} fontSize={12} />
                    <YAxis tick={{ fill: textColor }} fontSize={12} tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value as number)} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
                    <Legend wrapperStyle={{ color: textColor }} />
                    <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} name={dataKey.charAt(0).toUpperCase() + dataKey.slice(1)} style={{ cursor: onMonthClick ? 'pointer' : 'default' }}/>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default MonthlyFlowChart;