import React from 'react';

export const Button = ({ children, className = '', icon, variant = 'default', size = 'md', ...rest }: any) => (
  <button className={`btn ${className}`} {...rest}>
    {icon && <span className="btn-icon">{icon}</span>}
    <span>{children}</span>
  </button>
);

export default Button;
