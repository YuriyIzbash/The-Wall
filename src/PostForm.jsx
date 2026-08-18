import { useState } from 'react';

function PostForm({ onPostCreated }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !content || !author) return;

    setSubmitting(true);
    fetch('http://localhost:5001/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, author }),
    })
      .then((res) => res.json())
      .then((newPost) => {
        setTitle('');
        setContent('');
        setAuthor('');
        setSubmitting(false);
        if (onPostCreated) onPostCreated(newPost);
      })
      .catch((err) => {
        console.error('Error creating post:', err);
        setSubmitting(false);
      });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create a new post</h2>
      <div>
        <label>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div>
        <label>Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </div>
      <div>
        <label>Author</label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          required
        />
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Post'}
      </button>
    </form>
  );
}

export default PostForm;