'use client';

import { useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MAX_ENTITY_IMAGES } from '@/lib/image-urls';

export type MultiImageFieldProps = {
  label: string;
  existingUrls: string[];
  pendingPreviews: string[];
  onAddFiles: (files: File[]) => void;
  onRemoveExisting: (index: number) => void;
  onRemovePending: (index: number) => void;
  onView: (url: string) => void;
  maxCount?: number;
  hint?: string;
};

export function MultiImageField({
  label,
  existingUrls,
  pendingPreviews,
  onAddFiles,
  onRemoveExisting,
  onRemovePending,
  onView,
  maxCount = MAX_ENTITY_IMAGES,
  hint = 'JPEG, PNG, or WebP · max 10 MB each',
}: MultiImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const total = existingUrls.length + pendingPreviews.length;
  const canAdd = total < maxCount;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (list.length === 0) return;
    onAddFiles(list);
  }

  return (
    <div>
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        multiple
        onChange={handleChange}
      />
      {total > 0 ? (
        <div className="mt-1 space-y-2">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {existingUrls.map((url, index) => (
              <div key={`e-${url}-${index}`} className="relative group rounded-md border bg-gray-50 overflow-hidden">
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => onView(url)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-20 w-full object-contain" />
                </button>
                <button
                  type="button"
                  className="absolute top-1 right-1 rounded-full bg-white/90 p-0.5 text-gray-600 hover:text-red-600 shadow"
                  onClick={() => onRemoveExisting(index)}
                  aria-label="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {pendingPreviews.map((url, index) => (
              <div key={`p-${url}-${index}`} className="relative group rounded-md border border-dashed bg-gray-50 overflow-hidden">
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => onView(url)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-20 w-full object-contain" />
                </button>
                <button
                  type="button"
                  className="absolute top-1 right-1 rounded-full bg-white/90 p-0.5 text-gray-600 hover:text-red-600 shadow"
                  onClick={() => onRemovePending(index)}
                  aria-label="Remove pending image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          {canAdd && (
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1" /> Add more
            </Button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="mt-1 w-full sm:w-auto"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" /> Upload images
        </Button>
      )}
      <p className="text-[10px] text-gray-400 mt-1">
        {hint} · up to {maxCount} images{total > 0 ? ` · ${total}/${maxCount}` : ''}
      </p>
    </div>
  );
}
