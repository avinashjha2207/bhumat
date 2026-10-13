'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('BhuMat Edge Runtime Error:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
        color: '#0f172a',
      }}
    >
      <div style={{ fontSize: '42px', marginBottom: '12px' }}>📡</div>
      <h2 style={{ fontSize: '19px', fontWeight: 900, margin: '0 0 6px 0' }}>
        Network Sync Interrupted
      </h2>
      <p
        style={{
          fontSize: '13px',
          color: '#64748b',
          maxWidth: '320px',
          margin: '0 0 20px 0',
          lineHeight: 1.45,
        }}
      >
        A temporary connection drop occurred while synchronizing with the sovereign opinion grid.
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '12px 24px',
          backgroundColor: '#0284c7',
          color: '#ffffff',
          border: 'none',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
        }}
      >
        ↻ Reconnect Ballot Box
      </button>
    </div>
  );
}