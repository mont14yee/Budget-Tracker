import { addMoney, subtractMoney, multiplyMoney, divideMoney, roundMoney } from '../utils/money';
import { buildSafeCsv, sanitizeCsvCell } from '../utils/csvSecurity';

// Test assertion helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${message}`);
}

console.log('--- Running Financial Logic & Transaction Redesign Tests ---');

// 1. Precision Money Math Tests
const incomeSample = [1500.50, 2400.25, 300.00];
const expenseSample = [450.20, 120.30, 89.99, 14.50];

const totalIncome = incomeSample.reduce((sum, val) => addMoney(sum, val), 0);
assert(totalIncome === 4200.75, `Total income calculation should equal 4200.75 (got ${totalIncome})`);

const totalExpenses = expenseSample.reduce((sum, val) => addMoney(sum, val), 0);
assert(totalExpenses === 674.99, `Total expenses calculation should equal 674.99 (got ${totalExpenses})`);

const availableMoney = subtractMoney(totalIncome, totalExpenses);
assert(availableMoney === 3525.76, `Available money should equal 3525.76 (got ${availableMoney})`);

// 2. Main Money Card: Period Net Difference Formula
const periodIncome = 3200.00;
const periodSpending = 1850.50;
const periodDifference = subtractMoney(periodIncome, periodSpending);
assert(periodDifference === 1349.50, `Period net difference must equal 1349.50 (got ${periodDifference})`);

// 3. Spending Progress: Limit Not Exceeded (< 80%)
const limit1 = 2000;
const spent1 = 1200;
const pct1 = Math.round((spent1 / limit1) * 100);
const remaining1 = subtractMoney(limit1, spent1);
assert(pct1 === 60, `Spent percentage should be 60% (got ${pct1})`);
assert(remaining1 === 800, `Remaining amount should be 800 (got ${remaining1})`);
assert(pct1 < 80, 'Status should be normal (not approaching or exceeded)');

// 4. Spending Progress: Limit Approaching Warning (80% - 99%)
const limit2 = 2000;
const spent2 = 1700;
const pct2 = Math.round((spent2 / limit2) * 100);
const remaining2 = subtractMoney(limit2, spent2);
const isApproaching = pct2 >= 80 && spent2 <= limit2;
assert(pct2 === 85, `Spent percentage should be 85% (got ${pct2})`);
assert(remaining2 === 300, `Remaining amount should be 300 (got ${remaining2})`);
assert(isApproaching === true, 'Status should trigger approaching warning banner');

// 5. Spending Progress: Limit Exceeded (>= 100%)
const limit3 = 2000;
const spent3 = 2150.75;
const isExceeded = spent3 > limit3;
const overAmount = subtractMoney(spent3, limit3);
assert(isExceeded === true, 'Status should be exceeded');
assert(overAmount === 150.75, `Over amount should be 150.75 (got ${overAmount})`);

// 6. Savings Progress: Progress % and Left to Save
const targetAmount = 5000;
const savedAmount = 2100;
const savingsProgress = Math.round((savedAmount / targetAmount) * 100);
const leftToSave = subtractMoney(targetAmount, savedAmount);
assert(savingsProgress === 42, `Savings progress should be 42% (got ${savingsProgress})`);
assert(leftToSave === 2900, `Left to save should be 2900 (got ${leftToSave})`);
assert(savedAmount < targetAmount, 'Savings target must not be treated as already saved');

// 7. Upcoming Payments Chronological Sorting
const samplePayments = [
    { name: 'Rent', dueDate: '2026-11-01', amount: 1200 },
    { name: 'Netflix', dueDate: '2026-10-28', amount: 15.99 },
    { name: 'Electric Bill', dueDate: '2026-10-30', amount: 85.50 }
];

