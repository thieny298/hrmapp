import { useRef } from 'react'

export default function Modal({ title, onClose, children, footer, size = 'md' }) {
  const widths = { sm: 380, md: 460, lg: 600 }
  const mouseDownOnOverlay = useRef(false)

  return (
    <div
      className="modal-overlay"
      onMouseDown={e => { mouseDownOnOverlay.current = e.target === e.currentTarget }}
      onClick={e => {
        if (e.target === e.currentTarget && mouseDownOnOverlay.current) onClose()
        mouseDownOnOverlay.current = false
      }}
    >
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
