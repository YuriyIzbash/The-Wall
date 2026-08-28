import { useState } from 'react';
import './OverwriteForm.scss';
import { getRandomGraffitiStyle } from '../../utils/graffitiStyles';

function OverwriteForm({ onSubmit, onCancel }) {
  const [message, setMessage] = useState('');
  const [author, setAuthor] = useState('');
  const [showAuthor, setShowAuthor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [randomStyle] = useState(() => getRandomGraffitiStyle());

  const MAX_MESSAGE_LENGTH = 100;
  const MAX_AUTHOR_LENGTH = 50;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    setFormError('');

    if (!message.trim()) {
      setFormError('Please enter a message.');
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      setFormError(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    if (author.length > MAX_AUTHOR_LENGTH) {
      setFormError(`Author name cannot exceed ${MAX_AUTHOR_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        message: message.trim(),
        author: author.trim() || 'Anonymous',
        showAuthor,
        style: randomStyle,
      });

      setMessage('');
      setAuthor('');
      setShowAuthor(false);
    } catch (err) {
      setFormError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="overwrite-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="message">Your Graffiti Message</label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Write your graffiti message..."
          rows={4}
        />
        <div className="char-counter">
          {message.length} / {MAX_MESSAGE_LENGTH}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="author">Author Name (optional)</label>
        <input
          id="author"
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={MAX_AUTHOR_LENGTH}
          placeholder="Your name or alias"
        />
        <div className="char-counter">
          {author.length} / {MAX_AUTHOR_LENGTH}
        </div>
      </div>

      <div className="form-group author-visibility">
        <label>Show author with graffiti?</label>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              name="authorVisibility"
              checked={!showAuthor}
              onChange={() => setShowAuthor(false)}
            />
            Keep Anonymous
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="authorVisibility"
              checked={showAuthor}
              onChange={() => setShowAuthor(true)}
            />
            Show Author
          </label>
        </div>
      </div>

      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="btn-cancel"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button type="submit" className="btn-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'WRITE'}
        </button>
      </div>
    </form>
  );
}

export default OverwriteForm;
