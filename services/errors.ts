/**
 * Strongly-typed Error Hierarchy for Financial Data Access Layer
 */

export class FinancialError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly details?: unknown;

    constructor(message: string, code: string = 'FINANCIAL_ERROR', statusCode: number = 400, details?: unknown) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class ValidationError extends FinancialError {
    public readonly field?: string;

    constructor(message: string, field?: string, details?: unknown) {
        super(message, 'VALIDATION_ERROR', 422, details);
        this.field = field;
    }
}

export class FinancialIntegrityError extends FinancialError {
    constructor(message: string, code: string = 'FINANCIAL_INTEGRITY_ERROR', details?: unknown) {
        super(message, code, 400, details);
    }
}

export class DatabaseError extends FinancialError {
    public readonly originalError?: unknown;

    constructor(message: string, originalError?: unknown, code: string = 'DATABASE_ERROR') {
        super(message, code, 500, originalError);
        this.originalError = originalError;
    }
}

export class NotFoundError extends FinancialError {
    constructor(resource: string, id?: string) {
        const msg = id ? `${resource} with ID '${id}' was not found.` : `${resource} was not found.`;
        super(msg, 'NOT_FOUND', 404);
    }
}

/**
 * Translates unknown errors into a clean, human-readable message for the UI.
 */
export const formatUserErrorMessage = (error: unknown, fallback: string = 'A financial operation failed.'): string => {
    if (!error) return fallback;

    if (error instanceof ValidationError || error instanceof FinancialIntegrityError || error instanceof NotFoundError) {
        return error.message;
    }

    if (error instanceof DatabaseError) {
        // Parse database error details if available
        const orig = error.originalError as any;
        if (orig?.message) {
            if (orig.code === '23505') {
                return 'A record with this identifier already exists (duplicate entry).';
            }
            if (orig.code === '23503') {
                return 'Referenced record was not found or has been deleted.';
            }
            if (orig.code === '23514') {
                return 'The entered values violate financial constraint rules (e.g. negative balance or invalid range).';
            }
            return orig.message;
        }
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return fallback;
};
