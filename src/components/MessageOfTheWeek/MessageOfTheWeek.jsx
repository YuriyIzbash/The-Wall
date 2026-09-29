import { useState, useEffect } from 'react';
import './MessageOfTheWeek.scss';
import { formatDuration } from '../../utils/formatDuration';
import { apiFetch } from '../../config/api';

function MessageOfTheWeek() {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/message-of-the-week')
      .then((data) => {
        if (!data) {
          setMessage(null);
          setLoading(false);
          return;
        }

        setMessage({
          ...data,
          showAuthor: !data.isAnonymous,
          durationMs: data.survivalSeconds * 1000,
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="motw-loading">Loading Message of the Week…</div>;
  if (error) return <div className="motw-error">Error: {error}</div>;

  if (!message) {
    return <p className="motw-empty">No graffiti survived the last 7 days.</p>;
  }

  return (
    <div className="message-of-the-week">
      <blockquote className="motw-quote">"{message.message}"</blockquote>
      <p className="motw-author">— {message.showAuthor ? message.author : 'Anonymous'}</p>
      <p className="motw-duration">
        Survived <strong>{formatDuration(message.durationMs)}</strong>
      </p>
    </div>
  );
}

export default MessageOfTheWeek;
