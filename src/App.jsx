import { useState } from 'react';
import PostList from './PostList';
import PostForm from './PostForm';
import './App.scss';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePostCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="App">
      <h1>The Wall</h1>
      <PostForm onPostCreated={handlePostCreated} />
      <PostList key={refreshKey} />
    </div>
  );
}

export default App;