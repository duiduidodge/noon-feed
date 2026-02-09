import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

const DEFAULT_BUCKET = 'Image';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename: timestamp-randomhex.ext
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `posts/${filename}`;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;

    const supabase = getSupabase();

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      return NextResponse.json(
        { error: `Upload failed (${bucket}): ${error.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return NextResponse.json({
      url: urlData.publicUrl,
      path,
      bucket,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: `Failed to upload image: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
