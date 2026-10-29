import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export default function UpiQrCode({ upiUri, size = 110, className = '' }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!upiUri || !canvasRef.current) return;

    QRCode.toCanvas(
      canvasRef.current,
      upiUri,
      {
        width: size,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      },
      (err) => {
        if (err) {
          console.error('QR code generation error:', err);
          setError(true);
        } else {
          setError(false);
        }
      }
    );
  }, [upiUri, size]);

  if (!upiUri) return null;

  return (
    <div className={`relative inline-flex flex-col items-center bg-white p-1 rounded-md border border-slate-300 ${className}`}>
      <canvas ref={canvasRef} style={{ width: `${size}px`, height: `${size}px` }} />
      {error && (
        <div className="text-[10px] text-red-600 font-medium">QR Unavailable</div>
      )}
    </div>
  );
}
