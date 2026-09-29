import { useState, useEffect } from 'react';
import './HallOfFame.scss';
import { formatDuration } from '../../utils/formatDuration';
import { apiFetch } from '../../config/api';

function HallOfFame() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/hall-of-fame')
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error('Invalid data format from server');
        }

        setEntries(
          data.slice(0, 10).map((entry) => ({
            ...entry,
            showAuthor: !entry.isAnonymous,
            durationMs: entry.survivalSeconds * 1000,
          }))
        );
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="hof-loading">Loading Hall of Fame…</div>;
  if (error) return <div className="hof-error">Error: {error}</div>;

  return (
    <div className="hall-of-fame">
      {entries.length === 0 ? (
        <p className="empty">No messages have survived long enough yet.</p>
      ) : (
        <ol className="ranking">
          {entries.map((entry, index) => (
            <li key={entry.id} className="ranking-item">
              <span className="rank">{index + 1}.</span>
              <span className="message">{entry.message}</span>
              <span className="author">{entry.showAuthor ? entry.author : 'Anonymous'}</span>
              <span className="duration">{formatDuration(entry.durationMs)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default HallOfFame;
