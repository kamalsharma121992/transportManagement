import { supabase } from '@/lib/supabase';

export const EXPENSE_IMAGE_BUCKET = 'expense-images';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export function validateExpenseImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Expense image must be a JPEG, PNG, or WebP');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Expense image must be under 10 MB');
  }
}

function imageExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export function expenseImageStoragePath(expenseId: number, file: File, index = 0): string {
  return `${expenseId}/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}.${imageExtension(file)}`;
}

export function expenseImagePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${EXPENSE_IMAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

export async function uploadExpenseImage(expenseId: number, file: File, index = 0): Promise<string> {
  validateExpenseImageFile(file);
  const path = expenseImageStoragePath(expenseId, file, index);
  const { error } = await supabase.storage
    .from(EXPENSE_IMAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(EXPENSE_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadExpenseImageMany(expenseId: number, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    urls.push(await uploadExpenseImage(expenseId, files[i], i));
  }
  return urls;
}

export async function removeExpenseImageByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const path = expenseImagePathFromPublicUrl(url);
  if (!path) return;
  const { error } = await supabase.storage.from(EXPENSE_IMAGE_BUCKET).remove([path]);
  if (error) throw error;
}

export async function removeExpenseImageMany(urls: string[]): Promise<void> {
  for (const url of urls) {
    try {
      await removeExpenseImageByUrl(url);
    } catch {
      // continue deleting remaining files
    }
  }
}
