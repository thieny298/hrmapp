export default function Modal({ title, onClose, children, footer, size = 'md' }) {
  const widths = { sm: 380, md: 460, lg: 600 }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: widths[size] }}>
        <div className="modal-title">
          <span>{title}</span>
          <button className="icon-btn" onClick={onClose} style={{ fontSize: '16px' }}>✕</button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
