'use client';

import { useEffect, useState } from 'react';

export function useToast() {
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [message]);

  return {
    show: (text: string, type: 'success' | 'error' = 'success') => setMessage({ text, type }),
    Toast: message ? (
      <div className={`toast ${message.type === 'error' ? 'toast-error' : ''}`}>{message.text}</div>
    ) : null,
  };
}
