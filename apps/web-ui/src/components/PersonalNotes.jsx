import React, { useState, useEffect } from 'react';

const PersonalNotes = ({ user }) => {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isTaskMode, setIsTaskMode] = useState(false);
  const [filterActive, setFilterActive] = useState('all'); // all, active, completed
  const [editingId, setEditingId] = useState(null);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('personalNotes');
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error('Error loading notes:', e);
      }
    }
  }, []);

  // Save notes to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('personalNotes', JSON.stringify(notes));
  }, [notes]);

  const handleAddNote = () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (editingId) {
      setNotes(notes.map(note =>
        note.id === editingId
          ? {
              ...note,
              title,
              description,
              updatedAt: new Date().toISOString(),
            }
          : note
      ));
      setEditingId(null);
    } else {
      const newNote = {
        id: Date.now(),
        title,
        description,
        type: isTaskMode ? 'task' : 'note',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setNotes([newNote, ...notes]);
    }

    setTitle('');
    setDescription('');
    setIsTaskMode(false);
  };

  const handleEditNote = (note) => {
    setTitle(note.title);
    setDescription(note.description);
    setIsTaskMode(note.type === 'task');
    setEditingId(note.id);
  };

  const handleDeleteNote = (id) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      setNotes(notes.filter(note => note.id !== id));
    }
  };

  const handleToggleComplete = (id) => {
    setNotes(notes.map(note =>
      note.id === id ? { ...note, completed: !note.completed } : note
    ));
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    setIsTaskMode(false);
    setEditingId(null);
  };

  // Filter notes based on filter type
  const filteredNotes = notes.filter(note => {
    if (filterActive === 'active') return note.type === 'task' && !note.completed;
    if (filterActive === 'completed') return note.type === 'task' && note.completed;
    return true;
  });

  const taskCount = notes.filter(n => n.type === 'task' && !n.completed).length;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <main className="main-content personal-notes-container">
      <div className="personal-notes-wrapper">

        {/* Header */}
        <div className="notes-header">
          <div className="notes-header-content">
            <h1>My Notes</h1>
            <p className="notes-subtitle">Keep track of your personal notes and tasks</p>
          </div>
          {taskCount > 0 && (
            <div className="task-counter">
              <i className="fas fa-tasks" />
              <span>{taskCount} active tasks</span>
            </div>
          )}
        </div>

        <div className="notes-main-grid">

          {/* Add/Edit Note Section */}
          <section className="notes-input-section">
            <div className="notes-input-card">
              <h2>{editingId ? 'Edit Note' : 'Add New Note'}</h2>

              <div className="note-type-toggle">
                <label className={`toggle-label ${!isTaskMode ? 'active' : ''}`}>
                  <input
                    type="radio"
                    checked={!isTaskMode}
                    onChange={() => setIsTaskMode(false)}
                  />
                  <span><i className="fas fa-pencil" /> Note</span>
                </label>
                <label className={`toggle-label ${isTaskMode ? 'active' : ''}`}>
                  <input
                    type="radio"
                    checked={isTaskMode}
                    onChange={() => setIsTaskMode(true)}
                  />
                  <span><i className="fas fa-tasks" /> Task</span>
                </label>
              </div>

              <input
                type="text"
                className="note-title-input"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
              />

              <textarea
                className="note-description-input"
                placeholder="Description or details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />

              <div className="note-actions">
                <button className="btn-primary" onClick={handleAddNote}>
                  <i className="fas fa-plus" />
                  {editingId ? 'Update Note' : 'Add Note'}
                </button>
                {editingId && (
                  <button className="btn-secondary" onClick={handleCancel}>
                    <i className="fas fa-times" />
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Notes Display Section */}
          <section className="notes-list-section">
            <div className="notes-filter-tabs">
              <button
                className={`filter-tab ${filterActive === 'all' ? 'active' : ''}`}
                onClick={() => setFilterActive('all')}
              >
                All ({notes.length})
              </button>
              <button
                className={`filter-tab ${filterActive === 'active' ? 'active' : ''}`}
                onClick={() => setFilterActive('active')}
              >
                Active ({notes.filter(n => n.type === 'task' && !n.completed).length})
              </button>
              <button
                className={`filter-tab ${filterActive === 'completed' ? 'active' : ''}`}
                onClick={() => setFilterActive('completed')}
              >
                Completed ({notes.filter(n => n.type === 'task' && n.completed).length})
              </button>
            </div>

            <div className="notes-list">
              {filteredNotes.length === 0 ? (
                <div className="notes-empty-state">
                  <i className="fas fa-inbox" />
                  <p>
                    {filterActive === 'all'
                      ? 'No notes yet. Add one to get started!'
                      : `No ${filterActive} items`}
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <div key={note.id} className={`note-item ${note.type} ${note.completed ? 'completed' : ''}`}>
                    {note.type === 'task' && (
                      <input
                        type="checkbox"
                        className="note-checkbox"
                        checked={note.completed}
                        onChange={() => handleToggleComplete(note.id)}
                        aria-label={`Mark "${note.title}" as ${note.completed ? 'incomplete' : 'complete'}`}
                      />
                    )}

                    <div className="note-content">
                      <div className="note-header-line">
                        <h3 className="note-title">{note.title}</h3>
                        <span className="note-type-badge">{note.type === 'task' ? 'Task' : 'Note'}</span>
                      </div>
                      {note.description && (
                        <p className="note-description">{note.description}</p>
                      )}
                      <div className="note-meta">
                        <span className="note-date">{formatDate(note.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="note-actions-icons">
                      <button
                        className="note-action-btn edit"
                        onClick={() => handleEditNote(note)}
                        title="Edit"
                        aria-label={`Edit note: ${note.title}`}
                      >
                        <i className="fas fa-edit" />
                      </button>
                      <button
                        className="note-action-btn delete"
                        onClick={() => handleDeleteNote(note.id)}
                        title="Delete"
                        aria-label={`Delete note: ${note.title}`}
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>

      </div>
    </main>
  );
};

export default PersonalNotes;
