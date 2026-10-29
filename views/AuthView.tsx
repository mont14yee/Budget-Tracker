import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface AuthViewProps {
    theme: 'light' | 'dark';
}

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

const AuthView: React.FC<AuthViewProps> = ({ theme }) => {
    const {
        hasExistingAccounts,
        signIn,
        signUp,
        resetPasswordWithRecoveryKey,
    } = useAuth();
    const { t, language, setLanguage } = useLanguage();

    // Default to 'signUp' on first-run (when no local accounts exist), otherwise 'signIn'
    const [mode, setMode] = useState<AuthMode>(hasExistingAccounts ? 'signIn' : 'signUp');
    
    // Sync mode with account existence if state loads
    useEffect(() => {
        if (!hasExistingAccounts) {
            setMode('signUp');
        }
    }, [hasExistingAccounts]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [recoveryKeyInput, setRecoveryKeyInput] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Newly generated recovery key presentation upon registration
    const [createdRecoveryKey, setCreatedRecoveryKey] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState(false);

    const handleModeChange = (newMode: AuthMode) => {
        setMode(newMode);
        setErrorMessage(null);
        setSuccessMessage(null);
        setPassword('');
        setConfirmPassword('');
        setRecoveryKeyInput('');
        setCreatedRecoveryKey(null);
    };

    const mapAuthError = (err: any): string => {
        if (!err) return 'An unexpected error occurred.';
        const msg: string = err.message || String(err);
        if (msg.includes('Incorrect email or password')) {
            return 'Incorrect email or password. Please verify your credentials and try again.';
        }
        if (msg.includes('already exists')) {
            return 'An account with this email already exists on this device. Please sign in instead.';
        }
        if (msg.includes('Password must be at least')) {
            return 'Password must be at least 6 characters long.';
        }
        if (msg.includes('recovery key provided is invalid')) {
            return 'The recovery key provided does not match this account. Please verify your 12-character key.';
        }
        return msg;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        if (mode === 'signUp' || mode === 'forgotPassword') {
            if (password !== confirmPassword) {
                setErrorMessage(t('passwordsDoNotMatch'));
                return;
            }
        }

        setIsLoading(true);

        try {
            if (mode === 'signIn') {
                const { error } = await signIn(email, password);
                if (error) {
                    setErrorMessage(mapAuthError(error));
                }
            } else if (mode === 'signUp') {
                const { data, error } = await signUp(email, password, fullName);
                if (error) {
                    setErrorMessage(mapAuthError(error));
                } else if (data?.recoveryKey) {
                    // Show one-time local recovery key to user
                    setCreatedRecoveryKey(data.recoveryKey);
                }
            } else if (mode === 'forgotPassword') {
                if (!recoveryKeyInput.trim()) {
                    setErrorMessage('Please enter your Local Recovery Key.');
                    setIsLoading(false);
                    return;
                }
                const { error } = await resetPasswordWithRecoveryKey(email, recoveryKeyInput, password);
                if (error) {
                    setErrorMessage(mapAuthError(error));
                } else {
                    setSuccessMessage(t('passwordUpdatedSuccess'));
                    setPassword('');
                    setConfirmPassword('');
                    setRecoveryKeyInput('');
                    setTimeout(() => {
                        handleModeChange('signIn');
                    }, 2500);
                }
            }
        } catch (err: any) {
            setErrorMessage(mapAuthError(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyKey = () => {
        if (!createdRecoveryKey) return;
        navigator.clipboard.writeText(createdRecoveryKey);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2500);
    };

    return (
        <div
            id="auth-view-container"
            className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden transition-colors duration-300 ${
                theme === 'dark' ? 'dark bg-[#0b0f19] text-white' : 'bg-[#fcfdfd] text-gray-900'
            }`}
        >
            {/* Ambient Background Glows */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
                {theme === 'light' ? (
                    <>
                        <div className="absolute -bottom-[15%] -left-[20%] w-[80%] h-[50%] rounded-full bg-[#7dd3fc]/30 blur-[100px]" />
                        <div className="absolute -bottom-[10%] -right-[20%] w-[80%] h-[60%] rounded-full bg-[#d8b4fe]/20 blur-[120px]" />
                        <div className="absolute top-[10%] right-[10%] w-[40%] h-[30%] rounded-full bg-[#a5f3fc]/20 blur-[90px]" />
                    </>
                ) : (
                    <>
                        <div className="absolute -bottom-[15%] -left-[20%] w-[80%] h-[50%] rounded-full bg-[#0284c7]/20 blur-[120px]" />
                        <div className="absolute -bottom-[10%] -right-[20%] w-[80%] h-[60%] rounded-full bg-[#a21caf]/15 blur-[120px]" />
                        <div className="absolute top-[10%] right-[10%] w-[40%] h-[30%] rounded-full bg-[#0284c7]/10 blur-[90px]" />
                    </>
                )}
            </div>

            <div
                id="auth-card"
                className="w-full max-w-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/60 dark:border-gray-700/50 relative z-10"
            >
                {/* Language Switcher */}
                <div className="flex justify-between items-center mb-4">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-2.5 py-1 rounded-full border border-cyan-200/50 dark:border-cyan-800/40 flex items-center gap-1.5">
                        <i className="fas fa-shield-alt text-[10px]" aria-hidden="true"></i>
                        Local-First
                    </span>
                    <div
                        className="inline-flex bg-gray-100/70 dark:bg-gray-900/60 rounded-xl p-1 border border-gray-200/50 dark:border-gray-700/50"
                        role="group"
                        aria-label="Language selection"
                    >
                        <button
                            id="lang-btn-en"
                            type="button"
                            onClick={() => setLanguage('en')}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                                language === 'en'
                                    ? 'bg-white dark:bg-gray-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                            aria-pressed={language === 'en'}
                        >
                            EN
                        </button>
                        <button
                            id="lang-btn-am"
                            type="button"
                            onClick={() => setLanguage('am')}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                                language === 'am'
                                    ? 'bg-white dark:bg-gray-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                            aria-pressed={language === 'am'}
                        >
                            አማ
                        </button>
                    </div>
                </div>

                {/* Brand Header */}
                <div className="flex flex-col items-center mb-6 text-center">
                    <div
                        className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-3 transform rotate-3"
                        aria-hidden="true"
                    >
                        <i className="fas fa-wallet text-3xl text-white -rotate-3"></i>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        {mode === 'signIn' && t('welcomeBack')}
                        {mode === 'signUp' && (hasExistingAccounts ? t('createAccount') : t('createWalletAccount'))}
                        {mode === 'forgotPassword' && t('localDeviceRecovery')}
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs leading-relaxed">
                        {mode === 'signIn' && t('enterDetailsToAccess')}
                        {mode === 'signUp' && t('localAccountSecurityNotice')}
                        {mode === 'forgotPassword' && 'Reset your password using your on-device Recovery Key.'}
                    </p>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                    <div
                        className="mb-6 p-4 bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800/50 rounded-2xl flex items-start gap-3"
                        role="alert"
                        id="auth-error-message"
                    >
                        <i className="fas fa-exclamation-circle text-red-500 mt-0.5 flex-shrink-0" aria-hidden="true"></i>
                        <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{errorMessage}</p>
                    </div>
                )}

                {/* Success Banner */}
                {successMessage && (
                    <div
                        className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-start gap-3"
                        role="status"
                        id="auth-success-message"
                    >
                        <i className="fas fa-check-circle text-emerald-500 mt-0.5 flex-shrink-0" aria-hidden="true"></i>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">{successMessage}</p>
                    </div>
                )}

                {/* Newly Registered Recovery Key Display */}
                {createdRecoveryKey ? (
                    <div className="space-y-4 text-center animate-fadeIn" id="recovery-key-modal">
                        <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-2xl text-left">
                            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-sm mb-1">
                                <i className="fas fa-key text-purple-500" aria-hidden="true"></i>
                                {t('saveRecoveryKeyTitle')}
                            </div>
                            <p className="text-xs text-purple-900/80 dark:text-purple-300/80 leading-relaxed mb-3">
                                {t('saveRecoveryKeySubtitle')}
                            </p>
                            <div className="p-3 bg-white dark:bg-gray-900 border border-purple-300 dark:border-purple-700/60 rounded-xl flex items-center justify-between">
                                <span className="font-mono font-bold tracking-widest text-sm text-purple-700 dark:text-purple-300 select-all">
                                    {createdRecoveryKey}
                                </span>
                                <button
                                    id="btn-copy-recovery-key"
                                    type="button"
                                    onClick={handleCopyKey}
                                    className="text-xs font-semibold px-2.5 py-1.5 bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-900/80 text-purple-700 dark:text-purple-200 rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    <i className={`fas ${copiedKey ? 'fa-check' : 'fa-copy'}`} aria-hidden="true"></i>
                                    <span>{copiedKey ? t('copiedKey') : t('copyRecoveryKey')}</span>
                                </button>
                            </div>
                        </div>

                        <button
                            id="btn-continue-dashboard"
                            type="button"
                            onClick={() => {
                                // Clear recovery key display and enter dashboard with active session
                                setCreatedRecoveryKey(null);
                            }}
                            className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-semibold rounded-2xl shadow-lg shadow-cyan-500/25 active:scale-[0.98] transition-all text-sm"
                        >
                            <span>{t('continueToDashboard')}</span>
                            <i className="fas fa-arrow-right text-xs ml-1" aria-hidden="true"></i>
                        </button>
                    </div>
                ) : (
                    /* Auth Form */
                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        {/* Notice for Local Recovery */}
                        {mode === 'forgotPassword' && (
                            <div className="p-3.5 bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40 rounded-2xl flex items-start gap-2.5 text-xs text-cyan-800 dark:text-cyan-300 leading-relaxed mb-4">
                                <i className="fas fa-info-circle text-cyan-500 mt-0.5 flex-shrink-0" aria-hidden="true"></i>
                                <span>{t('localRecoveryExplanation')}</span>
                            </div>
                        )}

                        {/* Full Name for Sign Up */}
                        {mode === 'signUp' && (
                            <div>
                                <label
                                    htmlFor="auth-fullName"
                                    className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5"
                                >
                                    {t('fullName')}
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                        <i className="fas fa-user text-sm" aria-hidden="true"></i>
                                    </span>
                                    <input
                                        id="auth-fullName"
                                        type="text"
                                        autoComplete="name"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm transition-all duration-200"
                                        placeholder={t('fullNamePlaceholder')}
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Email Address */}
                        <div>
                            <label
                                htmlFor="auth-email"
                                className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5"
                            >
                                {t('emailAddress')}
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                    <i className="fas fa-envelope text-sm" aria-hidden="true"></i>
                                </span>
                                <input
                                    id="auth-email"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm transition-all duration-200"
                                    placeholder={t('emailPlaceholder')}
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Recovery Key input when recovering */}
                        {mode === 'forgotPassword' && (
                            <div>
                                <label
                                    htmlFor="auth-recoveryKey"
                                    className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5"
                                >
                                    {t('recoveryKeyLabel')}
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                        <i className="fas fa-key text-sm" aria-hidden="true"></i>
                                    </span>
                                    <input
                                        id="auth-recoveryKey"
                                        type="text"
                                        value={recoveryKeyInput}
                                        onChange={(e) => setRecoveryKeyInput(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm font-mono tracking-wider transition-all duration-200"
                                        placeholder={t('recoveryKeyPlaceholder')}
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Password Field */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label
                                    htmlFor="auth-password"
                                    className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                                >
                                    {mode === 'forgotPassword' ? t('newPassword') : t('password')}
                                </label>
                                {mode === 'signIn' && (
                                    <button
                                        id="auth-forgot-password-link"
                                        type="button"
                                        onClick={() => handleModeChange('forgotPassword')}
                                        className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                                    >
                                        {t('forgotPassword')}
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                    <i className="fas fa-lock text-sm" aria-hidden="true"></i>
                                </span>
                                <input
                                    id="auth-password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-11 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm transition-all duration-200"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                                    aria-pressed={showPassword}
                                >
                                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password for SignUp and ForgotPassword */}
                        {(mode === 'signUp' || mode === 'forgotPassword') && (
                            <div>
                                <label
                                    htmlFor="auth-confirmPassword"
                                    className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5"
                                >
                                    {t('confirmPassword')}
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                        <i className="fas fa-shield-alt text-sm" aria-hidden="true"></i>
                                    </span>
                                    <input
                                        id="auth-confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-10 pr-11 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm transition-all duration-200"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                                        aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')}
                                        aria-pressed={showConfirmPassword}
                                    >
                                        <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} aria-hidden="true"></i>
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            id="auth-submit-btn"
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-semibold rounded-2xl shadow-lg shadow-cyan-500/25 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 mt-4 text-sm"
                        >
                            {isLoading ? (
                                <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                            ) : (
                                <span>
                                    {mode === 'signIn' && t('signIn')}
                                    {mode === 'signUp' && (hasExistingAccounts ? t('createAccount') : t('createWalletAccount'))}
                                    {mode === 'forgotPassword' && t('resetPasswordOnDevice')}
                                </span>
                            )}
                            {!isLoading && <i className="fas fa-arrow-right text-xs ml-1 opacity-90" aria-hidden="true"></i>}
                        </button>
                    </form>
                )}

                {/* Footer Mode Switchers */}
                {!createdRecoveryKey && (
                    <div className="mt-6 text-center text-sm">
                        {mode === 'signIn' && (
                            <button
                                id="auth-switch-to-signup"
                                type="button"
                                onClick={() => handleModeChange('signUp')}
                                className="text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors"
                            >
                                {t('dontHaveAccount')}
                            </button>
                        )}
                        {mode === 'signUp' && hasExistingAccounts && (
                            <button
                                id="auth-switch-to-signin"
                                type="button"
                                onClick={() => handleModeChange('signIn')}
                                className="text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors"
                            >
                                {t('alreadyHaveAccount')}
                            </button>
                        )}
                        {mode === 'forgotPassword' && (
                            <div className="space-y-2">
                                <button
                                    id="auth-back-to-signin"
                                    type="button"
                                    onClick={() => handleModeChange('signIn')}
                                    className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors text-xs"
                                >
                                    <i className="fas fa-arrow-left text-[10px]" aria-hidden="true"></i>
                                    <span>{t('backToSignIn')}</span>
                                </button>
                                <div>
                                    <button
                                        id="auth-create-fresh-account"
                                        type="button"
                                        onClick={() => handleModeChange('signUp')}
                                        className="text-cyan-600 dark:text-cyan-400 hover:underline text-xs"
                                    >
                                        {t('createNewLocalAccount')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthView;
