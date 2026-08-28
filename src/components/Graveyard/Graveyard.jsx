import { useState, useEffect } from 'react';
import './Graveyard.scss';
import { API_BASE_URL } from '../../config/api';

const ITEMS_PER_PAGE = 10;

function Graveyard() {
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(allEntries.length / ITEMS_PER_PAGE);
  const currentEntries = allEntries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`${API_BASE_URL}/graveyard`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error('Invalid data format from server');
        }
        // Sort newest first
        const sorted = [...data].sort(
          (a, b) => new Date(b.destroyedAt) - new Date(a.destroyedAt)
        );
        setAllEntries(sorted);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load graveyard');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="graveyard-loading">Loading archive…</div>;
  if (error) return <div className="graveyard-error">Error: {error}</div>;

  return (
    <div className="graveyard">
      {allEntries.length === 0 ? (
        <p className="empty">The graveyard is empty. Be the first to overwrite!</p>
      ) : (
        <>
          <table className="graveyard-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Message</th>
                <th>Author</th>
              </tr>
            </thead>
            <tbody>
              {currentEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.destroyedAt).toLocaleDateString()}</td>
                  <td>{entry.message}</td>
                  <td>{entry.showAuthor ? entry.author : 'Anonymous'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Graveyard;
