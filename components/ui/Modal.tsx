import React from 'react';

export const ModalProvider = ({ children }: any) => <div>{children}</div>;

export const Modal = ({ children, title, size = 'md', onClose }: any) => (
  <div className="modal-backdrop">
    <div className={`modal ${size}`}>
      <div className="modal-header">
        <h3>{title}</h3>
        <button onClick={onClose}>×</button>
      </div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
);

export default Modal;
