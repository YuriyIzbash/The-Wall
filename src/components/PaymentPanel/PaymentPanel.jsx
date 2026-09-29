import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ApiRequestError, apiFetch } from '../../config/api';
import './PaymentPanel.scss';

const POLL_INTERVAL_MS = 4_000;
const TERMINAL_STATUSES = new Set(['confirmed', 'invalid', 'expired']);

const statusCopy = {
  pending: 'WAITING FOR PAYMENT...',
  confirmed: 'PAYMENT RECEIVED',
  invalid: 'PAYMENT WAS NOT CONFIRMED',
  expired: 'PAYMENT EXPIRED',
};

const statusMessage = {
  pending: 'After sending the transfer, paste its transaction hash below so it can be verified.',
  confirmed: 'Your overwrite has been published to the Wall.',
  invalid: 'Payment was not confirmed. Your overwrite has not been published.',
  expired: 'This payment window has expired. Your overwrite has not been published.',
};

const paymentIdOf = (payment) => payment.paymentId ?? payment.id;

function PaymentPanel({ payment, onPaymentChange, onPublished, onClose }) {
  const [transactionHash, setTransactionHash] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const paymentId = paymentIdOf(payment);
  const isTerminal = TERMINAL_STATUSES.has(payment.status);

  useEffect(() => {
    let cancelled = false;

    const refreshStatus = async () => {
      try {
        const latest = await apiFetch(`/payments/${paymentId}`);
        if (!cancelled) onPaymentChange({ ...latest, paymentId: latest.id });
      } catch (requestError) {
        if (!cancelled && !(requestError instanceof ApiRequestError && requestError.code === 'payment_not_found')) {
          setError('Payment status is temporarily unavailable. Please try again shortly.');
        }
      }
    };

    void refreshStatus();
    if (isTerminal) return undefined;
    const interval = window.setInterval(refreshStatus, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isTerminal, onPaymentChange, paymentId]);

  useEffect(() => {
    if (payment.status === 'confirmed') void onPublished();
  }, [onPublished, payment.status]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(payment.recipientAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError('Could not copy the address. Please select and copy it manually.');
    }
  };

  const verifyPayment = async (event) => {
    event.preventDefault();
    if (isVerifying || !transactionHash.trim() || isTerminal) return;

    setError('');
    setIsVerifying(true);
    try {
      const result = await apiFetch(`/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionHash: transactionHash.trim() }),
      });
      onPaymentChange({ ...result.payment, paymentId: result.payment.id });
    } catch (requestError) {
      setError(requestError.message || 'Payment could not be verified. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <section className="payment-panel" aria-live="polite">
      <div className="payment-amount">{payment.amount} {payment.token}</div>
      <p className="payment-network">Network: {payment.network}</p>

      <div className="payment-instructions">
        <span>Send exactly {payment.amount} {payment.token} to:</span>
        <code className="payment-address">{payment.recipientAddress}</code>
        <div className="payment-qr" aria-label={`QR code for ${payment.recipientAddress}`}>
          <QRCodeSVG value={payment.recipientAddress} size={144} level="M" includeMargin />
        </div>
        <button type="button" className="payment-copy" onClick={copyAddress}>
          {copied ? 'COPIED' : 'COPY ADDRESS'}
        </button>
      </div>

      <div className={`payment-state payment-state--${payment.status}`}>
        <strong>{statusCopy[payment.status] || 'PAYMENT STATUS UPDATING'}</strong>
        <p>{statusMessage[payment.status] || 'Checking your payment status.'}</p>
      </div>

      {payment.status === 'pending' && (
        <form className="payment-verify" onSubmit={verifyPayment}>
          <label htmlFor="transactionHash">TRON transaction hash</label>
          <input
            id="transactionHash"
            type="text"
            value={transactionHash}
            onChange={(event) => setTransactionHash(event.target.value)}
            placeholder="Paste the 64-character transaction hash"
            autoComplete="off"
            spellCheck="false"
          />
          <button type="submit" className="btn-submit" disabled={isVerifying || !transactionHash.trim()}>
            {isVerifying ? 'VERIFYING...' : 'VERIFY PAYMENT'}
          </button>
        </form>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="payment-id">Payment ID: {paymentId}</p>

      <div className="form-actions">
        {payment.status === 'confirmed' && (
          <button type="button" className="btn-submit" onClick={onClose}>VIEW THE WALL</button>
        )}
        <button type="button" className="btn-cancel" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </section>
  );
}

export default PaymentPanel;
