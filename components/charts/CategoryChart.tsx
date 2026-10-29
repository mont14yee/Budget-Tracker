import { addMoney, subtractMoney, multiplyMoney, divideMoney } from '../../utils/money';
import React, { useMemo, useState, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, Sector } from 'recharts';
import { Transaction } from '../../types';
import { formatCurrency } from '../../constants';
import { useLanguage } from '../../contexts/LanguageContext';

interface CategoryChartProps {
    data: Transaction[];
    theme: 'light' | 'dark';
    onCategoryClick?: (category: string) => void;
}

const COLORS = ['#10b981', '#f43f5e', '#ff9800', '#2196f3', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1'];


const CustomTooltip: React.FC<any> = ({ active, payload }) => {
    const { t, currencySettings } = useLanguage();
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = payload[0].payload.total;
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="p-3 min-w-[150px] bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl text-sm">
          <p className="label font-bold text-lg mb-2" style={{ color: payload[0].fill }}>
            {data.name}
          </p>
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-700 dark:text-gray-300">{t('amount')}:</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(data.value, currencySettings)}</span>
          </div>
          <div className="flex justify-between items-center">
             <span className="text-gray-600 dark:text-gray-400">{t('percentage')}:</span>
             <span className="font-semibold text-gray-700 dark:text-gray-300">{percentage}%</span>
          </div>
        </div>
      );
    }
    return null;
};

// Custom shape for the hovered slice to make it pop out
const ActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, theme } = props;

    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 8} // This creates the "pop out" effect
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                stroke={theme === 'dark' ? '#1f2937' : '#fff'}
                strokeWidth={3} // Enhanced border effect
            />
        </g>
    );
};


const AnyPie = Pie as any;
const CategoryChart: React.FC<CategoryChartProps> = ({ data, theme, onCategoryClick }) => {
    const { t } = useLanguage();
    const [activeIndex, setActiveIndex] = useState(-1);

    const onPieEnter = useCallback((_: any, index: number) => {
        setActiveIndex(index);
    }, []);

    const onPieLeave = useCallback(() => {
        setActiveIndex(-1);
    }, []);
    
    const handlePieClick = useCallback((data: any) => {
        if (onCategoryClick && data.name) {
            onCategoryClick(data.name);
        }
    }, [onCategoryClick]);

    const totalExpenses = useMemo(() => data.reduce((sum, item) => addMoney(sum, item.amount), 0), [data]);
    
    const chartData = useMemo(() => {
        const categoryMap: { [key: string]: number } = {};
        data.forEach(item => {
            if (categoryMap[item.category]) {
                categoryMap[item.category] = addMoney(categoryMap[item.category], item.amount);
            } else {
                categoryMap[item.category] = item.amount;
            }
        });
        return Object.keys(categoryMap).map(key => ({ 
            name: key, 
            value: categoryMap[key],
            total: totalExpenses
        }));
    }, [data, totalExpenses]);
    
    const textColor = theme === 'dark' ? '#a0aec0' : '#4a5568';


    if (chartData.length === 0) {
        return <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">{t('noDataForPeriod')}</div>;
    }

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                {/* @ts-ignore */}
                    <PieChart>
                     <defs>
                        <filter id="pieShadow" height="150%" width="150%" x="-25%" y="-25%">
                            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.25)" />
                        </filter>
                    </defs>
                    {/* @ts-ignore */}
                    <AnyPie

                        activeIndex={activeIndex}
                        activeShape={<ActiveShape theme={theme} />}
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        onMouseEnter={onPieEnter}
                        onMouseLeave={onPieLeave}
                        onClick={handlePieClick}
                        style={{ filter: 'url(#pieShadow)', cursor: 'pointer' }}
                    >
                        {chartData.map((entry, index) => (
                             <Cell 
                                key={`cell-${index}`} 
                                fill={COLORS[index % COLORS.length]}
                                stroke={theme === 'dark' ? '#1f2937' : '#fff'}
                                strokeWidth={2}
                                style={{ transition: 'opacity 0.2s ease-in-out' }}
                                opacity={activeIndex === -1 || activeIndex === index ? 1 : 0.6}
                            />
                        ))}
                    </AnyPie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: textColor, marginTop: '20px' }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default CategoryChart;