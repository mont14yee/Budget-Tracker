import Decimal from 'decimal.js';

// Configure Decimal precision defaults for financial domain
Decimal.set({
    precision: 28,
    rounding: Decimal.ROUND_HALF_UP,
    toExpNeg: -9,
    toExpPos: 28,
});

/**
 * Safely converts any input into a Decimal instance.
 * Defaults to 0 if input is null, undefined, NaN, or non-numeric.
 */
export const toDecimal = (val: number | string | Decimal | null | undefined): Decimal => {
    if (val === null || val === undefined) return new Decimal(0);
    if (val instanceof Decimal) return val;
    if (typeof val === 'number') {
        if (isNaN(val) || !isFinite(val)) return new Decimal(0);
        return new Decimal(val);
    }
    if (typeof val === 'string') {
        const cleaned = val.trim().replace(/,/g, '');
        if (!cleaned || isNaN(Number(cleaned))) return new Decimal(0);
        return new Decimal(cleaned);
    }
    return new Decimal(0);
};

export const toCents = (amount: number | string): number => {
    return toDecimal(amount).times(100).round().toNumber();
};

export const fromCents = (cents: number): number => {
    return toDecimal(cents).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
};

/**
 * Rounds an amount to standard monetary decimal places (default 2).
 */
export const roundMoney = (amount: number | string | Decimal, decimals: number = 2): number => {
    return toDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
};

/**
 * Sums multiple amounts with decimal-safe precision.
 */
export const addMoney = (...amounts: (number | string | Decimal | null | undefined)[]): number => {
    return amounts
        .reduce<Decimal>((acc, val) => acc.plus(toDecimal(val)), new Decimal(0))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
};

/**
 * Subtracts b from a with decimal-safe precision (a - b).
 */
export const subtractMoney = (
    a: number | string | Decimal | null | undefined,
    b: number | string | Decimal | null | undefined
): number => {
    return toDecimal(a).minus(toDecimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
};

/**
 * Multiplies two numbers with decimal-safe precision.
 */
export const multiplyMoney = (
    a: number | string | Decimal | null | undefined,
    b: number | string | Decimal | null | undefined,
    decimals: number = 2
): number => {
    return toDecimal(a).times(toDecimal(b)).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
};

/**
 * Divides a by b with decimal-safe precision.
 * Returns 0 if denominator is 0, preventing Infinity/NaN.
 */
export const divideMoney = (
    a: number | string | Decimal | null | undefined,
    b: number | string | Decimal | null | undefined,
    decimals: number = 2
): number => {
    const decB = toDecimal(b);
    if (decB.isZero()) return 0;
    return toDecimal(a).dividedBy(decB).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
};

/**
 * Checks if a string is a valid UUID v4 format.
 */
export const isValidUUID = (id: string | null | undefined): boolean => {
    if (!id || typeof id !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id.trim());
};

/**
 * Ensures a value is a valid UUID, or generates a new one.
 */
export const ensureUUID = (id?: string | null): string => {
    if (id && isValidUUID(id)) return id.trim().toLowerCase();
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

/**
 * Validates a positive monetary amount (> 0).
 */
export const validatePositiveAmount = (val: unknown, fieldName: string = 'Amount'): number => {
    const dec = toDecimal(val as any);
    if (dec.isNaN() || !dec.isFinite()) {
        throw new Error(`${fieldName} must be a valid number.`);
    }
    if (dec.lte(0)) {
        throw new Error(`${fieldName} must be greater than zero.`);
    }
    return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
};

/**
 * Validates a non-negative monetary amount (>= 0).
 */
export const validateNonNegativeAmount = (val: unknown, fieldName: string = 'Amount'): number => {
    const dec = toDecimal(val as any);
    if (dec.isNaN() || !dec.isFinite()) {
        throw new Error(`${fieldName} must be a valid number.`);
    }
    if (dec.lt(0)) {
        throw new Error(`${fieldName} cannot be negative.`);
    }
    return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
};

/**
 * Validates an investment quantity (> 0, allows fractional shares up to 8 decimal places).
 */
export const validateQuantity = (val: unknown, fieldName: string = 'Quantity'): number => {
    const dec = toDecimal(val as any);
    if (dec.isNaN() || !dec.isFinite()) {
        throw new Error(`${fieldName} must be a valid number.`);
    }
    if (dec.lte(0)) {
        throw new Error(`${fieldName} must be greater than zero.`);
    }
    return dec.toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toNumber();
};

/**
 * Validates an ISO date string (YYYY-MM-DD).
 */
export const validateDateString = (dateStr: unknown, fieldName: string = 'Date'): string => {
    if (typeof dateStr !== 'string' || !dateStr.trim()) {
        throw new Error(`${fieldName} is required.`);
    }
    const trimmed = dateStr.trim();
    const parts = trimmed.split('-');
    if (parts.length !== 3) {
        throw new Error(`${fieldName} must be in YYYY-MM-DD format.`);
    }
    const [year, month, day] = parts.map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
        throw new Error(`${fieldName} contains an invalid calendar date.`);
    }
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
        throw new Error(`${fieldName} is an invalid date.`);
    }
    return trimmed;
};

