import './GraffitiMessage.scss';

function GraffitiMessage({ message, author, showAuthor, style = {} }) {
  if (!message) return null;

  const {
    fontFamily = 'Arial Black, Impact, sans-serif',
    textColor = '#ffffff',
    gradient = null,
    shadow = '2px 2px 8px rgba(0,0,0,0.8)',
  } = style;

  const baseTextStyle = {
    fontFamily: fontFamily,
    textShadow: shadow,
  };

  // if gradient exists, we use it, otherwise solid color used
  const textStyle = {
    ...baseTextStyle,
    color: gradient ? 'transparent' : textColor,
    background: gradient ? `linear-gradient(to right, ${gradient[0]}, ${gradient[1]})` : 'none',
    WebkitBackgroundClip: gradient ? 'text' : 'unset',
    WebkitTextFillColor: gradient ? 'transparent' : 'unset',
  };

  const authorStyle = {
    ...baseTextStyle,
    fontSize: 'clamp(1rem, 3vw, 2rem)',
    color: gradient ? 'transparent' : textColor,
    background: gradient ? `linear-gradient(to right, ${gradient[0]}, ${gradient[1]})` : 'none',
    WebkitBackgroundClip: gradient ? 'text' : 'unset',
    WebkitTextFillColor: gradient ? 'transparent' : 'unset',
  };

  const containerStyle = {};
  if (gradient) {
    containerStyle.filter = `drop-shadow(0 0 10px rgba(0,0,0,0.9)) drop-shadow(0 0 30px rgba(0,0,0,0.4))`;
  }

  return (
    <div className="graffiti-message" style={containerStyle}>
      <p className="message-text" style={textStyle}>
        {message}
      </p>
      {showAuthor && author && (
        <p className="message-author" style={authorStyle}>
          — {author}
        </p>
      )}
    </div>
  );
}

export default GraffitiMessage;