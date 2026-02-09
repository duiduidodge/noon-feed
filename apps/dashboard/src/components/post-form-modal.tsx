'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Loader2, Trash2, Image as ImageIcon } from 'lucide-react';

interface PostFormModalProps {
  post?: {
    id: string;
    title: string;
    content: string;
    imageUrl: string | null;
    published: boolean;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_IMAGE_SIZE_MB = 8;

export function PostFormModal({ post, onClose, onSuccess }: PostFormModalProps) {
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [imageUrl, setImageUrl] = useState(post?.imageUrl || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    post?.imageUrl || null
  );
  const [published, setPublished] = useState(post?.published ?? true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  const validateAndSetFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setError(`Image must be smaller than ${MAX_IMAGE_SIZE_MB}MB.`);
      return;
    }

    setError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!content.trim()) {
      setError('Post body is required');
      return;
    }

    setError('');
    setSaving(true);

    try {
      let finalImageUrl = imageUrl;

      if (imageFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', imageFile);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => ({}));
          throw new Error(uploadData.error || 'Failed to upload image');
        }

        const uploadData = await uploadRes.json();
        finalImageUrl = uploadData.url;
        setUploading(false);
      }

      const endpoint = post ? `/api/posts/${post.id}` : '/api/posts';
      const method = post ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          imageUrl: finalImageUrl || null,
          published,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save post');
      }

      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close post form"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="post-modal-title" className="mb-4 text-lg font-semibold">
          {post ? 'Edit Post' : 'Create New Post'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="post-title">
              Title
            </label>
            <input
              id="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="Post title..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {title.length}/160
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="post-caption">
              Post Body
            </label>
            <textarea
              id="post-caption"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Write your post..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {content.length}/1000
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Cover Image (optional)</label>

            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-48 w-full rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white hover:bg-red-600"
                  aria-label="Remove image"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) validateAndSetFile(file);
                }}
                className={`flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed py-8 text-sm transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'text-muted-foreground hover:border-primary hover:text-foreground'
                }`}
              >
                {isDragging ? <ImageIcon className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                Click or drag image to upload
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="mt-1 text-xs text-muted-foreground">Max size: {MAX_IMAGE_SIZE_MB}MB</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="published"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            <label htmlFor="published" className="text-sm">
              Published (visible on feed)
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !content.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {uploading ? 'Uploading...' : 'Saving...'}
                </>
              ) : post ? (
                'Save Changes'
              ) : (
                'Create Post'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