/**
 * Calculates investment performance metrics:
 * - Cost Basis: Quantity * Purchase Price
 * - Market Value: Quantity * Current Price
 * - Unrealized Gain/Loss: Market Value - Cost Basis
 * - Unrealized Gain/Loss Percentage
 */
export const calculateInvestmentMetrics = (
    quantity: number | string,
    purchasePrice: number | string,
    currentPrice: number | string
) => {
    const qty = toDecimal(quantity);
    const pPrice = toDecimal(purchasePrice);
    const cPrice = toDecimal(currentPrice);

    const costBasis = qty.times(pPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const marketValue = qty.times(cPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const unrealizedGainLoss = marketValue.minus(costBasis).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const percentage = costBasis.isZero()
        ? new Decimal(0)
        : unrealizedGainLoss.dividedBy(costBasis).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
        costBasis: costBasis.toNumber(),
        marketValue: marketValue.toNumber(),
        unrealizedGainLoss: unrealizedGainLoss.toNumber(),
        unrealizedGainLossPercent: percentage.toNumber(),
    };
};

/**
 * Calculates sale of an investment (supports full or partial sale):
 * - Validates quantity to sell <= held quantity
 * - Preserves cost basis per share
 * - Calculates sale proceeds = soldQty * currentPrice
 * - Calculates cost basis of sold shares = soldQty * purchasePrice
 * - Calculates realized gain/loss = saleProceeds - costBasisSold
 * - Calculates remaining quantity
 */
export const calculateInvestmentSale = (
    heldQuantity: number | string,
    purchasePrice: number | string,
    currentPrice: number | string,
    quantityToSell?: number | string
) => {
    const totalQty = toDecimal(heldQuantity);
    const pPrice = toDecimal(purchasePrice);
    const cPrice = toDecimal(currentPrice);

    if (totalQty.lte(0)) {
        throw new Error('Investment has no quantity to sell.');
    }

    const sellQty = quantityToSell !== undefined && quantityToSell !== null
        ? toDecimal(quantityToSell)
        : totalQty;

    if (sellQty.lte(0)) {
        throw new Error('Sell quantity must be greater than zero.');
    }
    if (sellQty.gt(totalQty)) {
        throw new Error(`Cannot sell ${sellQty.toString()} shares. Only ${totalQty.toString()} held.`);
    }

    const costBasisSold = sellQty.times(pPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const saleProceeds = sellQty.times(cPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const realizedGainLoss = saleProceeds.minus(costBasisSold).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const remainingQty = totalQty.minus(sellQty).toDecimalPlaces(8, Decimal.ROUND_HALF_UP);

    return {
        soldQuantity: sellQty.toNumber(),
        costBasisSold: costBasisSold.toNumber(),
        saleProceeds: saleProceeds.toNumber(),
        realizedGainLoss: realizedGainLoss.toNumber(),
        remainingQuantity: remainingQty.toNumber(),
        isFullSale: remainingQty.isZero(),
    };
};
