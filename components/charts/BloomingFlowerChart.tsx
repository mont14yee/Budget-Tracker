import { addMoney, subtractMoney, multiplyMoney, divideMoney } from '../../utils/money';
import React, { useMemo } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { Subscription, SubscriptionType, Frequency } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCurrency } from '../../constants';

interface BloomingFlowerChartProps {
    data: Subscription[];
    theme: 'light' | 'dark';
}

const BloomingFlowerChart: React.FC<BloomingFlowerChartProps> = ({ data, theme }) => {
    const { t, currencySettings } = useLanguage();

    const chartData = useMemo(() => {
        const incomeStreams = data.filter(sub => sub.type === SubscriptionType.Income);
        return incomeStreams.map(sub => {
            let annualAmount = sub.amount;
            if (sub.frequency === Frequency.Monthly) annualAmount *= 12;
            if (sub.frequency === Frequency.Weekly) annualAmount *= 52;
            return {
                subject: sub.name,
                amount: annualAmount,
            };
        });
    }, [data]);
    
    const maxAmount = useMemo(() => {
        if (chartData.length === 0) return 1000;
        return Math.max(...chartData.map(d => d.amount)) * 1.2;
    }, [chartData]);


    if (chartData.length === 0) {
        return <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">{t('noIncomeStreams')}</div>;
    }

    const totalAnnualIncome = chartData.reduce((sum, item) => addMoney(sum, item.amount), 0);

    return (
        <div className="relative w-full h-80">
            <ResponsiveContainer>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <defs>
                        <radialGradient id="flowerGradient">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#15803d" stopOpacity={0.9}/>
                        </radialGradient>
                    </defs>
                    <PolarGrid stroke={theme === 'dark' ? '#4a5568' : '#e2e8f0'} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: theme === 'dark' ? '#a0aec0' : '#4a5568', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, maxAmount]} tick={false} axisLine={false} />
                    <Radar name={t('annualProjection')} dataKey="amount" stroke="#16a34a" fill="url(#flowerGradient)" fillOpacity={0.7} />
                    <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            return (
                                <div className="p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl text-sm">
                                    <p className="font-bold text-green-600 dark:text-green-400">{payload[0].payload.subject}</p>
                                    <p>{formatCurrency(payload[0].value as number, currencySettings)} / {t('year')}</p>
                                </div>
                            );
                        }
                        return null;
                    }}/>
                </RadarChart>
            </ResponsiveContainer>
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-full flex flex-col items-center justify-center text-center shadow-inner">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{t('annualProjection')}</span>
                    <span className="font-extrabold text-lg text-green-600 dark:text-green-400">{formatCurrency(totalAnnualIncome, currencySettings)}</span>
                </div>
            </div>
        </div>
    );
};

export default BloomingFlowerChart;
