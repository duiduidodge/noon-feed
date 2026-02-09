import { formatTimeAgo } from '@/lib/utils';
import Image from 'next/image';

export interface UserPostItem {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

interface PostCardProps {
  post: UserPostItem;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <div className="border-b border-border/30 px-4 py-3">
      {post.imageUrl && (
        <div className="relative mb-2 overflow-hidden rounded-md">
          <Image
            src={post.imageUrl}
            alt=""
            width={640}
            height={256}
            className="h-40 w-full object-cover"
          />
          {/* Gradient fade at bottom of image */}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
        </div>
      )}

      <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
        {post.content}
      </p>

      <span className="mt-1.5 block font-mono-data text-[10px] text-muted-foreground/50">
        {formatTimeAgo(post.createdAt)}
      </span>
    </div>
  );
}
