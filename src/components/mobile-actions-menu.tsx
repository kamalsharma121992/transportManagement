'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MobileActionsMenuProps = {
  children: React.ReactNode;
  label?: string;
  className?: string;
};

const MENU_MIN_WIDTH = 176;
const MENU_GAP = 4;
const EDGE_PAD = 8;

/** Collapses secondary header actions into a dropdown (mobile only). */
export function MobileActionsMenu({
  children,
  label = 'Actions',
  className,
}: MobileActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = rootRef.current?.querySelector('button');
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(MENU_MIN_WIDTH, rect.width);
    // Align menu to the right edge of the Actions trigger
    let left = rect.right - width;
    if (left < EDGE_PAD) left = EDGE_PAD;
    if (left + width > window.innerWidth - EDGE_PAD) {
      left = Math.max(EDGE_PAD, window.innerWidth - width - EDGE_PAD);
    }
    setPosition({
      top: rect.bottom + MENU_GAP,
      left,
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    function handleReposition() {
      updatePosition();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updatePosition]);

  const menu =
    open && mounted && position
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-50 rounded-lg border bg-white p-1.5 shadow-lg"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxWidth: `calc(100vw - ${EDGE_PAD * 2}px)`,
            }}
          >
            <div
              className={cn(
                'flex flex-col gap-0.5',
                // Force menu items to text/link style (not outline buttons)
                '[&_button]:w-full [&_button]:justify-start [&_button]:h-9 [&_button]:rounded-md',
                '[&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none',
                '[&_button]:px-3 [&_button]:text-sm [&_button]:font-medium [&_button]:text-gray-800',
                '[&_button]:hover:bg-gray-50 [&_button]:hover:text-gray-900',
                '[&_button]:active:translate-y-0',
                '[&_a]:w-full [&_a]:justify-start [&_a]:h-9 [&_a]:rounded-md',
                '[&_a]:border-0 [&_a]:bg-transparent [&_a]:shadow-none',
                '[&_a]:px-3 [&_a]:text-sm [&_a]:font-medium [&_a]:text-gray-800',
                '[&_a]:hover:bg-gray-50 [&_a]:hover:text-gray-900 [&_a]:hover:no-underline',
                '[&_a]:inline-flex [&_a]:items-center',
              )}
              onClick={() => setOpen(false)}
            >
              {children}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5 ml-0.5 transition-transform', open && 'rotate-180')} />
      </Button>
      {menu}
    </div>
  );
}
