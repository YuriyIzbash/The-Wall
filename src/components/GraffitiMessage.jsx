import './GraffitiMessage.scss';

function GraffitiMessage({ message, author, showAuthor }) {
  if (!message) return null;

  return (
    <div className="graffiti-message">
      <p className="message-text">{message}</p>
      {showAuthor && author && (
        <p className="message-author">— {author}</p>
      )}
    </div>
  );
}

export default GraffitiMessage;