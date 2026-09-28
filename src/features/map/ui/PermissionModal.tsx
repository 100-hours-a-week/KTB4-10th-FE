type PermissionModalProps = {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function PermissionModal({
  title,
  description,
  confirmLabel,
  cancelLabel = '나중에',
  onConfirm,
  onCancel,
}: PermissionModalProps) {
  return (
    <div className="permission-backdrop" role="presentation">
      <section className="permission-modal" role="dialog" aria-modal="true" aria-labelledby="permission-title">
        <div className="permission-modal__symbol" aria-hidden="true">KGB</div>
        <h2 id="permission-title">{title}</h2>
        <p>{description}</p>
        <div className="permission-modal__actions">
          <button type="button" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
