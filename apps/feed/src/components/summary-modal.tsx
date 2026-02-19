'use client';

import { X, Calendar, Clock, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils'; // Make sure this path is correct

interface SummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    title: string;
    date: string;
}

export function SummaryModal({ isOpen, onClose, children, title, date }: SummaryModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-background/80 backdrop-blur-md"
                    onClick={onClose}
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-3xl max-h-[85vh] flex flex-col z-[101] bg-card border border-border/40 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-border/10"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between p-6 pb-4 border-b border-border/10">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-mono-data text-muted-foreground/70 uppercase tracking-widest">
                                <Calendar className="w-3 h-3" />
                                {date}
                            </div>
                            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                                {title}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-surface/50 text-muted-foreground transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-6">
                        {children}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border/10 bg-surface/30 flex justify-end">
                        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface hover:bg-surface/80 text-xs font-medium text-foreground transition-colors">
                            <Share2 className="w-3.5 h-3.5" />
                            Share Briefing
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
