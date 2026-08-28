import { useEffect, useId } from 'react';
import './Modal.scss';

function Modal({ isOpen, onClose, children, title }) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          ×
        </button>
        {title && (
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
        )}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
