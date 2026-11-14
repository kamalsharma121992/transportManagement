'use client';

import { cn } from '@/lib/utils';

export type MultiEntryPreviewItem = {
  id: number;
  text: string;
  createdBy: string;
  createdAt: string;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Shows the latest entry in the list. When there are multiple entries,
 * hovering/focusing reveals a tooltip with the full timeline.
 */
export function MultiEntryPreview({
  entries,
  empty = '—',
  className,
}: {
  entries: MultiEntryPreviewItem[];
  empty?: string;
  className?: string;
}) {
  if (entries.length === 0) {
    return <span className={cn('text-gray-300', className)}>{empty}</span>;
  }

  const latest = entries[0];
  const multiple = entries.length > 1;

  return (
    <div className={cn('group/preview relative max-w-[220px]', className)}>
      {/* Use a div (not button) so this can sit inside card expand buttons without nested <button> hydration errors. */}
      <div
        tabIndex={multiple ? 0 : undefined}
        className={cn(
          'w-full rounded text-left text-sm text-gray-600 outline-none',
          multiple && 'cursor-help focus-visible:ring-2 focus-visible:ring-ring/40',
        )}
        aria-label={
          multiple
            ? `Latest: ${latest.text}. ${entries.length} total — show all`
            : undefined
        }
      >
        <span className="line-clamp-2">{latest.text}</span>
        {multiple && (
          <span className="mt-0.5 block text-[10px] font-medium text-gray-400">
            +{entries.length - 1} more
          </span>
        )}
      </div>

      {multiple && (
        <div
          role="tooltip"
          className={cn(
            'absolute left-0 top-full z-50 mt-1.5 w-[min(20rem,calc(100vw-2rem))]',
            'rounded-lg border border-gray-200 bg-white p-2.5 text-left shadow-lg ring-1 ring-black/5',
            'invisible pointer-events-none opacity-0 transition-opacity duration-100',
            'group-hover/preview:visible group-hover/preview:pointer-events-auto group-hover/preview:opacity-100',
            'group-focus-within/preview:visible group-focus-within/preview:pointer-events-auto group-focus-within/preview:opacity-100',
          )}
        >
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            All ({entries.length})
          </p>
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {entries.map((entry, index) => (
              <li
                key={entry.id}
                className={cn(
                  'rounded-md border px-2.5 py-2 text-xs',
                  index === 0 ? 'border-emerald-200 bg-emerald-50/70' : 'border-gray-100 bg-gray-50',
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  {index === 0 ? (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                      Latest
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">Earlier</span>
                  )}
                  <span className="shrink-0 text-[10px] text-gray-400">{formatWhen(entry.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-gray-900">{entry.text}</p>
                <p className="mt-1 text-[10px] text-gray-500">
                  by <span className="font-medium text-gray-700">{entry.createdBy}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
