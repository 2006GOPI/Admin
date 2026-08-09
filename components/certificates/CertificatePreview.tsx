import React from 'react';

const CertificatePreview = React.forwardRef(({ certificate }: any, ref) => (
  <div ref={ref} className="certificate-preview border p-6 bg-white">
    <h2 className="text-xl font-bold">Certificate</h2>
    <p className="mt-2">{certificate?.studentName} — {certificate?.courseName}</p>
  </div>
));

export default CertificatePreview;
