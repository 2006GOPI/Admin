import React from 'react';

export const useToastHelpers = () => ({
  success: (title: string, message?: string) => console.log('TOAST success:', title, message),
  error: (title: string, message?: string) => console.error('TOAST error:', title, message),
});

export default null;
