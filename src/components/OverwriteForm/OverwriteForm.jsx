import { useState } from 'react';
import './OverwriteForm.scss';

function OverwriteForm({ onSubmit, onCancel }) {
  const [message, setMessage] = useState('');
  const [author, setAuthor] = useState('');
  const [showAuthor, setShowAuthor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const MAX_MESSAGE_LENGTH = 300;
  const MAX_AUTHOR_LENGTH = 100;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      alert(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
      return;
    }

    if (author.length > MAX_AUTHOR_LENGTH) {
      alert(`Author name cannot exceed ${MAX_AUTHOR_LENGTH} characters`);
      return;
    }

    setIsSubmitting(true);
    
    // Submit the data
    onSubmit({
      message: message.trim(),
      author: author.trim() || 'Anonymous',
      showAuthor: showAuthor,
    });

    // Reset form
    setMessage('');
    setAuthor('');
    setShowAuthor(false);
    setIsSubmitting(false);
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
          required
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
              checked={!showAuthor}
              onChange={() => setShowAuthor(false)}
            />
            Keep Anonymous
          </label>
          <label className="radio-option">
            <input
              type="radio"
              checked={showAuthor}
              onChange={() => setShowAuthor(true)}
            />
            Show Author
          </label>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
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