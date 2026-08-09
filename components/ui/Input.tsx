import React from 'react';

export const Input = ({ label, icon, className = '', ...rest }: any) => (
  <div className={`input-group ${className}`}>
    {label && <label className="label">{label}</label>}
    <input className="input" {...rest} />
  </div>
);

export default Input;
