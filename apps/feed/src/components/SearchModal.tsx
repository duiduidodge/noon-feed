'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, TrendingUp, TrendingDown, Minus, ExternalLink, Zap, Flame, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  id: string;
  url: string;
  titleOriginal: string;
  titleTh?: string;
  summaryTh?: string;
  publishedAt: string;
  source: string;
  tags: string[];
  sentiment?: string;
  marketImpact?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Arrow key navigation
  useEffect(() => {
    const handleKeyNav = (e: KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleResultClick(results[selectedIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, [isOpen, results, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      selectedEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
        const data = await response.json();
        setResults(data.items || []);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleResultClick = useCallback((result: SearchResult) => {
    window.open(result.url, '_blank', 'noopener,noreferrer');
    onClose();
  }, [onClose]);

  const getSentimentIcon = (sentiment?: string) => {
    if (sentiment === 'bullish') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (sentiment === 'bearish') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getImpactIcon = (impact?: string) => {
    if (impact === 'high') return <Flame className="w-4 h-4 text-orange-400" />;
    if (impact === 'medium') return <Zap className="w-4 h-4 text-yellow-400" />;
    return <FileText className="w-4 h-4 text-gray-500" />;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]">
        {/* Backdrop with scanlines */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/90 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Scanline effect */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
            <div className="h-full w-full bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(34,197,94,0.3)_2px,rgba(34,197,94,0.3)_4px)]" />
          </div>
        </motion.div>

        {/* Search Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 rounded-2xl blur-xl" />

          {/* Main container */}
          <div className="relative bg-gray-950 border border-green-500/30 rounded-2xl shadow-2xl overflow-hidden">
            {/* Terminal header bar */}
            <div className="h-8 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-green-500/20 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-green-400/60 font-mono">search.terminal</span>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-green-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search input */}
            <div className="p-6 pb-4 border-b border-green-500/10">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="// Search crypto intel... (English or Thai)"
                  className="w-full pl-12 pr-4 py-4 bg-gray-900/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all font-mono text-sm"
                  spellCheck={false}
                />
                {loading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Keyboard hints */}
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 font-mono">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400">↓</kbd>
                  <span>navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400">↵</kbd>
                  <span>open</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400">esc</kbd>
                  <span>close</span>
                </div>
              </div>
            </div>

            {/* Results */}
            <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {query.length < 2 ? (
                <div className="p-12 text-center">
                  <Search className="w-12 h-12 text-green-400/30 mx-auto mb-4" />
                  <p className="text-gray-500 font-mono text-sm">
                    Type at least 2 characters to search...
                  </p>
                </div>
              ) : loading ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-green-400/30 border-t-green-400 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-500 font-mono text-sm animate-pulse">
                    Scanning database...
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="p-12 text-center">
                  <X className="w-12 h-12 text-red-400/30 mx-auto mb-4" />
                  <p className="text-gray-500 font-mono text-sm">
                    No results found for &quot;{query}&quot;
                  </p>
                  <p className="text-gray-600 text-xs mt-2">
                    Try different keywords
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-green-500/5">
                  {results.map((result, index) => (
                    <motion.button
                      key={result.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleResultClick(result)}
                      className={`w-full text-left p-4 transition-all group ${
                        index === selectedIndex
                          ? 'bg-green-500/10 border-l-2 border-green-400'
                          : 'hover:bg-green-500/5 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Impact indicator */}
                        <div className="flex-shrink-0 mt-1">
                          {getImpactIcon(result.marketImpact)}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <div className="flex items-start gap-2 mb-1">
                            <h3 className="font-medium text-white group-hover:text-green-400 transition-colors line-clamp-2 flex-1">
                              {result.titleTh || result.titleOriginal}
                            </h3>
                            <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-green-400 flex-shrink-0 mt-0.5" />
                          </div>

                          {/* Summary */}
                          {result.summaryTh && (
                            <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                              {result.summaryTh}
                            </p>
                          )}

                          {/* Meta */}
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="text-green-400/60 font-mono">
                              {result.source}
                            </span>

                            {result.sentiment && (
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-800/50 rounded border border-gray-700">
                                {getSentimentIcon(result.sentiment)}
                                <span className={
                                  result.sentiment === 'bullish' ? 'text-green-400' :
                                  result.sentiment === 'bearish' ? 'text-red-400' :
                                  'text-gray-400'
                                }>
                                  {result.sentiment}
                                </span>
                              </div>
                            )}

                            {result.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-gray-800/30 text-gray-500 rounded border border-gray-700/50 font-mono"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {results.length > 0 && (
              <div className="p-3 bg-gray-900/50 border-t border-green-500/10">
                <p className="text-xs text-gray-600 text-center font-mono">
                  Found {results.length} result{results.length !== 1 ? 's' : ''} • Press ↵ to open selected
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
