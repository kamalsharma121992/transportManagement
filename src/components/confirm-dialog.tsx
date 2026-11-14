'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styling for delete / irreversible actions */
  variant?: 'default' | 'destructive';
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Module bridge so non-hook call sites can await confirmAction(...) */
let confirmBridge: ConfirmFn | null = null;

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (!confirmBridge) {
    console.warn('confirmAction called before ConfirmDialogProvider mounted');
    return Promise.resolve(false);
  }
  return confirmBridge(options);
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) {
    throw new Error('useConfirm must be used within ConfirmDialogProvider');
  }
  return fn;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      // If a confirm is already open, reject the previous one as cancelled
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setOptions(next);
    });
  }, []);

  useEffect(() => {
    confirmBridge = confirm;
    return () => {
      if (confirmBridge === confirm) confirmBridge = null;
    };
  }, [confirm]);

  function finish(value: boolean) {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOptions(null);
    resolve?.(value);
  }

  const destructive = options?.variant !== 'default';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={options != null}
        onOpenChange={(open) => {
          if (!open) finish(false);
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[60]"
          className="z-[60] max-w-sm gap-4 sm:max-w-sm"
        >
          {options && (
            <>
              <DialogHeader>
                <DialogTitle>{options.title}</DialogTitle>
                {options.description ? (
                  <DialogDescription>{options.description}</DialogDescription>
                ) : null}
              </DialogHeader>
              <DialogFooter className="mx-0 mb-0 flex-row justify-end gap-2 border-0 bg-transparent p-0">
                <Button type="button" variant="outline" onClick={() => finish(false)}>
                  {options.cancelLabel || 'Cancel'}
                </Button>
                <Button
                  type="button"
                  variant={destructive ? 'destructive' : 'default'}
                  onClick={() => finish(true)}
                >
                  {options.confirmLabel || (destructive ? 'Delete' : 'Confirm')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
