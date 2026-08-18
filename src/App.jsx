import './App.scss';
import GraffitiMessage from './components/GraffitiMessage';

function App() {
  // TODO: replace hardcoded data when json-server connected
  const message = "The Wall is test.";
  const author = "Anonymous";
  const showAuthor = true;

  return (
    <div className="wall">
      <div className="graffiti-area">
        <GraffitiMessage 
          message={message}
          author={author}
          showAuthor={showAuthor}
        />
      </div>

      <button className="overwrite-button">
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
    </div>
  );
}

export default App;