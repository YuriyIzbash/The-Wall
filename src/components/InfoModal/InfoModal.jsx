import './InfoModal.scss';

function InfoModal({ title, content }) {
  return (
    <div className="info-modal">
      <h2>{title}</h2>
      <div className="info-content">
        {content}
      </div>
    </div>
  );
}

export default InfoModal;