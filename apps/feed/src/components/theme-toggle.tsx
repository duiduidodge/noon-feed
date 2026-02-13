'use client';

import { useTheme } from './theme-provider';
import { Sun, Moon } from 'lucide-react';
import { useState, useCallback } from 'react';

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const [bursting, setBursting] = useState(false);

    const handleToggle = useCallback(() => {
        setBursting(true);
        toggleTheme();
        // Remove burst class after animation completes
        setTimeout(() => setBursting(false), 600);
    }, [toggleTheme]);

    return (
        <button
            onClick={handleToggle}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface/60 transition-all duration-200 overflow-hidden"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            {/* Burst ring animation */}
            {bursting && (
                <span
                    className="absolute inset-0 pointer-events-none"
                    aria-hidden="true"
                >
                    <span className={`
                        absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                        w-3 h-3 rounded-full
                        animate-theme-burst
                        ${theme === 'dark'
                            ? 'bg-indigo-400/40 shadow-[0_0_16px_hsl(230,60%,65%)]'
                            : 'bg-amber-300/40 shadow-[0_0_16px_hsl(45,90%,60%)]'
                        }
                    `} />
                </span>
            )}

            {/* Sun icon */}
            <Sun
                className={`h-[18px] w-[18px] transition-all duration-300 ${theme === 'dark'
                    ? 'rotate-90 scale-0 opacity-0'
                    : 'rotate-0 scale-100 opacity-100'
                    }`}
                style={{ position: theme === 'dark' ? 'absolute' : 'static' }}
            />
            {/* Moon icon */}
            <Moon
                className={`h-[18px] w-[18px] transition-all duration-300 ${theme === 'light'
                    ? '-rotate-90 scale-0 opacity-0'
                    : 'rotate-0 scale-100 opacity-100'
                    }`}
                style={{ position: theme === 'light' ? 'absolute' : 'static' }}
            />
        </button>
    );
}
