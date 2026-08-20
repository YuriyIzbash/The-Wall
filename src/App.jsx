import { useState, useEffect } from 'react';
import './App.scss';
import GraffitiMessage from './components/GraffitiMessage';
import Modal from './components/Modal/Modal';
import OverwriteForm from './components/OverwriteForm/OverwriteForm';
import { getRandomGraffitiStyle } from './utils/graffitiStyles';
import Graveyard from './components/Graveyard/Graveyard';
import HallOfFame from './components/HallOfFame/HallOfFame';
import MessageOfTheWeek from './components/MessageOfTheWeek/MessageOfTheWeek';
import InfoModal from './components/InfoModal/InfoModal';

function App() {
  const [wallData, setWallData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState(false);
  const [isGraveyardModalOpen, setIsGraveyardModalOpen] = useState(false);
  const [isHallOfFameOpen, setIsHallOfFameOpen] = useState(false);
  const [isMessageOfWeekOpen, setIsMessageOfWeekOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

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
        const finalWall = updatedWall.graffitiStyle ? updatedWall : newWall;
        setWallData(finalWall);
        setIsOverwriteModalOpen(false);
      })
      .catch((err) => {
        console.error('Overwrite error:', err);
        alert('Something went wrong. Please try again.');
      });
  };

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
        <span onClick={() => setIsHallOfFameOpen(true)}>Hall of Fame</span>
        <span onClick={() => setIsMessageOfWeekOpen(true)}>Message of the Week</span>
        <span onClick={() => setIsGraveyardModalOpen(true)}>Graveyard</span>
        <span onClick={() => setIsRulesOpen(true)}>Rules</span>
        <span onClick={() => setIsPrivacyOpen(true)}>Privacy</span>
        <span onClick={() => setIsTermsOpen(true)}>Terms</span>
      </nav>

      {/* Overwrite Modal */}
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

      {/* Graveyard Modal */}
      <Modal
        isOpen={isGraveyardModalOpen}
        onClose={() => setIsGraveyardModalOpen(false)}
        title="Graveyard"
      >
        <Graveyard />
      </Modal>

      {/* Hall of Fame Modal */}
      <Modal
        isOpen={isHallOfFameOpen}
        onClose={() => setIsHallOfFameOpen(false)}
        title="Hall of Fame"
      >
        <HallOfFame />
      </Modal>

      {/* Message of the Week Modal */}
      <Modal
        isOpen={isMessageOfWeekOpen}
        onClose={() => setIsMessageOfWeekOpen(false)}
        title="Message of the Week"
      >
        <MessageOfTheWeek />
      </Modal>

      {/* Rules Modal */}
      <Modal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        title="Rules & Contemporary Art Statement"
      >
        <InfoModal
          title="Rules & Art Statement"
          content={
            <>
              <p>
                <strong>The Wall</strong> is a digital contemporary art installation.
                It represents a permanent concrete wall where visitors leave temporary
                graffiti messages.
              </p>
              <p>
                By posting, you agree that:
              </p>
              <ul>
                <li>Your message is temporary and will be overwritten.</li>
                <li>
                  Content must not be illegal, offensive, or harmful.
                </li>
                <li>
                  The platform reserves the right to remove any content
                  without notice.
                </li>
                <li>
                  Messages do not represent the views of the platform.
                </li>
              </ul>
              <p>
                This is an artwork – treat it with respect.
              </p>
            </>
          }
        />
      </Modal>

      {/* Privacy Modal */}
      <Modal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
        title="Privacy Policy"
      >
        <InfoModal
          title="Privacy Policy"
          content={
            <>
              <p>
                We collect minimal data to operate The Wall:
              </p>
              <ul>
                <li>
                  <strong>Messages</strong> – stored in the database and
                  graveyard.
                </li>
                <li>
                  <strong>Author names</strong> – optional, visible only if
                  you choose to display them.
                </li>
                <li>
                  <strong>Timestamps</strong> – when you create or overwrite
                  a message.
                </li>
              </ul>
              <p>
                We do <strong>not</strong> collect:
              </p>
              <ul>
                <li>IP addresses</li>
                <li>Location data</li>
                <li>Cookies or tracking data</li>
                <li>Payment information (not used in this project)</li>
              </ul>
              <p>
                Your data is stored locally via json-server and not shared
                with third parties.
              </p>
            </>
          }
        />
      </Modal>

      {/* Terms Modal */}
      <Modal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
        title="Terms of Use"
      >
        <InfoModal
          title="Terms of Use"
          content={
            <>
              <p>
                By using The Wall, you accept the following terms:
              </p>
              <ul>
                <li>
                  You are responsible for the content you post.
                </li>
                <li>
                  Content that is illegal, hateful, abusive, or infringing
                  on others' rights is prohibited.
                </li>
                <li>
                  The platform reserves the right to remove any content at
                  its discretion.
                </li>
                <li>
                  This is a non-commercial art project – no financial
                  transactions occur.
                </li>
                <li>
                  The platform is provided "as is" with no warranties.
                </li>
              </ul>
              <p>
                These terms may be updated at any time.
              </p>
            </>
          }
        />
      </Modal>
    </div>
  );
}

export default App;