import { supabase } from '@/lib/supabase';

export const TRIP_BUILTY_BUCKET = 'trip-builty';

const MAX_BUILTY_BYTES = 10 * 1024 * 1024;

const ALLOWED_BUILTY_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export function validateBuiltyFile(file: File): void {
  if (!ALLOWED_BUILTY_TYPES.has(file.type)) {
    throw new Error('Builty must be a JPEG, PNG, or WebP image');
  }
  if (file.size > MAX_BUILTY_BYTES) {
    throw new Error('Builty image must be under 10 MB');
  }
}

function builtyExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export function builtyStoragePath(tripId: number, file: File): string {
  return `${tripId}/${Date.now()}.${builtyExtension(file)}`;
}

export function builtyPathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${TRIP_BUILTY_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

export async function uploadTripBuilty(tripId: number, file: File): Promise<string> {
  validateBuiltyFile(file);
  const path = builtyStoragePath(tripId, file);
  const { error } = await supabase.storage
    .from(TRIP_BUILTY_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(TRIP_BUILTY_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function removeTripBuiltyByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const path = builtyPathFromPublicUrl(url);
  if (!path) return;
  const { error } = await supabase.storage.from(TRIP_BUILTY_BUCKET).remove([path]);
  if (error) throw error;
}
