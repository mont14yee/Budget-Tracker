import { generateId } from '../constants';
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getActiveSessionToken } from '../services/localAuthService';

interface ChatbotProps {
    isOpen: boolean;
    onClose: () => void;
    financialContext?: {
        totalIncome: number;
        totalExpenses: number;
        netBalance: number;
        recentTransactions?: { name: string; amount: number; type: string }[];
    };
}

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
}

const QUICK_PROMPTS = [
    { label: 'Spending summary', query: 'Give me a brief summary of my total spending and top expense categories.' },
    { label: 'Budget advice', query: 'Based on my recorded income and expenses, what are 2 practical ways I can budget better?' },
    { label: 'Savings progress', query: 'How am I doing on my savings goals, and what can I do to reach them faster?' },
    { label: 'Subscription review', query: 'Give me insights into my recurring subscriptions and where I could save.' },
    { label: 'Categorize expense', query: 'Help me categorize an expense: where should I put a membership or subscription fee?' },
    { label: 'Spending trends', query: 'Explain my financial trends this month compared to previous months.' },
];

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onClose, financialContext }) => {
    const { t } = useLanguage();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setMessages([
                {
                    id: generateId(),
                    text: t('chatbotWelcome') || "Hello! I'm your Wallet personal finance assistant. I can help with spending summaries, budget explanations, savings progress, subscription insights, and categorization. How can I help you today?",
                    sender: 'bot'
                }
            ]);
        } else {
            setMessages([]);
            setInput('');
            setIsLoading(false);
            setError(null);
        }
    }, [isOpen, t]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    
    const sendMessage = async (textToSend: string) => {
        const trimmed = textToSend.trim();
        if (!trimmed || isLoading) return;

        // Retrieve active local session token
        const token = getActiveSessionToken();
        if (!token) {
            setError('Please sign in to your Wallet account to chat with the AI assistant.');
            return;
        }

        const contextData = financialContext ? {
            totalIncome: financialContext.totalIncome,
            totalExpenses: financialContext.totalExpenses,
            netBalance: financialContext.netBalance,
        } : null;

        const userMessage: Message = { id: generateId(), text: trimmed, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

            const response = await fetch('/api/chat', {
                signal: controller.signal,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                method: 'POST',
                body: JSON.stringify({
                    messages: messages.slice(-10),
                    input: trimmed,
                    contextData,
                }),
            });
            clearTimeout(timeoutId);

            if (response.status === 401) {
                throw new Error('Your session expired. Please sign in again to use the assistant.');
            }
            if (response.status === 429) {
                throw new Error('AI rate limit reached. Please wait a moment before sending another message.');
            }
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Unable to connect to AI assistant service.');
            }

            const data = await response.json();
            const botMessage: Message = { id: generateId(), text: data.text, sender: 'bot' };
            setMessages(prev => [...prev, botMessage]);
        } catch (err: any) {
            console.error("Gemini API error:", err);
            let errMsg = 'Failed to generate response. Please try again.';
            if (err.name === 'AbortError') errMsg = 'Request timed out. Please try again.';
            else if (err.message) errMsg = err.message;
            setError(errMsg);
            const errorMessage: Message = { id: generateId(), text: errMsg, sender: 'bot' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 w-[92vw] max-w-md h-[75vh] max-h-[560px] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl flex flex-col z-50 animate-fadeIn border border-gray-200 dark:border-gray-800 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="chatbot-title">
            {/* Header */}
            <header className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex-shrink-0 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-500 to-cyan-400 flex items-center justify-center text-white shadow-sm">
                        <i className="fas fa-robot text-sm"></i>
                    </div>
                    <div>
                        <h2 id="chatbot-title" className="font-bold text-sm tracking-tight">{t('financialAssistant') || 'Wallet AI Assistant'}</h2>
                        <p className="text-[10px] text-cyan-300 font-medium">Educational Personal Finance Guidance</p>
                    </div>
                </div>
                <button 
                    onClick={onClose} 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors" 
                    aria-label="Close chat"
                >
                    <i className="fas fa-times text-sm"></i>
                </button>
            </header>
            
            {/* Chat Body */}
            <main className="flex-1 p-4 overflow-y-auto space-y-4">
                {/* Disclaimer Banner */}
                <div className="text-[11px] p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 leading-snug">
                    <i className="fas fa-shield-alt mr-1.5 text-amber-600 dark:text-amber-400"></i>
                    <strong>Notice:</strong> General educational budgeting guidance only. Not regulated investment or financial advice.
                </div>

                {/* Messages */}
                {messages.map(msg => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                        {msg.sender === 'bot' && (
                            <div className="w-7 h-7 rounded-xl bg-slate-700 text-white flex items-center justify-center text-xs flex-shrink-0">
                                <i className="fas fa-robot"></i>
                            </div>
                        )}
                        <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            msg.sender === 'user' 
                                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-br-sm shadow-sm' 
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-200/60 dark:border-gray-700/60'
                        }`}>
                            <p>
                                {msg.text.split('\n').map((line, i, arr) => (
                                    <React.Fragment key={i}>
                                        {line}
                                        {i < arr.length - 1 && <br />}
                                    </React.Fragment>
                                ))}
                            </p>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex items-end gap-2">
                        <div className="w-7 h-7 rounded-xl bg-slate-700 text-white flex items-center justify-center text-xs flex-shrink-0">
                            <i className="fas fa-robot"></i>
                        </div>
                        <div className="max-w-[80%] p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-200/60 dark:border-gray-700/60">
                            <div className="flex gap-1.5 items-center py-1">
                                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-0"></span>
                                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                            </div>
                        </div>
                    </div>
                )}

                {error && !isLoading && (
                    <div className="text-center p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs">
                        {error}
                    </div>
                )}

                {/* Quick Prompts Carousel (only when messages count is low or at start) */}
                {messages.length <= 2 && !isLoading && (
                    <div className="pt-2 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">
                            Suggested Topics
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {QUICK_PROMPTS.map((qp, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => sendMessage(qp.query)}
                                    className="text-xs px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-700/60 text-left"
                                >
                                    {qp.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </main>

            {/* Input Footer */}
            <footer className="p-3 bg-gray-50/80 dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
                <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder={t('typeYourMessage') || "Ask about spending, savings, trends..."}
                        className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                        disabled={isLoading}
                        maxLength={1000}
                        aria-label="Chat input"
                    />
                    <button 
                        type="submit" 
                        className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex-shrink-0 active:scale-95" 
                        disabled={isLoading || !input.trim()} 
                        aria-label="Send message"
                    >
                        <i className="fas fa-paper-plane text-xs"></i>
                    </button>
                </form>
            </footer>
        </div>
    );
};

export default Chatbot;
