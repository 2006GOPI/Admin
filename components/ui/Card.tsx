import React from 'react';

export const Card = ({ children, className = '', padding = 'md', variant = 'default', ...rest }: any) => (
  <div className={`card ${className}`} {...rest}>{children}</div>
);

export const CardHeader = ({ children, className = '', ...rest }: any) => (
  <div className={`card-header ${className}`} {...rest}>{children}</div>
);

export const CardTitle = ({ children, className = '' }: any) => (
  <h3 className={`card-title ${className}`}>{children}</h3>
);

export const CardDescription = ({ children, className = '' }: any) => (
  <p className={`card-desc ${className}`}>{children}</p>
);

export const CardContent = ({ children, className = '' }: any) => (
  <div className={`card-content ${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }: any) => (
  <div className={`card-footer ${className}`}>{children}</div>
);

export default Card;
