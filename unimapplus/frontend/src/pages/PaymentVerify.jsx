import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle } from "lucide-react";
import api from '../services/api';

export default function PaymentVerify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying | success | failed

  useEffect(() => {
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) { setStatus('failed'); return; }

    api.get(`/payment/verify?reference=${reference}`)
      .then(({ data }) => {
        if (data.success) { setStatus('success'); setTimeout(() => navigate('/student'), 2500); }
        else { setStatus('failed'); }
      })
      .catch(() => setStatus('failed'));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F2F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 40, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,.1)' }}>

        {status === 'verifying' && (
          <>
            <div style={{ width: 60, height: 60, border: '5px solid #e4e6ef', borderTopColor: '#0BBFBF', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }}/>
            <h2 style={{ margin: '0 0 8px', fontWeight: 800 }}>Verifying Payment</h2>
            <p style={{ color: '#7a7a9a', fontSize: 14 }}>Please wait, confirming your transaction...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div
              style={{
                width: 70,
                height: 70,
                background: '#dcfce7',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <CheckCircle size={34} color="#16a34a" />
            </div>

            <h2 style={{ margin: '0 0 8px', fontWeight: 800, color: '#16a34a' }}>
              Payment Confirmed!
            </h2>
            <p style={{ color: '#7a7a9a', fontSize: 14 }}>Your order is being prepared. Redirecting to tracking...</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div
              style={{
                width: 70,
                height: 70,
                background: '#fee2e2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <XCircle size={34} color="#dc2626" />
            </div>
            <h2 style={{ margin: '0 0 8px', fontWeight: 800, color: '#dc2626' }}>Payment Failed</h2>
            <p style={{ color: '#7a7a9a', fontSize: 14, marginBottom: 20 }}>Something went wrong verifying your payment.</p>
            <button onClick={() => navigate('/student')}
              style={{ background: '#0BBFBF', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Go Back
            </button>
          </>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
