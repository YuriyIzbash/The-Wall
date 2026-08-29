import { useState, useEffect } from 'react';
import './App.scss';
import GraffitiMessage from './components/GraffitiMessage/GraffitiMessage';
import Modal from './components/Modal/Modal';
import OverwriteForm from './components/OverwriteForm/OverwriteForm';
import Graveyard from './components/Graveyard/Graveyard';
import HallOfFame from './components/HallOfFame/HallOfFame';
import MessageOfTheWeek from './components/MessageOfTheWeek/MessageOfTheWeek';
import InfoModal from './components/InfoModal/InfoModal';
import { DEFAULT_GRAFFITI_STYLE } from './utils/graffitiStyles';
import { API_BASE_URL } from './config/api';
import { rulesContent, privacyContent, termsContent } from './config/infoContent';

function App() {
  const [wallData, setWallData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [modals, setModals] = useState({
    overwrite: false,
    graveyard: false,
    hallOfFame: false,
    messageOfWeek: false,
    rules: false,
    privacy: false,
    terms: false,
  });

  const toggleModal = (key) => {
    setModals((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Fetch wall on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/wall`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch wall');
        return res.json();
      })
      .then((data) => {
        setWallData({
          ...data,
          graffitiStyle: data.graffitiStyle || DEFAULT_GRAFFITI_STYLE,
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleOverwriteSubmit = async (formData) => {
    if (!wallData) throw new Error('Wall data is not loaded yet.');

    const oldWall = wallData;

    const graveyardEntry = {
      id: Date.now(),
      message: oldWall.message,
      author: oldWall.author,
      showAuthor: oldWall.showAuthor,
      createdAt: oldWall.createdAt,
      destroyedAt: new Date().toISOString(),
    };

    const newWall = {
      id: 1,
      message: formData.message,
      author: formData.author,
      showAuthor: formData.showAuthor,
      createdAt: new Date().toISOString(),
      graffitiStyle: formData.style,
    };

    const [graveyardRes, wallRes] = await Promise.all([
      fetch(`${API_BASE_URL}/graveyard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graveyardEntry),
      }),
      fetch(`${API_BASE_URL}/wall`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWall),
      }),
    ]);

    if (!graveyardRes.ok || !wallRes.ok) {
      throw new Error('Something went wrong. Please try again.');
    }

    const updatedWall = await wallRes.json();
    const finalWall = updatedWall.graffitiStyle ? updatedWall : newWall;

    setWallData(finalWall);
    toggleModal('overwrite');
  };

  if (loading) return <div className="loading-screen">Loading Wall...</div>;
  if (error) return <div className="error-screen">Error: {error}</div>;
  if (!wallData) return null;

  // Navigation items configuration
  const navItems = [
    { label: 'Hall of Fame', key: 'hallOfFame' },
    { label: 'Message of the Week', key: 'messageOfWeek' },
    { label: 'Graveyard', key: 'graveyard' },
    { label: 'Rules', key: 'rules' },
    { label: 'Privacy', key: 'privacy' },
    { label: 'Terms', key: 'terms' },
  ];

  // Modal configuration
  const modalConfigs = {
    overwrite: {
      title: 'Create New Graffiti',
      content: (
        <OverwriteForm
          onSubmit={handleOverwriteSubmit}
          onCancel={() => toggleModal('overwrite')}
        />
      ),
    },
    graveyard: {
      title: 'Graveyard',
      content: <Graveyard />,
    },
    hallOfFame: {
      title: 'Hall of Fame',
      content: <HallOfFame />,
    },
    messageOfWeek: {
      title: 'Message of the Week',
      content: <MessageOfTheWeek />,
    },
    rules: {
      title: 'Rules & Contemporary Art Statement',
      content: <InfoModal title="Rules & Art Statement" content={rulesContent} />,
    },
    privacy: {
      title: 'Privacy Policy',
      content: <InfoModal title="Privacy Policy" content={privacyContent} />,
    },
    terms: {
      title: 'Terms of Use',
      content: <InfoModal title="Terms of Use" content={termsContent} />,
    },
  };

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
        onClick={() => toggleModal('overwrite')}
      >
        OVERWRITE
      </button>

      <nav className="bottom-nav">
        {navItems.map(({ label, key }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleModal(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Render all modals */}
      {Object.entries(modalConfigs).map(([key, config]) => (
        <Modal
          key={key}
          isOpen={modals[key]}
          onClose={() => toggleModal(key)}
          title={config.title}
        >
          {config.content}
        </Modal>
      ))}
    </div>
  );
}

export default App;