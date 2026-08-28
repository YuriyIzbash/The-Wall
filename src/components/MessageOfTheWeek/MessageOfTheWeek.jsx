import { useState, useEffect } from 'react';
import './MessageOfTheWeek.scss';
import { formatDuration } from '../../utils/formatDuration';
import { API_BASE_URL } from '../../config/api';

function MessageOfTheWeek() {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/graveyard`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch graveyard');
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error('Invalid data format from server');
        }

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const recent = data.filter((entry) => {
          const destroyed = new Date(entry.destroyedAt);
          return destroyed >= weekAgo;
        });

        if (recent.length === 0) {
          setMessage(null);
          setLoading(false);
          return;
        }

        let longest = recent[0];
        let maxDuration = 0;
        recent.forEach((entry) => {
          const created = new Date(entry.createdAt);
          const destroyed = new Date(entry.destroyedAt);
          const duration = destroyed - created;
          if (duration > maxDuration) {
            maxDuration = duration;
            longest = entry;
          }
        });

        setMessage({ ...longest, durationMs: maxDuration });
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
      <blockquote className="motw-quote">
        "{message.message}"
      </blockquote>
      <p className="motw-author">
        — {message.showAuthor ? message.author : 'Anonymous'}
      </p>
      <p className="motw-duration">
        Survived <strong>{formatDuration(message.durationMs)}</strong>
      </p>
    </div>
  );
}

export default MessageOfTheWeek;
