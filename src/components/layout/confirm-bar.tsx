export function ConfirmBar({
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="confirm-bar mt-3 flex flex-wrap items-center gap-3 rounded-xl p-4 ring-1 ring-slate-300" role="group">
      <p className="min-w-0 flex-1 basis-48 text-sm font-bold leading-relaxed">{message}</p>
      <button type="button" onClick={onConfirm} className="btn-danger min-h-11 shrink-0 rounded-lg px-4 text-sm font-bold">
        {confirmLabel}
      </button>
      <button type="button" onClick={onCancel} className="btn-quiet min-h-11 shrink-0 rounded-lg px-4 text-sm font-bold">
        {cancelLabel}
      </button>
    </div>
  );
}
