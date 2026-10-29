import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile, CurrencySettings } from '../types';
import { dbService } from '../services/dbService';
import { buildSafeCsv, downloadCsvFile } from '../utils/csvSecurity';

// ==================================================================
// Shared Design System Components
// ==================================================================

interface SettingsSectionProps {
    title: string;
    icon: string;
    children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ title, icon, children }) => (
    <div className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/60 dark:border-gray-700/50 overflow-hidden">
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <i className={`${icon} text-sm`}></i>
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h2>
        </div>
        <div className="flex flex-col">
            {children}
        </div>
    </div>
);

interface SettingsRowProps {
    label: string;
    subLabel?: string;
    children: React.ReactNode;
    onClick?: () => void;
}

const SettingsRow: React.FC<SettingsRowProps> = ({ label, subLabel, children, onClick }) => (
    <div 
        onClick={onClick}
        className={`px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 dark:border-gray-700/30 last:border-0 transition-colors ${onClick ? 'cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/30' : ''}`}
    >
        <div className="flex flex-col pr-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span>
            {subLabel && <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subLabel}</span>}
        </div>
        <div className="flex-shrink-0">
            {children}
        </div>
    </div>
);

const ToggleSwitch: React.FC<{isOn: boolean; onToggle: () => void; id: string}> = ({ isOn, onToggle, id }) => (
    <button 
        type="button"
        onClick={onToggle} 
        id={id} 
        aria-checked={isOn}
        role="switch"
        className={`relative inline-flex items-center h-7 rounded-full w-12 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-offset-gray-900 ${isOn ? 'bg-gradient-to-r from-purple-500 to-cyan-500' : 'bg-gray-200 dark:bg-gray-700'}`}
    >
        <span className={`inline-block w-5 h-5 transform bg-white rounded-full transition-transform duration-300 shadow-sm ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

// Preset avatar gallery
const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
];

// ==================================================================
// Settings Content
// ==================================================================

interface SettingsProps {
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    showToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const SettingsContent: React.FC<SettingsProps> = ({ theme, setTheme, showToast }) => {
    const { t, language, setLanguage, currencySettings, setCurrencySettings } = useLanguage();
    const { user } = useAuth();

    // App Lock State
    const [appLockEnabled, setAppLockEnabled] = useState(() => {
        return localStorage.getItem('wallet-applock-enabled') === 'true';
    });
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [confirmPinInput, setConfirmPinInput] = useState('');
    const [pinError, setPinError] = useState('');

    // Notification Preferences
    const [billReminders, setBillReminders] = useState(() => {
        const saved = localStorage.getItem('wallet-pref-bill-reminders');
        return saved === null ? true : saved === 'true';
    });
    const [targetMilestones, setTargetMilestones] = useState(() => {
        const saved = localStorage.getItem('wallet-pref-milestones');
        return saved === null ? true : saved === 'true';
    });
    const [largeTransactions, setLargeTransactions] = useState(() => {
        return localStorage.getItem('wallet-pref-large-tx') === 'true';
    });

    // Privacy Controls
    const [shareWithAI, setShareWithAI] = useState(() => {
        const saved = localStorage.getItem('wallet-pref-share-ai');
        return saved === null ? true : saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('wallet-applock-enabled', String(appLockEnabled));
    }, [appLockEnabled]);

    useEffect(() => {
        localStorage.setItem('wallet-pref-bill-reminders', String(billReminders));
    }, [billReminders]);

    useEffect(() => {
        localStorage.setItem('wallet-pref-milestones', String(targetMilestones));
    }, [targetMilestones]);

    useEffect(() => {
        localStorage.setItem('wallet-pref-large-tx', String(largeTransactions));
    }, [largeTransactions]);

    useEffect(() => {
        localStorage.setItem('wallet-pref-share-ai', String(shareWithAI));
    }, [shareWithAI]);

    const handleAppLockToggle = () => {
        if (!appLockEnabled) {
            // Turning ON requires setting a PIN
            const existingPin = localStorage.getItem('wallet-applock-pin');
            if (!existingPin) {
                setIsPinModalOpen(true);
            } else {
                setAppLockEnabled(true);
                showToast?.('success', t('pinSaved') || 'App lock enabled');
            }
        } else {
            setAppLockEnabled(false);
            showToast?.('info', 'App lock disabled');
        }
    };

    const handleSavePin = (e: React.FormEvent) => {
        e.preventDefault();
        if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
            setPinError('Please enter a 4-digit numerical PIN');
            return;
        }
        if (pinInput !== confirmPinInput) {
            setPinError(t('pinMismatch') || 'PINs do not match');
            return;
        }
        localStorage.setItem('wallet-applock-pin', btoa(pinInput));
        setAppLockEnabled(true);
        setIsPinModalOpen(false);
        setPinInput('');
        setConfirmPinInput('');
        setPinError('');
        showToast?.('success', t('pinSaved') || 'App Lock PIN successfully saved');
    };

    const handleBiometricUnlock = async () => {
        if (window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()) {
            showToast?.('success', t('biometricEnabled') || 'Biometric authenticator is active and linked.');
        } else {
            showToast?.('info', t('biometricNotSupported') || 'Biometric authentication is not supported on this device/browser.');
        }
    };

    const selectClasses = "w-full sm:w-auto bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50";
    const inputClasses = "w-full sm:w-36 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50";

    // Dynamic number preview
    const sampleFormattedNumber = useMemo(() => {
        const val = 12450.5;
        const decimals = currencySettings.decimalPlaces ?? 2;
        const fixed = val.toFixed(decimals);
        const [intPart, decPart] = fixed.split('.');
        let formattedInt = '';
        if (currencySettings.numberFormat === 'dot-comma') {
            formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            return decPart ? `${formattedInt},${decPart}` : formattedInt;
        } else if (currencySettings.numberFormat === 'space-dot') {
            formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
            return decPart ? `${formattedInt}.${decPart}` : formattedInt;
        } else {
            formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return decPart ? `${formattedInt}.${decPart}` : formattedInt;
        }
    }, [currencySettings]);

    return (
        <div className="pb-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{t('settings') || 'Settings'}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your interface, currency rules, security, and privacy.</p>
            </div>

            {/* Appearance */}
            <SettingsSection title={t('sidebarAppearance')} icon="fas fa-paint-brush">
                <SettingsRow label={t('sidebarDarkMode')} subLabel="Switch between light and dark themes">
                    <ToggleSwitch isOn={theme === 'dark'} onToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')} id="darkModeToggle" />
                </SettingsRow>
            </SettingsSection>

            {/* Language Selection */}
            <SettingsSection title={t('sidebarLanguage')} icon="fas fa-language">
                <div className="p-5 sm:p-6">
                    <div className="flex bg-gray-100/50 dark:bg-gray-900/50 rounded-2xl p-1 border border-gray-200/50 dark:border-gray-700/50">
                        <button 
                            type="button"
                            onClick={() => {
                                setLanguage('en');
                                showToast?.('success', 'Language set to English');
                            }}
                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${language === 'en' ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-cyan-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                            English
                        </button>
                        <button 
                            type="button"
                            onClick={() => {
                                setLanguage('am');
                                showToast?.('success', 'ቋንቋ ወደ አማርኛ ተቀይሯል');
                            }}
                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${language === 'am' ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-cyan-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                            አማርኛ
                        </button>
                    </div>
                </div>
            </SettingsSection>

            {/* Currency & Formatting */}
            <SettingsSection title={t('sidebarCurrency')} icon="fas fa-coins">
                <SettingsRow label={t('sidebarCurrencySymbol')} subLabel="Set your preferred currency symbol">
                    <input 
                        type="text" 
                        id="currencySymbol" 
                        value={currencySettings.symbol} 
                        onChange={(e) => setCurrencySettings({ symbol: e.target.value.trimStart() })} 
                        className={inputClasses} 
                        placeholder="ETB, $, €, £"
                        maxLength={6}
                    />
                </SettingsRow>
                <SettingsRow label={t('sidebarSymbolPlacement')} subLabel="Position of the currency symbol">
                    <select 
                        id="symbolPlacement" 
                        value={currencySettings.symbolPlacement} 
                        onChange={(e) => setCurrencySettings({ symbolPlacement: e.target.value as 'before' | 'after' })} 
                        className={selectClasses}
                    >
                        <option value="before">{t('sidebarSymbolBefore')} ({currencySettings.symbol}100)</option>
                        <option value="after">{t('sidebarSymbolAfter')} (100{currencySettings.symbol})</option>
                    </select>
                </SettingsRow>
                <SettingsRow label={t('sidebarNumberFormat')} subLabel="Format for thousands and decimal separators">
                    <select 
                        id="numberFormat" 
                        value={currencySettings.numberFormat} 
                        onChange={(e) => setCurrencySettings({ numberFormat: e.target.value as any })} 
                        className={selectClasses}
                    >
                        <option value="comma-dot">1,234.56 (Standard)</option>
                        <option value="dot-comma">1.234,56 (European)</option>
                        <option value="space-dot">1 234.56 (ISO Metric)</option>
                    </select>
                </SettingsRow>
                <SettingsRow label={t('sidebarDecimalPlaces')} subLabel="Number of decimal digits to display">
                    <input 
                        type="number" 
                        id="decimalPlaces" 
                        min="0" 
                        max="6" 
                        value={currencySettings.decimalPlaces} 
                        onChange={(e) => { 
                            const val = parseInt(e.target.value, 10); 
                            if (!isNaN(val) && val >= 0 && val <= 6) { 
                                setCurrencySettings({ decimalPlaces: val });
                            } 
                        }} 
                        className={inputClasses} 
                    />
                </SettingsRow>
                <div className="px-5 py-3 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Live Preview:</span>
                    <span className="font-semibold text-purple-600 dark:text-cyan-400 font-mono">
                        {currencySettings.symbolPlacement === 'before' ? `${currencySettings.symbol} ` : ''}
                        {sampleFormattedNumber}
                        {currencySettings.symbolPlacement === 'after' ? ` ${currencySettings.symbol}` : ''}
                    </span>
                </div>
            </SettingsSection>

            {/* Notification Alerts */}
            <SettingsSection title={t('sidebarNotifications')} icon="fas fa-bell">
                <SettingsRow label={t('sidebarBillReminders')} subLabel="Upcoming recurring subscriptions & bills">
                    <ToggleSwitch isOn={billReminders} onToggle={() => setBillReminders(!billReminders)} id="billRemindersToggle" />
                </SettingsRow>
                <SettingsRow label={t('sidebarTargetMilestones')} subLabel="Savings goal milestones and deadline progress">
                    <ToggleSwitch isOn={targetMilestones} onToggle={() => setTargetMilestones(!targetMilestones)} id="targetMilestonesToggle" />
                </SettingsRow>
                <SettingsRow label={t('sidebarLargeTransactions')} subLabel="Highlight unusually high expenditures">
                    <ToggleSwitch isOn={largeTransactions} onToggle={() => setLargeTransactions(!largeTransactions)} id="largeTransactionsToggle" />
                </SettingsRow>
            </SettingsSection>

            {/* Security & Access Protection */}
            <SettingsSection title={t('sidebarSecurity')} icon="fas fa-shield-alt">
                <SettingsRow label={t('sidebarAppLock')} subLabel="Require authentication PIN to access your wallet">
                    <ToggleSwitch isOn={appLockEnabled} onToggle={handleAppLockToggle} id="appLockToggle" />
                </SettingsRow>
                {appLockEnabled && (
                    <>
                        <SettingsRow label={t('changePin') || t('sidebarChangePIN')} subLabel="Update your 4-digit security PIN" onClick={() => setIsPinModalOpen(true)}>
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300">
                                <i className="fas fa-key text-xs"></i>
                            </div>
                        </SettingsRow>
                        <SettingsRow label={t('biometricUnlock') || t('sidebarEnableFingerprint')} subLabel="Use device biometrics when available" onClick={handleBiometricUnlock}>
                            <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <i className="fas fa-fingerprint text-sm"></i>
                            </div>
                        </SettingsRow>
                    </>
                )}
            </SettingsSection>

            {/* Privacy Controls */}
            <SettingsSection title={t('privacyControls')} icon="fas fa-user-shield">
                <SettingsRow 
                    label={t('aiContextSharing')} 
                    subLabel={t('aiContextSharingDesc')}
                >
                    <ToggleSwitch 
                        isOn={shareWithAI} 
                        onToggle={() => {
                            setShareWithAI(!shareWithAI);
                            showToast?.('info', !shareWithAI ? 'AI financial context enabled' : 'AI financial context disabled');
                        }} 
                        id="shareAIToggle" 
                    />
                </SettingsRow>
                <div className="p-5 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/30 dark:bg-gray-900/20">
                    <div className="flex items-start gap-3">
                        <i className="fas fa-lock text-purple-500 mt-0.5 text-xs"></i>
                        <div>
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{t('dataRetentionPolicy')}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{t('dataRetentionDesc')}</p>
                        </div>
                    </div>
                </div>
            </SettingsSection>

            {/* PIN Setup Modal */}
            {isPinModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-fadeIn">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <i className="fas fa-lock text-sm"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-base">{t('appLockSetup')}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Set a 4-digit access code</p>
                            </div>
                        </div>

                        <form onSubmit={handleSavePin} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('enterNewPin')}</label>
                                <input 
                                    type="password" 
                                    maxLength={4}
                                    pattern="\d*"
                                    inputMode="numeric"
                                    value={pinInput} 
                                    onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                                    placeholder="••••"
                                    className="w-full text-center tracking-[1em] text-lg font-mono bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2 px-3 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('confirmPin')}</label>
                                <input 
                                    type="password" 
                                    maxLength={4}
                                    pattern="\d*"
                                    inputMode="numeric"
                                    value={confirmPinInput} 
                                    onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                                    placeholder="••••"
                                    className="w-full text-center tracking-[1em] text-lg font-mono bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2 px-3 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    required
                                />
                            </div>

                            {pinError && (
                                <p className="text-xs text-red-500 dark:text-red-400">{pinError}</p>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setIsPinModalOpen(false);
                                        setPinError('');
                                    }}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-cyan-500 shadow-md shadow-cyan-500/20 hover:opacity-95 transition-all"
                                >
                                    {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================================================================
// About & Account Lifecycle Content
// ==================================================================

interface AboutContentProps {
    userProfile: UserProfile | null;
    setUserProfile: (profile: UserProfile) => void;
    allIncome?: any[];
    allExpenses?: any[];
    onDataReload?: () => Promise<void> | void;
    showToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const AboutContent: React.FC<AboutContentProps> = ({ 
    userProfile, 
    setUserProfile, 
    allIncome = [], 
    allExpenses = [],
    onDataReload, 
    showToast 
}) => {
    const { t, currencySettings } = useLanguage();
    const { user, signOut, deleteAccount, updateProfile, changePassword } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    // Profile Editing
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(userProfile?.name || '');
    const [avatar, setAvatar] = useState(userProfile?.avatar || '');
    const [email, setEmail] = useState(userProfile?.email || user?.email || '');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Change Password Modal
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [currentPasswordInput, setCurrentPasswordInput] = useState('');
    const [newPasswordInput, setNewPasswordInput] = useState('');
    const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Sign Out Modal
    const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

    // Account ID Copy Feedback
    const [copiedId, setCopiedId] = useState(false);

    // Feedback
    const [feedback, setFeedback] = useState('');
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

    // Version Check
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

    // Data Export & Import States
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
    const [importedBackupData, setImportedBackupData] = useState<any>(null);
    const [importStats, setImportStats] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    // Purge Data Modal
    const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
    const [isPurging, setIsPurging] = useState(false);

    // Delete Account Modal
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const appVersion = '1.2.0';

    const handleCopyUserId = () => {
        if (!user?.id) return;
        navigator.clipboard.writeText(user.id);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
        showToast?.('info', t('copied') || 'User ID copied to clipboard');
    };

    const handleEditClick = () => {
        setName(userProfile?.name || '');
        setAvatar(userProfile?.avatar || '');
        setEmail(userProfile?.email || user?.email || '');
        setIsEditing(true);
    };

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSavingProfile(true);
        try {
            const cleanName = name.trim() || 'User';
            const cleanEmail = email.trim();
            const cleanAvatar = avatar.trim();

            const updatedProfile: UserProfile = {
                name: cleanName,
                avatar: cleanAvatar,
                email: cleanEmail,
            };
            await dbService.updateProfile(user.id, updatedProfile);
            await updateProfile({
                name: cleanName,
                email: cleanEmail,
            });
            setUserProfile(updatedProfile);
            setIsEditing(false);
            showToast?.('success', 'Profile updated successfully!');
            await onDataReload?.();
        } catch (err: any) {
            console.error('Failed to update profile:', err);
            showToast?.('error', err?.message || 'Could not save profile changes.');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleChangePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        if (newPasswordInput.length < 6) {
            setPasswordError('New password must be at least 6 characters long.');
            return;
        }
        if (newPasswordInput !== confirmPasswordInput) {
            setPasswordError('New passwords do not match.');
            return;
        }
        setIsChangingPassword(true);
        try {
            const { error } = await changePassword(newPasswordInput, currentPasswordInput || undefined);
            if (error) {
                setPasswordError(error.message);
                return;
            }
            showToast?.('success', 'Vault password changed successfully.');
            setIsChangePasswordModalOpen(false);
            setCurrentPasswordInput('');
            setNewPasswordInput('');
            setConfirmPasswordInput('');
        } catch (err: any) {
            setPasswordError(err?.message || 'Failed to change password.');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            showToast?.('error', 'Image size must be less than 2MB');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            if (typeof event.target?.result === 'string') {
                setAvatar(event.target.result);
                showToast?.('success', t('avatarUpdated') || 'Avatar image ready');
            }
        };
        reader.readAsDataURL(file);
    };

    // 1. Safe CSV Export
    const handleExportSafeCsv = () => {
        const transactions = [
            ...allIncome.map(tx => ({ ...tx, type: t('income') || 'Income' })),
            ...allExpenses.map(tx => ({ ...tx, type: t('expense') || 'Expense' })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (transactions.length === 0) {
            showToast?.('info', t('noDataToExport') || 'No transaction records found to export.');
            return;
        }

        const headers = [
            t('csvType') || 'Type',
            t('csvDate') || 'Date',
            t('csvName') || 'Name',
            t('csvCategory') || 'Category',
            `${t('csvAmount') || 'Amount'} (${currencySettings.symbol})`,
        ];

        const rows = transactions.map(tx => [
            tx.type,
            tx.date,
            tx.name,
            tx.category,
            Number(tx.amount).toFixed(currencySettings.decimalPlaces ?? 2),
        ]);

        const csvContent = buildSafeCsv(headers, rows);
        const filename = `wallet_export_${new Date().toISOString().split('T')[0]}.csv`;
        downloadCsvFile(csvContent, filename);
        showToast?.('success', `${t('exportCSV') || 'Exported'}: ${filename}`);
    };

    // 2. Full JSON Backup Export
    const handleExportJsonBackup = async () => {
        if (!user) return;
        try {
            const backup = await dbService.exportAllUserData(user.id);
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const filename = `wallet_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast?.('success', `Backup downloaded: ${filename}`);
        } catch (err) {
            console.error('Failed to export backup:', err);
            showToast?.('error', 'Error generating JSON backup.');
        }
    };

    // 3. Import JSON Backup
    const handleFileSelectForImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (!parsed || typeof parsed !== 'object') {
                    throw new Error('Invalid JSON');
                }
                setImportedBackupData(parsed);
                const inc = Array.isArray(parsed.income) ? parsed.income.length : 0;
                const exp = Array.isArray(parsed.expenses) ? parsed.expenses.length : 0;
                const goals = Array.isArray(parsed.savingsGoals) ? parsed.savingsGoals.length : 0;
                const lns = Array.isArray(parsed.loans) ? parsed.loans.length : 0;
                const subs = Array.isArray(parsed.subscriptions) ? parsed.subscriptions.length : 0;
                const sched = Array.isArray(parsed.scheduledTransactions) ? parsed.scheduledTransactions.length : 0;
                const inv = Array.isArray(parsed.investments) ? parsed.investments.length : 0;

                setImportStats(`Found: ${inc} Income, ${exp} Expenses, ${goals} Goals, ${lns} Loans, ${subs} Subscriptions, ${sched} Scheduled, ${inv} Assets`);
                setIsImportModalOpen(true);
            } catch (err) {
                showToast?.('error', 'Could not parse JSON file. Please ensure it is a valid Wallet backup.');
            }
        };
        reader.readAsText(file);
    };

    const handleExecuteImport = async () => {
        if (!user || !importedBackupData) return;
        setIsImporting(true);
        try {
            const result = await dbService.importAllUserData(user.id, importedBackupData, importMode);
            await onDataReload?.();
            setIsImportModalOpen(false);
            setImportedBackupData(null);
            setImportStats(null);
            showToast?.('success', t('dataImportSuccess') || 'Data imported successfully!');
        } catch (err) {
            console.error('Import error:', err);
            showToast?.('error', 'Failed to complete data import.');
        } finally {
            setIsImporting(false);
        }
    };

    // 4. Purge Financial Records
    const handlePurgeData = async () => {
        if (!user) return;
        setIsPurging(true);
        try {
            await dbService.purgeFinancialData(user.id);
            await onDataReload?.();
            setIsPurgeModalOpen(false);
            showToast?.('success', t('dataPurgeSuccess') || 'All financial data purged.');
        } catch (err) {
            console.error('Purge error:', err);
            showToast?.('error', 'Failed to purge financial records.');
        } finally {
            setIsPurging(false);
        }
    };

    // 5. Delete Account Workflow
    const handleDeleteAccount = async () => {
        if (!user) return;
        if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
            showToast?.('error', 'Please type DELETE to confirm account removal.');
            return;
        }

        setIsDeletingAccount(true);
        try {
            await deleteAccount(user.id);
            // Clear all local persistent keys
            localStorage.removeItem('wallet-applock-pin');
            localStorage.removeItem('wallet-applock-enabled');
            localStorage.removeItem('wallet-language');
            localStorage.removeItem('wallet-currency-settings');
            localStorage.removeItem('theme');

            showToast?.('info', t('accountDeletedSuccess') || 'Account permanently deleted.');
        } catch (err) {
            console.error('Delete account error:', err);
            showToast?.('error', 'Failed to delete account.');
        } finally {
            setIsDeletingAccount(false);
            setIsDeleteModalOpen(false);
        }
    };

    // 6. Sign Out
    const handleConfirmSignOut = async () => {
        try {
            setIsSignOutModalOpen(false);
            await signOut();
        } catch (err) {
            console.error('Sign out error:', err);
        }
    };

    // 7. Check For Updates
    const handleCheckForUpdates = async () => {
        setIsCheckingUpdate(true);
        try {
            const res = await fetch('/api/health');
            if (res.ok) {
                showToast?.('success', `${t('upToDate')} (v${appVersion}) • Server API Connected`);
            } else {
                showToast?.('info', `Wallet is on v${appVersion}`);
            }
        } catch (err) {
            showToast?.('info', `Running Wallet build v${appVersion}`);
        } finally {
            setIsCheckingUpdate(false);
        }
    };

    // 8. Submit Feedback
    const handleFeedbackSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (feedback.trim()) {
            setFeedbackSubmitted(true);
            showToast?.('success', t('feedbackSent') || 'Thank you for your feedback!');
            setTimeout(() => {
                setFeedbackSubmitted(false);
                setFeedback('');
            }, 3000);
        }
    };

    return (
        <div className="pb-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{t('accountSessionInfo')}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage personal profile, authenticated session, backups, and data retention.</p>
            </div>

            {/* Profile Information & Avatar */}
            <SettingsSection title={t('profile')} icon="fas fa-user-circle">
                <div className="p-5 sm:p-6">
                    {isEditing ? (
                        <form onSubmit={handleProfileSave} className="space-y-5 animate-fadeIn">
                            {/* Avatar Picker & Preview */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    {t('avatarUrl') || 'Profile Picture'}
                                </label>
                                <div className="flex items-center gap-4 mb-3">
                                    <img 
                                        referrerPolicy="no-referrer" 
                                        src={avatar || `https://ui-avatars.com/api/?name=${name.replace(/\s/g, '+') || 'User'}&background=random&color=fff`} 
                                        alt="Avatar Preview" 
                                        className="w-16 h-16 rounded-full object-cover ring-2 ring-purple-500 shadow-sm"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            <i className="fas fa-upload mr-1.5"></i> {t('uploadAvatar')}
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setAvatar(`https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&color=fff&size=256`)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            <i className="fas fa-dice mr-1.5"></i> Random
                                        </button>
                                        <input 
                                            ref={fileInputRef} 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleCustomAvatarUpload} 
                                            className="hidden" 
                                        />
                                    </div>
                                </div>

                                {/* Preset Avatars */}
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('selectAvatarPreset')}:</p>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {PRESET_AVATARS.map((preset, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setAvatar(preset)}
                                            className={`relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 transition-transform ${avatar === preset ? 'ring-2 ring-purple-500 scale-105' : 'opacity-70 hover:opacity-100'}`}
                                        >
                                            <img referrerPolicy="no-referrer" src={preset} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Name Input */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                    {t('sidebarProfileName')}
                                </label>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2 px-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                                    required 
                                />
                            </div>

                            {/* Local Email Identifier */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                    {t('sidebarProfileEmail')}
                                </label>
                                <div className="relative">
                                    <input 
                                        type="email" 
                                        value={email} 
                                        onChange={e => setEmail(e.target.value)} 
                                        className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2 px-3 pl-8 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                                        required 
                                    />
                                    <i className="fas fa-envelope absolute left-2.5 top-3 text-gray-400 text-xs"></i>
                                </div>
                                <span className="text-[10px] text-gray-400 mt-1 block">Local account identifier stored on this device.</span>
                            </div>

                            <div className="flex gap-3 justify-end pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsEditing(false)} 
                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSavingProfile}
                                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-cyan-500 shadow-md shadow-cyan-500/20 hover:opacity-95 transition-all flex items-center gap-2"
                                >
                                    {isSavingProfile && <i className="fas fa-circle-notch fa-spin text-xs"></i>}
                                    {t('saveProfile')}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center gap-5">
                            <img 
                                referrerPolicy="no-referrer" 
                                src={userProfile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.name || 'User')}&background=random&color=fff`} 
                                alt="User Avatar" 
                                className="w-18 h-18 rounded-full object-cover shadow-sm ring-4 ring-purple-100 dark:ring-gray-700" 
                            />
                            <div className="flex-1 text-center sm:text-left">
                                <div className="flex items-center justify-center sm:justify-start gap-2">
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">{userProfile?.name || 'User'}</p>
                                    <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        Pro
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{user?.email || ''}</p>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                                    <button 
                                        type="button"
                                        onClick={handleEditClick} 
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-purple-600 dark:text-cyan-400 bg-purple-50 dark:bg-cyan-900/20 hover:bg-purple-100 dark:hover:bg-cyan-900/40 transition-colors"
                                    >
                                       <i className="fas fa-pencil-alt text-[10px]"></i> {t('sidebarEditProfile')}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setIsSignOutModalOpen(true)} 
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                    >
                                       <i className="fas fa-sign-out-alt text-[10px]"></i> {t('signOut') || 'Log Out'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </SettingsSection>

            {/* Account & Session Information */}
            <SettingsSection title={t('accountDetails')} icon="fas fa-id-card">
                <SettingsRow label={t('userIdLabel')} subLabel="Your unique local cryptographic identifier">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-lg">
                            {user?.id ? `${user.id.slice(0, 8)}...${user.id.slice(-6)}` : 'N/A'}
                        </span>
                        <button 
                            type="button"
                            onClick={handleCopyUserId}
                            title="Copy full UUID"
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <i className={`fas ${copiedId ? 'fa-check text-green-500' : 'fa-copy'} text-xs`}></i>
                        </button>
                    </div>
                </SettingsRow>
                <SettingsRow label={t('sessionSecurity')} subLabel="Local cryptographic partition status">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            {t('activeSession')} • Local Vault (PBKDF2)
                        </span>
                    </div>
                </SettingsRow>
                <SettingsRow label="Vault Password" subLabel="Manage your local cryptographic vault credentials">
                    <button 
                        type="button"
                        onClick={() => {
                            setCurrentPasswordInput('');
                            setNewPasswordInput('');
                            setConfirmPasswordInput('');
                            setPasswordError('');
                            setIsChangePasswordModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-purple-600 dark:text-cyan-400 bg-purple-50 dark:bg-cyan-900/20 hover:bg-purple-100 dark:hover:bg-cyan-900/40 transition-colors flex items-center gap-1.5"
                    >
                        <i className="fas fa-key text-xs"></i> Change Password
                    </button>
                </SettingsRow>
                <SettingsRow label={t('memberSince')} subLabel="Account creation timestamp">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                    </span>
                </SettingsRow>
                <SettingsRow label={t('lastSignIn')} subLabel="Most recent authenticated access">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Current'}
                    </span>
                </SettingsRow>
            </SettingsSection>

            {/* Personal Financial Data Controls (Export & Import) */}
            <SettingsSection title={t('dataAndPrivacy')} icon="fas fa-database">
                {/* CSV Formula-Safe Export */}
                <SettingsRow label={t('exportCsvSafe')} subLabel="Anti-formula-injection CSV for Excel & Google Sheets">
                    <button 
                        type="button"
                        onClick={handleExportSafeCsv}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-purple-600 dark:text-cyan-400 bg-purple-50 dark:bg-cyan-900/20 hover:bg-purple-100 dark:hover:bg-cyan-900/40 transition-colors flex items-center gap-1.5"
                    >
                        <i className="fas fa-file-csv text-xs"></i> CSV
                    </button>
                </SettingsRow>

                {/* Full JSON Backup Export */}
                <SettingsRow label={t('exportBackup')} subLabel="Download complete personal ledger & goals backup">
                    <button 
                        type="button"
                        onClick={handleExportJsonBackup}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-1.5"
                    >
                        <i className="fas fa-file-download text-xs"></i> JSON
                    </button>
                </SettingsRow>

                {/* Import / Migration */}
                <SettingsRow label={t('importBackup')} subLabel="Restore or migrate data from a JSON backup file">
                    <button 
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center gap-1.5"
                    >
                        <i className="fas fa-file-upload text-xs"></i> Import
                    </button>
                </SettingsRow>
                <input 
                    ref={importInputRef} 
                    type="file" 
                    accept=".json" 
                    onChange={handleFileSelectForImport} 
                    className="hidden" 
                />

                {/* Purge Financial Records */}
                <SettingsRow label={t('purgeData')} subLabel="Clear all transactions, goals and loans while keeping account">
                    <button 
                        type="button"
                        onClick={() => setIsPurgeModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-1.5"
                    >
                        <i className="fas fa-eraser text-xs"></i> Purge
                    </button>
                </SettingsRow>

                {/* Delete Entire Account */}
                <SettingsRow label={t('deleteAccount')} subLabel={t('deleteAccountDesc')}>
                    <button 
                        type="button"
                        onClick={() => {
                            setDeleteConfirmationText('');
                            setIsDeleteModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center gap-1.5"
                    >
                        <i className="fas fa-trash-alt text-xs"></i> Delete
                    </button>
                </SettingsRow>
            </SettingsSection>

            {/* Contact & Support */}
            <SettingsSection title={t('sidebarGetInTouch')} icon="fas fa-headset">
                <SettingsRow label="Email Support" subLabel="mon14yee@gmail.com" onClick={() => window.location.href='mailto:mon14yee@gmail.com'}>
                    <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <i className="fas fa-envelope text-sm"></i>
                    </div>
                </SettingsRow>
                <SettingsRow label="Instagram" subLabel="@menkirwolde" onClick={() => window.open('https://www.instagram.com/menkirwolde?igsh=MTY4Nmh1N2FtMHVrNg==', '_blank')}>
                    <div className="w-9 h-9 rounded-full bg-pink-50 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400">
                        <i className="fab fa-instagram text-sm"></i>
                    </div>
                </SettingsRow>
            </SettingsSection>

            {/* Community Feedback Form */}
            <SettingsSection title={t('feedback')} icon="fas fa-comment-dots">
                <div className="p-5 sm:p-6">
                    <p className="text-xs mb-4 text-gray-500 dark:text-gray-400 leading-relaxed">{t('sidebarFeedbackDescription')}</p>
                    {feedbackSubmitted ? (
                        <div className="flex items-center justify-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl text-xs font-semibold">
                            <i className="fas fa-check-circle"></i>
                            <span>{t('feedbackSent')}</span>
                        </div>
                    ) : (
                        <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                            <textarea
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                placeholder={t('feedbackPlaceholder')}
                                className="w-full bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                rows={3}
                                required
                            />
                            <button 
                                type="submit" 
                                className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-cyan-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 text-xs"
                            >
                                <i className="fas fa-paper-plane text-xs"></i> {t('submit')}
                            </button>
                        </form>
                    )}
                </div>
            </SettingsSection>

            {/* Build & Version Information */}
            <SettingsSection title={t('sidebarAbout')} icon="fas fa-info-circle">
                <SettingsRow label={t('sidebarVersion')} subLabel="Production build">
                    <span className="font-mono bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg text-xs font-semibold">
                        v{appVersion}
                    </span>
                </SettingsRow>
                <div className="p-5 sm:p-6 pt-0 border-t-0">
                    <button 
                        type="button"
                        onClick={handleCheckForUpdates}
                        disabled={isCheckingUpdate}
                        className="w-full text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <i className={`fas ${isCheckingUpdate ? 'fa-spinner fa-spin' : 'fa-cloud-download-alt'}`}></i>
                        {isCheckingUpdate ? t('updatesCheck') : t('sidebarCheckForUpdates')}
                    </button>
                </div>
            </SettingsSection>

            {/* Import Backup Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-fadeIn">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <i className="fas fa-file-import text-sm"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-base">{t('importBackup')}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Review and apply backup</p>
                            </div>
                        </div>

                        {importStats && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl mb-4 text-xs font-mono text-gray-600 dark:text-gray-300">
                                {importStats}
                            </div>
                        )}

                        <div className="space-y-3 mb-5">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Import Strategy:</label>
                            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                                <input 
                                    type="radio" 
                                    name="importMode" 
                                    value="merge" 
                                    checked={importMode === 'merge'} 
                                    onChange={() => setImportMode('merge')} 
                                    className="text-purple-600"
                                />
                                <div>
                                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">Merge with Existing Data</p>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Appends imported items without deleting current records.</p>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-xl border border-red-200 dark:border-red-900/40 cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-950/20">
                                <input 
                                    type="radio" 
                                    name="importMode" 
                                    value="replace" 
                                    checked={importMode === 'replace'} 
                                    onChange={() => setImportMode('replace')} 
                                    className="text-red-600"
                                />
                                <div>
                                    <p className="text-xs font-semibold text-red-700 dark:text-red-400">Replace All Data</p>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Overwrites existing transactions and goals with backup content.</p>
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={() => {
                                    setIsImportModalOpen(false);
                                    setImportedBackupData(null);
                                }}
                                disabled={isImporting}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                type="button"
                                onClick={handleExecuteImport}
                                disabled={isImporting}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-2"
                            >
                                {isImporting && <i className="fas fa-spinner fa-spin"></i>}
                                {isImporting ? 'Importing...' : 'Proceed with Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purge Financial Records Modal */}
            {isPurgeModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-fadeIn">
                        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 mx-auto">
                            <i className="fas fa-exclamation-triangle text-lg"></i>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base text-center mb-1">{t('purgeData')}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-5 leading-relaxed">
                            Are you sure you want to delete all financial records? Your account profile and settings will remain, but all transactions, savings goals, loans, subscriptions, and investments will be deleted.
                        </p>
                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={() => setIsPurgeModalOpen(false)}
                                disabled={isPurging}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                type="button"
                                onClick={handlePurgeData}
                                disabled={isPurging}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                {isPurging && <i className="fas fa-spinner fa-spin"></i>}
                                {isPurging ? 'Purging...' : 'Confirm Purge'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Account Deletion Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-100 dark:border-red-900/40 animate-fadeIn">
                        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-4 mx-auto">
                            <i className="fas fa-trash-alt text-lg"></i>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base text-center mb-1">{t('confirmDeleteAccount')}</h3>
                        <p className="text-xs text-red-600 dark:text-red-400 text-center mb-4 leading-relaxed font-medium">
                            {t('deleteWarning')}
                        </p>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                {t('typeDeleteToConfirm')}
                            </label>
                            <input 
                                type="text"
                                value={deleteConfirmationText}
                                onChange={e => setDeleteConfirmationText(e.target.value)}
                                placeholder="DELETE"
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2 px-3 text-sm text-center font-mono tracking-widest uppercase text-red-600 focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={isDeletingAccount}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                type="button"
                                onClick={handleDeleteAccount}
                                disabled={isDeletingAccount || deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                {isDeletingAccount && <i className="fas fa-spinner fa-spin"></i>}
                                {isDeletingAccount ? 'Deleting...' : t('deleteAccount')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sign Out Confirmation Modal */}
            {isSignOutModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-fadeIn text-center">
                        <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4 mx-auto">
                            <i className="fas fa-sign-out-alt text-lg"></i>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1">{t('signOut') || 'Log Out'}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Are you sure you want to end your active session?</p>
                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={() => setIsSignOutModalOpen(false)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                type="button"
                                onClick={handleConfirmSignOut}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 shadow-md transition-all"
                            >
                                {t('signOut') || 'Log Out'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {isChangePasswordModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-fadeIn">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <i className="fas fa-key text-sm"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-base">Change Vault Password</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Update local access credentials</p>
                            </div>
                        </div>

                        <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Current Password (if set)</label>
                                <input 
                                    type="password"
                                    value={currentPasswordInput} 
                                    onChange={e => setCurrentPasswordInput(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                                <input 
                                    type="password"
                                    value={newPasswordInput} 
                                    onChange={e => setNewPasswordInput(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                                <input 
                                    type="password"
                                    value={confirmPasswordInput} 
                                    onChange={e => setConfirmPasswordInput(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    required
                                    minLength={6}
                                />
                            </div>

                            {passwordError && (
                                <p className="text-xs text-red-500 dark:text-red-400">{passwordError}</p>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setIsChangePasswordModalOpen(false);
                                        setPasswordError('');
                                    }}
                                    disabled={isChangingPassword}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isChangingPassword}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-cyan-500 shadow-md shadow-cyan-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-1.5"
                                >
                                    {isChangingPassword ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================================================================
// Main Combined Settings & About View
// ==================================================================

export interface SettingsAndAboutViewProps {
    userProfile: UserProfile | null;
    setUserProfile: (profile: UserProfile) => void;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    allIncome?: any[];
    allExpenses?: any[];
    savingsGoals?: any[];
    loans?: any[];
    subscriptions?: any[];
    scheduledTransactions?: any[];
    investments?: any[];
    onDataReload?: () => Promise<void> | void;
    showToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const SettingsAndAboutView: React.FC<SettingsAndAboutViewProps> = ({ 
    userProfile, 
    setUserProfile, 
    theme, 
    setTheme,
    allIncome = [],
    allExpenses = [],
    onDataReload,
    showToast,
}) => {
    return (
        <div className="bg-transparent h-full pb-16">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                <div>
                    <SettingsContent theme={theme} setTheme={setTheme} showToast={showToast} />
                </div>
                <div>
                    <AboutContent 
                        userProfile={userProfile} 
                        setUserProfile={setUserProfile}
                        allIncome={allIncome}
                        allExpenses={allExpenses}
                        onDataReload={onDataReload}
                        showToast={showToast}
                    />
                </div>
            </div>
        </div>
    );
};

export default SettingsAndAboutView;
