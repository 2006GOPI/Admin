import React from 'react';

export const Badge = ({ children, className = '', variant = 'outline', size = 'md', ...rest }: any) => (
  <span className={`badge ${className}`}>{children}</span>
);

export default Badge;
