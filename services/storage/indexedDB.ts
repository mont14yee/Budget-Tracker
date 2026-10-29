/**
 * Versioned IndexedDB Storage Engine for Wallet Application
 *
 * Provides transactional, indexed, high-performance local storage for all financial records
 * and activity history. Isolated strictly by accountId.
 */

export const DB_NAME = 'WalletDB';
export const DB_VERSION = 1;

export type StoreName =
    | 'profiles'
    | 'preferences'
    | 'income'
    | 'expenses'
    | 'savingsGoals'
    | 'loans'
    | 'subscriptions'
    | 'scheduledTransactions'
    | 'investments'
    | 'activityHistory';

export const ALL_STORES: StoreName[] = [
    'profiles',
    'preferences',
    'income',
    'expenses',
    'savingsGoals',
    'loans',
    'subscriptions',
    'scheduledTransactions',
    'investments',
    'activityHistory',
];

function getIDBFactory(): IDBFactory {
    if (typeof indexedDB !== 'undefined') {
        return indexedDB;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) {
        return (globalThis as any).indexedDB;
    }
    if (typeof window !== 'undefined' && window.indexedDB) {
        return window.indexedDB;
    }
    throw new Error('IndexedDB is not available in the current environment.');
}

let dbInstancePromise: Promise<IDBDatabase> | null = null;

/**
 * Opens or retrieves the singleton connection to the versioned WalletDB database.
 */
export function openWalletDB(): Promise<IDBDatabase> {
    if (dbInstancePromise) {
        return dbInstancePromise;
    }

    dbInstancePromise = new Promise((resolve, reject) => {
        try {
            const factory = getIDBFactory();
            const request = factory.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = request.result;
                const oldVersion = event.oldVersion;
                const newVersion = event.newVersion || DB_VERSION;
                console.info(`[WalletDB] Upgrading schema from version ${oldVersion} to ${newVersion}`);

                // 1. Profiles (key: accountId)
                if (!db.objectStoreNames.contains('profiles')) {
                    db.createObjectStore('profiles', { keyPath: 'accountId' });
                }

                // 2. Preferences (key: accountId)
                if (!db.objectStoreNames.contains('preferences')) {
                    db.createObjectStore('preferences', { keyPath: 'accountId' });
                }

                // 3. Income
                if (!db.objectStoreNames.contains('income')) {
                    const store = db.createObjectStore('income', { keyPath: 'id' });
                    store.createIndex('by_accountId', 'accountId', { unique: false });
                    store.createIndex('by_date', 'date', { unique: false });
                }

                // 4. Expenses
                if (!db.objectStoreNames.contains('expenses')) {
                    const store = db.createObjectStore('expenses', { keyPath: 'id' });
                    store.createIndex('by_accountId', 'accountId', { unique: false });
                    store.createIndex('by_date', 'date', { unique: false });
                }

                // 5. Savings Goals
                if (!db.objectStoreNames.contains('savingsGoals')) {
                    const store = db.createObjectStore('savingsGoals', { keyPath: 'id' });
                    store.createIndex('by_accountId', 'accountId', { unique: false });
                }

                // 6. Loans
                if (!db.objectStoreNames.contains('loans')) {
                    const store = db.createObjectStore('loans', { keyPath: 'id' });
                    store.createIndex('by_accountId', 'accountId', { unique: false });
                }

                // 7. Subscriptions
                if (!db.objectStoreNames.contains('subscriptions')) {
                    const store = db.createObjectStore('subscriptions', { keyPath: 'id' });
                    store.createIndex('by_accountId', 'accountId', { unique: false });
                }

                // 8. Scheduled Transactions
                if (!db.objectStoreNames.contains('scheduledTransactions')) {
                    const store = db.createObjectStore('scheduledTransactions', { keyPath: 'id' });
                    store.createIndex('by_accountId', 'accountId', { unique: false });
                }

                // 9. Investments
                if (!db.objectStoreNames.contains('investments')) {
                    const store = db.createObjectStore('investments', { keyPath: 'id' });
                    store.createIndex('by_accountId', 'accountId', { unique: false });
                }

                // 10. Activity History
                if (!db.objectStoreNames.contains('activityHistory')) {
                    const store = db.createObjectStore('activityHistory', { keyPath: 'id' });
                    store.createIndex('by_accountId', 'accountId', { unique: false });
                    store.createIndex('by_timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => {
                    db.close();
                    dbInstancePromise = null;
                };
                resolve(db);
            };

            request.onerror = () => {
                dbInstancePromise = null;
                reject(request.error || new Error('Failed to open WalletDB'));
            };

            request.onblocked = () => {
                console.warn('[WalletDB] Database open request is blocked by an open connection');
            };
        } catch (err) {
            dbInstancePromise = null;
            reject(err);
        }
    });

    return dbInstancePromise;
}

/**
 * Closes the active database connection (useful for resets or testing).
 */
export async function closeWalletDB(): Promise<void> {
    if (dbInstancePromise) {
        const db = await dbInstancePromise;
        db.close();
        dbInstancePromise = null;
    }
}