const sortedPayments = [...samplePayments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
assert(sortedPayments[0].name === 'Netflix', 'Earliest due date must be first (Netflix)');
assert(sortedPayments[1].name === 'Electric Bill', 'Second due date must be Electric Bill');
assert(sortedPayments[2].name === 'Rent', 'Third due date must be Rent');

// 8. Transaction Validation Tests
function validateTransaction(input: { name?: string; amount?: number; date?: string; category?: string }) {
    if (!input.name || !input.name.trim()) return { valid: false, error: 'Empty description' };
    if (input.amount === undefined || isNaN(input.amount) || input.amount <= 0) return { valid: false, error: 'Invalid amount' };
    if (!input.date || isNaN(new Date(input.date).getTime())) return { valid: false, error: 'Invalid date' };
    if (!input.category || !input.category.trim()) return { valid: false, error: 'Missing category' };
    return { valid: true };
}

assert(!validateTransaction({ name: '', amount: 50, date: '2026-10-28', category: 'Food' }).valid, 'Empty description must be rejected');
assert(!validateTransaction({ name: 'Groceries', amount: 0, date: '2026-10-28', category: 'Food' }).valid, 'Zero amount must be rejected');
assert(!validateTransaction({ name: 'Groceries', amount: -25, date: '2026-10-28', category: 'Food' }).valid, 'Negative amount must be rejected');
assert(!validateTransaction({ name: 'Groceries', amount: NaN, date: '2026-10-28', category: 'Food' }).valid, 'NaN amount must be rejected');
assert(!validateTransaction({ name: 'Groceries', amount: 50, date: 'invalid-date', category: 'Food' }).valid, 'Invalid date string must be rejected');
assert(validateTransaction({ name: 'Groceries', amount: 45.50, date: '2026-10-28', category: 'Food' }).valid, 'Valid transaction inputs must pass');

// 9. Transaction Update Immutability & Safety
interface TestTx {
    id: string;
    name: string;
    amount: number;
    category: string;
    date: string;
    notes?: string;
}

const initialTxList: TestTx[] = [
    { id: 'tx-1', name: 'Salary', amount: 3000, category: 'Salary', date: '2026-10-01' },
    { id: 'tx-2', name: 'Groceries', amount: 150, category: 'Food & Dining', date: '2026-10-05' },
    { id: 'tx-3', name: 'Coffee', amount: 5, category: 'Food & Dining', date: '2026-10-06' }
];

const updatePayload: TestTx = {
    id: 'tx-2',
    name: 'Supermarket Groceries',
    amount: 175.50,
    category: 'Groceries',
    date: '2026-10-05',
    notes: 'Weekly family shopping'
};

const updatedList = initialTxList.map(t => t.id === updatePayload.id ? updatePayload : t);
assert(updatedList.length === 3, 'Transaction list length must remain constant on update');
assert(updatedList[1].name === 'Supermarket Groceries', 'Target record name must be updated');
assert(updatedList[1].amount === 175.50, 'Target record amount must be updated');
assert(updatedList[1].notes === 'Weekly family shopping', 'Target record notes must be stored');
assert(updatedList[0].name === 'Salary' && updatedList[0].amount === 3000, 'Other records must not be mutated');
assert(updatedList[2].name === 'Coffee' && updatedList[2].amount === 5, 'Other records must not be mutated');

// 10. Transaction Sorting Tests
const unsortedTx: TestTx[] = [
    { id: '1', name: 'A', amount: 50, category: 'General', date: '2026-10-05' },
    { id: '2', name: 'B', amount: 200, category: 'General', date: '2026-10-10' },
    { id: '3', name: 'C', amount: 10, category: 'General', date: '2026-10-01' }
];

const sortedByDateDesc = [...unsortedTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
assert(sortedByDateDesc[0].id === '2' && sortedByDateDesc[2].id === '3', 'Sort by date desc must place newest first');

const sortedByAmountDesc = [...unsortedTx].sort((a, b) => b.amount - a.amount);
assert(sortedByAmountDesc[0].amount === 200 && sortedByAmountDesc[2].amount === 10, 'Sort by amount desc must place largest amount first');

// 11. Historical Category Fallback Test
const activeCategories = ['Food & Dining', 'Transportation', 'Housing', 'Utilities'];
const testCategoriesToDisplay = ['Food & Dining', 'Old Vintage Shop', 'Housing'];

function getCategoryDisplayMeta(cat: string, available: string[]) {
    const isHistorical = !available.includes(cat);
    return {
        label: cat,
        isHistorical,
        fallbackTag: isHistorical ? 'Historical' : undefined
    };
}

const metaActive = getCategoryDisplayMeta('Food & Dining', activeCategories);
assert(metaActive.isHistorical === false && metaActive.fallbackTag === undefined, 'Active categories must not show historical tag');

const metaHistorical = getCategoryDisplayMeta('Old Vintage Shop', activeCategories);
assert(metaHistorical.isHistorical === true && metaHistorical.fallbackTag === 'Historical', 'Discontinued categories must be preserved and flagged as Historical');
assert(metaHistorical.label === 'Old Vintage Shop', 'Category name must not be erased or replaced');

// 12. Savings: Exact Amount Saved and Remaining Calculations
const sampleGoal = {
    id: 'goal-1',
    name: 'Emergency Fund',
    targetAmount: 3000,
    startingBalance: 500,
    deadline: '2027-01-01',
    monthlyContribution: 100,
    interestRate: 4.5,
    compoundingFrequency: 'monthly' as const,
    extraContributions: [
        { id: 'c1', amount: 250, date: '2026-09-15' },
        { id: 'c2', amount: 150, date: '2026-10-10' },
    ]
};

const extraTotal = sampleGoal.extraContributions.reduce((sum, c) => addMoney(sum, c.amount), 0);
const calculatedSaved = addMoney(sampleGoal.startingBalance, extraTotal);
const calculatedRemaining = Math.max(0, subtractMoney(sampleGoal.targetAmount, calculatedSaved));
const calculatedProgress = (calculatedSaved / sampleGoal.targetAmount) * 100;

assert(calculatedSaved === 900, `Savings saved amount must be 900 (got ${calculatedSaved})`);
assert(calculatedRemaining === 2100, `Savings remaining amount must be 2100 (got ${calculatedRemaining})`);
assert(calculatedProgress === 30, `Savings progress must be 30% (got ${calculatedProgress}%)`);
assert(calculatedSaved !== sampleGoal.targetAmount, 'Target amount must never be confused with amount saved');

// 13. Bills & Payments Status Logic
function testDetermineStatus(name: string, dueDateStr: string, isPaused?: boolean, records: Array<{ name: string; date: string }> = []) {
    if (isPaused) return 'paused';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const matching = records.find(r => r.name.toLowerCase().includes(name.toLowerCase()) && r.date.startsWith(monthKey));
    if (matching) return 'paid';
    if (dueDate.getTime() < today.getTime()) return 'overdue';
    return 'upcoming';
}

assert(testDetermineStatus('Netflix', '2026-10-15', true) === 'paused', 'Paused payment must return paused status');
assert(testDetermineStatus('Netflix', '2026-10-15', false, [{ name: 'Netflix Subscription', date: '2026-10-10' }]) === 'paid', 'Payment with matching recorded transaction must return paid status');
assert(testDetermineStatus('Gym', '2026-09-01', false, []) === 'overdue', 'Payment past due date without transaction record must return overdue status');
assert(testDetermineStatus('Rent', '2026-11-01', false, []) === 'upcoming', 'Payment with future due date must return upcoming status');

// 14. Loan Repayment Validation & Balance Update
function validateLoanRepayment(amount: number, outstandingBalance: number) {
    if (isNaN(amount) || amount <= 0) return { valid: false, error: 'Repayment must be greater than zero' };
    if (amount > outstandingBalance) return { valid: false, error: 'Repayment exceeds remaining balance' };
    return { valid: true, newBalance: subtractMoney(outstandingBalance, amount) };
}

assert(!validateLoanRepayment(0, 500).valid, 'Zero loan repayment must be rejected');
assert(!validateLoanRepayment(-50, 500).valid, 'Negative loan repayment must be rejected');
assert(!validateLoanRepayment(600, 500).valid, 'Repayment greater than outstanding balance must be rejected');

const validRepay = validateLoanRepayment(200, 500);
assert(validRepay.valid === true && validRepay.newBalance === 300, `Valid repayment must reduce balance from 500 to 300 (got ${validRepay.newBalance})`);

const fullRepay = validateLoanRepayment(500, 500);
assert(fullRepay.valid === true && fullRepay.newBalance === 0, 'Full repayment must reduce outstanding balance to zero');

// 15. Reports Month-over-Month Calculations
const currMonthExpenses = 1500;
const prevMonthExpenses = 2000;
const diffExpense = subtractMoney(currMonthExpenses, prevMonthExpenses);
const pctExpenseDiff = (diffExpense / prevMonthExpenses) * 100;

assert(diffExpense === -500, `Expense difference should be -500 (got ${diffExpense})`);
assert(pctExpenseDiff === -25, `Expense percentage difference should be -25% (got ${pctExpenseDiff}%)`);

// 16. Investment Calculations (Cost Basis, Value, Unrealized Gain/Loss)
const invQuantity = 15;
const invPurchasePrice = 120.50;
const invCurrentPrice = 145.75;
const costBasis = multiplyMoney(invPurchasePrice, invQuantity);
const estimatedValue = multiplyMoney(invCurrentPrice, invQuantity);
const unrealizedGain = subtractMoney(estimatedValue, costBasis);
const gainPercentage = (unrealizedGain / costBasis) * 100;

assert(costBasis === 1807.50, `Cost basis should equal 1807.50 (got ${costBasis})`);
assert(estimatedValue === 2186.25, `Estimated value should equal 2186.25 (got ${estimatedValue})`);
assert(unrealizedGain === 378.75, `Unrealized gain should equal 378.75 (got ${unrealizedGain})`);
assert(Math.round(gainPercentage * 100) / 100 === 20.95, `Gain percentage should equal 20.95% (got ${gainPercentage.toFixed(2)}%)`);

// 17. Safe CSV Anti-Formula Injection (OWASP CWE-1236)

const maliciousFormulaCell = '=cmd|"/C calc"!A0';
const sanitizedMalicious = sanitizeCsvCell(maliciousFormulaCell);
assert(sanitizedMalicious.startsWith('"\'='), 'Dangerous formula prefix must be neutralized with leading single-quote inside quotes');

const normalTextCell = 'Groceries & Supplies';
const sanitizedNormal = sanitizeCsvCell(normalTextCell);
assert(sanitizedNormal === '"Groceries & Supplies"', 'Safe cell text must be wrapped in quotes without extra escaping');

const csvResult = buildSafeCsv(['Type', 'Description'], [['Expense', '=SUM(A1:A10)']]);
assert(csvResult.startsWith('\uFEFF'), 'CSV output must start with UTF-8 BOM for international/Amharic charset safety');
assert(csvResult.includes('"\'=SUM(A1:A10)"'), 'Dangerous spreadsheet expression in CSV row must be neutralized');

// 18. Precision Rounding & Decimal Arithmetic
const a = 0.1;
const b = 0.2;
const standardJsSum = a + b; // 0.30000000000000004
const decimalSafeSum = addMoney(a, b);
assert(standardJsSum !== 0.3, 'Standard JS binary floating point causes precision error');
assert(decimalSafeSum === 0.3, `Decimal-safe addMoney must equal exactly 0.3 (got ${decimalSafeSum})`);

console.log('--- All 18 Financial, Investment, Security & Integrity Tests Completed Successfully! ---');

