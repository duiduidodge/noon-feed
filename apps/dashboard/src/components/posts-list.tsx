'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import Image from 'next/image';
import { PostFormModal } from './post-form-modal';

interface UserPost {
  id: string;
  content: string;
  imageUrl: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PostsListProps {
  posts: UserPost[];
}

export function PostsList({ posts }: PostsListProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<UserPost | null>(null);
  const [pendingDeletePost, setPendingDeletePost] = useState<UserPost | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Delete failed');
      }
      setFeedback('Post deleted.');
      router.refresh();
    } catch {
      setFeedback('Could not delete post. Please try again.');
    } finally {
      setDeletingId(null);
      setPendingDeletePost(null);
    }
  };

  const handleTogglePublished = async (post: UserPost) => {
    setTogglingId(post.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !post.published }),
      });

      if (!response.ok) {
        throw new Error('Toggle failed');
      }

      setFeedback(post.published ? 'Post moved to draft.' : 'Post published.');
      router.refresh();
    } catch {
      setFeedback('Could not update post status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    setEditingPost(null);
    setFeedback('Post saved.');
    router.refresh();
  };

  return (
    <>
      {feedback && (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm" role="status">
          {feedback}
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => {
            setEditingPost(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create New Post
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <ImageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No posts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first post to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="overflow-hidden rounded-lg border bg-card"
            >
              {post.imageUrl ? (
                <Image
                  src={post.imageUrl}
                  alt="Post image"
                  width={640}
                  height={384}
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="flex h-32 items-center justify-center bg-muted">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}

              <div className="p-4">
                <p className="line-clamp-3 text-sm">{post.content}</p>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(post.createdAt), 'MMM d, yyyy')}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        post.published
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {post.published ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePublished(post)}
                      disabled={togglingId === post.id}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                      title={post.published ? 'Unpublish' : 'Publish'}
                      aria-label={post.published ? 'Unpublish post' : 'Publish post'}
                    >
                      {togglingId === post.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : post.published ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setEditingPost(post);
                        setShowModal(true);
                      }}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Edit"
                      aria-label="Edit post"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => setPendingDeletePost(post)}
                      disabled={deletingId === post.id}
                      className="rounded p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
                      title="Delete"
                      aria-label="Delete post"
                    >
                      {deletingId === post.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PostFormModal
          post={editingPost}
          onClose={() => {
            setShowModal(false);
            setEditingPost(null);
          }}
          onSuccess={handleModalSuccess}
        />
      )}

      {pendingDeletePost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-background p-5">
            <h3 className="text-lg font-semibold">Delete post?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingDeletePost(null)}
                className="rounded-md border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(pendingDeletePost.id)}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
