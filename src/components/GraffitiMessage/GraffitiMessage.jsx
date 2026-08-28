import './GraffitiMessage.scss';

function GraffitiMessage({ message, author, showAuthor, style }) {
  if (!message) return null;

  const {
    fontFamily = 'Arial Black, Impact, sans-serif',
    textColor = '#ffffff',
    gradient = null,
    shadow = '2px 2px 8px rgba(0,0,0,0.8)',
  } = style || {};

  const hasGradient = Array.isArray(gradient) && gradient.length >= 2;

  const getTextStyle = (extraStyles = {}) => ({
    fontFamily,
    textShadow: shadow,
    ...extraStyles,
    color: hasGradient ? 'transparent' : textColor,
    background: hasGradient
      ? `linear-gradient(to right, ${gradient[0]}, ${gradient[1]})`
      : 'none',
    WebkitBackgroundClip: hasGradient ? 'text' : 'unset',
    WebkitTextFillColor: hasGradient ? 'transparent' : 'unset',
  });

  const textStyle = getTextStyle();

  const authorStyle = getTextStyle({
    fontSize: 'clamp(1rem, 3vw, 2rem)',
  });

  const containerStyle = hasGradient
    ? {
        filter:
          'drop-shadow(0 0 6px rgba(0,0,0,0.8)) drop-shadow(0 0 20px rgba(0,0,0,0.3))',
      }
    : {};

  return (
    <div className="graffiti-message" style={containerStyle}>
      <p className="message-text" style={textStyle}>
        {message}
      </p>
      {showAuthor && author && (
        <p className="message-author" style={authorStyle}>
          - {author}
        </p>
      )}
    </div>
  );
}

export default GraffitiMessage;
