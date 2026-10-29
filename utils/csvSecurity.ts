/**
 * CSV Security Utilities - Anti-Formula Injection (CWE-1236 / OWASP)
 * 
 * Formula injection occurs when untrusted spreadsheet content starting with 
 * '=', '+', '-', '@', '\t', or '\r' is opened in spreadsheet programs 
 * like Microsoft Excel or Google Sheets.
 */

// Characters that trigger formula execution in spreadsheet software
const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '|', '%'];

/**
 * Sanitizes a single cell value to prevent spreadsheet formula injection.
 * Enforces proper escaping of quotes, commas, and dangerous trigger characters.
 */
export function sanitizeCsvCell(value: unknown): string {
    if (value === null || value === undefined) {
        return '""';
    }

    let str = String(value);

    // Strip carriage returns which can split lines unexpectedly
    str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Check if the cell starts with any formula injection trigger character
    const trimmed = str.trimStart();
    const hasDangerousPrefix = DANGEROUS_PREFIXES.some(prefix => trimmed.startsWith(prefix));

    if (hasDangerousPrefix) {
        // Prepend a single quote to force spreadsheet engines to treat as plain text
        str = `'${str}`;
    }

    // Escape all double quotes by doubling them per RFC 4180
    const escaped = str.replace(/"/g, '""');

    // Always wrap in quotes for maximum safety against commas, newlines, and formula execution
    return `"${escaped}"`;
}

/**
 * Generates safe CSV rows from headers and structured row arrays
 */
export function buildSafeCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
    const sanitizedHeaders = headers.map(h => sanitizeCsvCell(h)).join(',');
    const sanitizedRows = rows.map(row => row.map(cell => sanitizeCsvCell(cell)).join(','));

    // Prepend UTF-8 BOM (\uFEFF) so Excel respects UTF-8 encoding (e.g. for Ethiopic Amharic text)
    return `\uFEFF${[sanitizedHeaders, ...sanitizedRows].join('\r\n')}`;
}

/**
 * Downloads generated CSV content in the browser safely
 */
export function downloadCsvFile(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
