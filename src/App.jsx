import { useState } from 'react';
import './App.scss';
import GraffitiMessage from './components/GraffitiMessage';
import Modal from './components/Modal/Modal';
import OverwriteForm from './components/OverwriteForm/OverwriteForm';
import { getRandomGraffitiStyle } from './utils/graffitiStyles';

function App() {
  // TODO: replace hardcoded data when json-server connected
  const [message] = useState("The Wall is alive.");
  const [author] = useState("Anonymous");
  const [showAuthor] = useState(false);
  const [style] = useState(getRandomGraffitiStyle);
  
  // Modal state
  const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState(false);

  const handleOverwriteSubmit = (data) => {
    console.log('New graffiti submitted:', data);
    // TODO: connect to json-server in a later step
    setIsOverwriteModalOpen(false);
  };

  return (
    <div className="wall">
      <div className="graffiti-area">
        <GraffitiMessage 
          message={message}
          author={author}
          showAuthor={showAuthor}
          style={style}
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
    </div>
  );
}

export default App;