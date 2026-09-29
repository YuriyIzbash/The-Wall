import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './ContributionPanel.scss';

function ContributionPanel({ contribution, onContinue, onClose }) {
  const [networkId, setNetworkId] = useState(contribution.network);
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const selectedNetwork = useMemo(
    () => contribution.networks.find((network) => network.id === networkId),
    [contribution.networks, networkId]
  );

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(selectedNetwork.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError('Could not copy the address. Please select and copy it manually.');
    }
  };

  const continueToWall = async () => {
    if (isContinuing || !selectedNetwork) return;
    setError('');
    setIsContinuing(true);
    try {
      await onContinue({ contributionId: contribution.id, network: selectedNetwork.id });
    } catch (requestError) {
      setError(requestError.message || 'The overwrite could not be published. Please try again.');
      setIsContinuing(false);
    }
  };

  return (
    <section className="contribution-panel">
      <div className="contribution-amount">1 USDT or more</div>
      <p className="contribution-prompt">Choose network:</p>
      <div className="network-options" aria-label="Choose contribution network">
        {contribution.networks.map((network) => (
          <button
            key={network.id}
            type="button"
            className={network.id === networkId ? 'network-option active' : 'network-option'}
            onClick={() => setNetworkId(network.id)}
          >
            {network.id === 'bsc' ? 'BSC' : network.name}
          </button>
        ))}
      </div>

      {selectedNetwork && (
        <div className="contribution-instructions">
          <p>Network: <strong>{selectedNetwork.name}</strong></p>
          <span>Send 1 USDT or more to:</span>
          <code className="contribution-address">{selectedNetwork.address}</code>
          <div className="contribution-qr" aria-label={`QR code for ${selectedNetwork.name} address`}>
            <QRCodeSVG value={selectedNetwork.address} size={144} level="M" includeMargin />
          </div>
          <button type="button" className="contribution-copy" onClick={copyAddress}>
            {copied ? 'COPIED' : 'COPY ADDRESS'}
          </button>
        </div>
      )}

      <p className="contribution-note">Your contribution helps keep the Wall alive.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onClose} disabled={isContinuing}>CLOSE</button>
        <button type="button" className="btn-submit" onClick={continueToWall} disabled={isContinuing}>
          {isContinuing ? 'PUBLISHING...' : 'CONTINUE'}
        </button>
      </div>
    </section>
  );
}

export default ContributionPanel;
