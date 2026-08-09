import React from 'react';

export const generateCertificateId = () => 'CERT-' + Math.random().toString(36).slice(2, 10).toUpperCase();

export const useCertificateDownload = () => {
  const certRef = React.createRef();
  const downloadPNG = async (id: string) => { console.log('downloadPNG', id); };
  const downloadPDF = async (id: string) => { console.log('downloadPDF', id); };
  const printCertificate = () => { window.print(); };
  return { certRef, downloadPNG, downloadPDF, printCertificate };
};

export default null;
