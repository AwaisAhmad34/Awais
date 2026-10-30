import { useEffect, useId, useRef, type ReactNode } from 'react';

export function AccessibleDialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} className={`m-auto max-h-[90dvh] w-[calc(100%-2rem)] ${wide ? 'max-w-6xl' : 'max-w-lg'} overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-6 text-white backdrop:bg-black/80`}>
    <div className="flex items-start justify-between gap-4 mb-4">
      <h2 id={titleId} className="text-lg font-bold">{title}</h2>
      <button type="button" autoFocus onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="rounded p-2">✕</button>
    </div>
    {children}
  </dialog>;
}