/**
 * Execute a read-only transaction on a store.
 */
export async function withReadTransaction<T>(
    storeName: StoreName,
    callback: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
    const db = await openWalletDB();
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            let result: any;

            Promise.resolve(callback(store))
                .then(res => {
                    result = res;
                })
                .catch(reject);

            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Execute a readwrite transaction on a store or multiple stores.
 */
export async function withWriteTransaction<T>(
    storeNames: StoreName | StoreName[],
    callback: (stores: Record<string, IDBObjectStore>, tx: IDBTransaction) => Promise<T> | T
): Promise<T> {
    const db = await openWalletDB();
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];

    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(names, 'readwrite');
            const storeMap: Record<string, IDBObjectStore> = {};
            for (const name of names) {
                storeMap[name] = tx.objectStore(name);
            }

            let result: any;
            Promise.resolve(callback(storeMap, tx))
                .then(res => {
                    result = res;
                })
                .catch(err => {
                    try {
                        tx.abort();
                    } catch (_) {}
                    reject(err);
                });

            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Write transaction aborted'));
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Retrieves all records belonging to an accountId from an indexed object store.
 */
export async function idbGetByAccount<T>(storeName: StoreName, accountId: string): Promise<T[]> {
    if (storeName === 'profiles' || storeName === 'preferences') {
        const item = await idbGetById<T>(storeName, accountId);
        return item ? [item] : [];
    }

    return withReadTransaction(storeName, store => {
        return new Promise<T[]>((resolve, reject) => {
            const index = store.index('by_accountId');
            const request = index.getAll(IDBKeyRange.only(accountId));
            request.onsuccess = () => resolve((request.result || []) as T[]);
            request.onerror = () => reject(request.error);
        });
    });
}

/**
 * Retrieves a single record by its primary key.
 */
export async function idbGetById<T>(storeName: StoreName, key: IDBValidKey): Promise<T | null> {
    return withReadTransaction(storeName, store => {
        return new Promise<T | null>((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve((request.result as T) ?? null);
            request.onerror = () => reject(request.error);
        });
    });
}

/**
 * Inserts or updates an item in the store.
 */
export async function idbPutItem<T>(storeName: StoreName, item: T): Promise<T> {
    return withWriteTransaction(storeName, (stores) => {
        return new Promise<T>((resolve, reject) => {
            const request = stores[storeName].put(item);
            request.onsuccess = () => resolve(item);
            request.onerror = () => reject(request.error);
        });
    });
}

/**
 * Inserts or updates an array of items within a single write transaction.
 */
export async function idbPutBatch<T>(storeName: StoreName, items: T[]): Promise<void> {
    if (items.length === 0) return;
    return withWriteTransaction(storeName, (stores) => {
        const store = stores[storeName];
        for (const item of items) {
            store.put(item);
        }
    });
}

/**
 * Deletes a single item by key.
 */
export async function idbDeleteItem(storeName: StoreName, key: IDBValidKey): Promise<void> {
    return withWriteTransaction(storeName, (stores) => {
        return new Promise<void>((resolve, reject) => {
            const request = stores[storeName].delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
}

/**
 * Deletes all items for an accountId from an indexed object store.
 */
export async function idbDeleteByAccount(storeName: StoreName, accountId: string): Promise<void> {
    if (storeName === 'profiles' || storeName === 'preferences') {
        return idbDeleteItem(storeName, accountId);
    }

    return withWriteTransaction(storeName, (stores) => {
        return idbDeleteByAccountInStore(stores[storeName], accountId);
    });
}

/**
 * Deletes all items for an accountId within an already open transaction store.
 */
export function idbDeleteByAccountInStore(store: IDBObjectStore, accountId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        try {
            if (!store.indexNames.contains('by_accountId')) {
                const req = store.delete(accountId);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
                return;
            }
            const index = store.index('by_accountId');
            const request = index.openCursor(IDBKeyRange.only(accountId));

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Retrieves set of existing IDs for an accountId within an already open transaction store.
 */
export function idbGetExistingIdsInStore(store: IDBObjectStore, accountId: string): Promise<Set<string>> {
    return new Promise<Set<string>>((resolve, reject) => {
        try {
            const ids = new Set<string>();
            if (!store.indexNames.contains('by_accountId')) {
                resolve(ids);
                return;
            }
            const index = store.index('by_accountId');
            const request = index.openCursor(IDBKeyRange.only(accountId));
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    if (cursor.primaryKey && typeof cursor.primaryKey === 'string') {
                        ids.add(cursor.primaryKey);
                    } else if (cursor.value && cursor.value.id) {
                        ids.add(cursor.value.id);
                    }
                    cursor.continue();
                } else {
                    resolve(ids);
                }
            };
            request.onerror = () => reject(request.error);
        } catch (err) {
            reject(err);
        }
    });
}


/**
 * Completely clears an entire store.
 */
export async function idbClearStore(storeName: StoreName): Promise<void> {
    return withWriteTransaction(storeName, stores => {
        return new Promise<void>((resolve, reject) => {
            const req = stores[storeName].clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    });
}
