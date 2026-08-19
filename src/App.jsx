import { useState, useEffect } from 'react';
import './App.scss';
import GraffitiMessage from './components/GraffitiMessage';
import Modal from './components/Modal/Modal';
import OverwriteForm from './components/OverwriteForm/OverwriteForm';
import { getRandomGraffitiStyle } from './utils/graffitiStyles';

function App() {
  const [wallData, setWallData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState(false);

  // Fetch wall on mount
  useEffect(() => {
    fetch('http://localhost:5001/wall')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch wall');
        return res.json();
      })
      .then((data) => {
        if (!data.graffitiStyle) {
          data.graffitiStyle = getRandomGraffitiStyle();
        }
        setWallData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleOverwriteSubmit = (formData) => {
    if (!wallData) return;

    const oldWall = wallData;

    // Graveyard entry
    const graveyardEntry = {
      id: Date.now(),
      message: oldWall.message,
      author: oldWall.author,
      showAuthor: oldWall.showAuthor,
      createdAt: oldWall.createdAt,
      destroyedAt: new Date().toISOString(),
    };

    // New wall data
    const newWall = {
      id: 1,
      message: formData.message,
      author: formData.author,
      showAuthor: formData.showAuthor,
      createdAt: new Date().toISOString(),
      graffitiStyle: formData.style,
    };

    // Save to graveyard and update wall
    Promise.all([
      fetch('http://localhost:5001/graveyard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graveyardEntry),
      }),
      fetch('http://localhost:5001/wall', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWall),
      }),
    ])
      .then(([graveyardRes, wallRes]) => {
        if (!graveyardRes.ok || !wallRes.ok) throw new Error('Failed to save');
        return Promise.all([graveyardRes.json(), wallRes.json()]);
      })
      .then(([_, updatedWall]) => {
        console.log('Updated wall from API:', updatedWall);
        const finalWall = updatedWall.graffitiStyle ? updatedWall : newWall;
        console.log('Final wall used:', finalWall);
        setWallData(finalWall);
        setIsOverwriteModalOpen(false);
      })
      .catch((err) => {
        console.error('Overwrite error:', err);
        alert('Something went wrong. Please try again.');
      });
  };

  // Loading / error states
  if (loading) return <div className="loading-screen">Loading Wall...</div>;
  if (error) return <div className="error-screen">Error: {error}</div>;
  if (!wallData) return null;

  return (
    <div className="wall">
      <div className="graffiti-area">
        <GraffitiMessage
          key={wallData.id + wallData.message} 
          message={wallData.message}
          author={wallData.author}
          showAuthor={wallData.showAuthor}
          style={wallData.graffitiStyle}
        />
      </div>

      <button
        className="overwrite-button"
        onClick={() => setIsOverwriteModalOpen(true)}
      >
        OVERWRITE
      </button>

      <nav className="bottom-nav">
        <span>Hall of Fame</span>
        <span>Message of the Week</span>
        <span>Graveyard</span>
        <span>Rules</span>
        <span>Privacy</span>
        <span>Terms</span>
      </nav>

      <Modal
        isOpen={isOverwriteModalOpen}
        onClose={() => setIsOverwriteModalOpen(false)}
        title="Create New Graffiti"
      >
        <OverwriteForm
          onSubmit={handleOverwriteSubmit}
          onCancel={() => setIsOverwriteModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

export default App;