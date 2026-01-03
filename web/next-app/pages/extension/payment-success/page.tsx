'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (sessionId) {
      // Verify session with backend
      fetch(`/api/extension/stripe/verify-session?session_id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setStatus('success');
          } else {
            setStatus('error');
          }
        })
        .catch(() => setStatus('error'));
    } else {
      setStatus('success'); // Coming from portal
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">Processing...</h1>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to LenQuant Pro!</h1>
            <p className="text-gray-400 mb-6">
              Your subscription is now active. Return to the extension to start using Pro features.
            </p>
            <div className="bg-gray-700 rounded-lg p-4 text-left">
              <h3 className="text-yellow-500 font-semibold mb-2">What's next?</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>✅ AI-powered trade explanations</li>
                <li>✅ Multi-timeframe confluence</li>
                <li>✅ Cloud journal (30 days)</li>
                <li>✅ Behavioral guardrails</li>
              </ul>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              Please contact support if you were charged but don't see Pro features activated.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
