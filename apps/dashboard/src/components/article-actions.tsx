'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Copy, Check, Loader2, Sparkles } from 'lucide-react';

interface ArticleActionsProps {
  articleId: string;
}

export function ArticleActions({ articleId }: ArticleActionsProps) {
  const router = useRouter();
  const [posting, setPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handlePostToDiscord = async () => {
    setPosting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/articles/${articleId}/post`, {
        method: 'POST',
      });

      if (response.ok) {
        setPostSuccess(true);
        setTimeout(() => setPostSuccess(false), 3000);
        setMessage('Posted to Discord.');
      } else {
        setMessage('Unable to post this article.');
      }
    } catch {
      setMessage('Unable to post this article.');
    } finally {
      setPosting(false);
    }
  };

  const handleCopyContent = async () => {
    setMessage(null);
    try {
      const response = await fetch(`/api/articles/${articleId}`);
      const article = await response.json();

      if (article.enrichment?.contentDraftTh) {
        await navigator.clipboard.writeText(article.enrichment.contentDraftTh as string);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        setMessage('Content copied to clipboard.');
      } else {
        setMessage('No draft content available to copy.');
      }
    } catch {
      setMessage('Copy failed. Please retry.');
    }
  };

  const handleGenerateContent = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/articles/${articleId}/generate-content`, {
        method: 'POST',
      });

      if (response.ok) {
        setGenerated(true);
        setTimeout(() => setGenerated(false), 3000);
        setMessage('Content generated successfully.');
        router.refresh();
      } else {
        setMessage('Unable to generate content.');
      }
    } catch {
      setMessage('Unable to generate content.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {message && (
        <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm" role="status">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handlePostToDiscord}
          disabled={posting || postSuccess}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {posting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : postSuccess ? (
            <Check className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {postSuccess ? 'Posted!' : 'Post to Discord'}
        </button>

        <button
          onClick={handleGenerateContent}
          disabled={generating || generated}
          className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : generated ? (
            <Check className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generated ? 'Generated!' : 'Generate Content'}
        </button>

        <button
          onClick={handleCopyContent}
          className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy Content'}
        </button>
      </div>
    </div>
  );
}
