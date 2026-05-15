import React, { useState, useEffect, useCallback } from 'react';
import { fetchPlannerTasks } from '../utils/authService';

const PRIORITY_MAP = {
  0: { label: 'Urgent',     color: '#F05252' },
  1: { label: 'Important',  color: '#FF8C00' },
  2: { label: 'Important',  color: '#FF8C00' },
  3: { label: 'Important',  color: '#FF8C00' },
  4: { label: 'Important',  color: '#FF8C00' },
  5: { label: 'Medium',     color: '#F59E0B' },
  6: { label: 'Medium',     color: '#F59E0B' },
  7: { label: 'Medium',     color: '#F59E0B' },
  8: { label: 'Low',        color: '#6B7280' },
  9: { label: 'Low',        color: '#6B7280' },
  10: { label: 'Low',       color: '#6B7280' },
};

const getPriority = (p) => PRIORITY_MAP[p] ?? PRIORITY_MAP[9];

const getStatusLabel = (pct) => {
  if (pct === 100) return { label: 'Completed',    cls: 'planner-status-done' };
  if (pct >= 50)  return { label: 'In Progress',  cls: 'planner-status-progress' };
  return               { label: 'Not Started',   cls: 'planner-status-new' };
};

const PersonalNotes = ({ user }) => {
  // ── Notes state ──────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isTaskMode, setIsTaskMode] = useState(false);
  const [filterActive, setFilterActive] = useState('all');
  const [editingId, setEditingId] = useState(null);

  // ── Planner state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('notes');
  const [plannerTasks, setPlannerTasks] = useState([]);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerError, setPlannerError] = useState(null);
  const [plannerFilter, setPlannerFilter] = useState('all');

  // ── Notes persistence ─────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('personalNotes');
    if (saved) {
      try { setNotes(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('personalNotes', JSON.stringify(notes));
  }, [notes]);

  // ── Planner fetch ─────────────────────────────────────────────────────────────
  const loadPlannerTasks = useCallback(async () => {
    setPlannerLoading(true);
    setPlannerError(null);
    const { tasks, error } = await fetchPlannerTasks();
    setPlannerTasks(tasks);
    setPlannerError(error);
    setPlannerLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'planner' && plannerTasks.length === 0 && !plannerLoading) {
      loadPlannerTasks();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notes handlers ────────────────────────────────────────────────────────────
  const handleAddNote = () => {
    if (!title.trim()) { alert('Please enter a title'); return; }

    if (editingId) {
      setNotes(notes.map(n =>
        n.id === editingId
          ? { ...n, title, description, updatedAt: new Date().toISOString() }
          : n
      ));
      setEditingId(null);
    } else {
      setNotes([{
        id: Date.now(), title, description,
        type: isTaskMode ? 'task' : 'note',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, ...notes]);
    }

    setTitle(''); setDescription(''); setIsTaskMode(false);
  };

  const handleEditNote = (note) => {
    setTitle(note.title); setDescription(note.description);
    setIsTaskMode(note.type === 'task'); setEditingId(note.id);
  };

  const handleDeleteNote = (id) => {
    if (window.confirm('Are you sure you want to delete this note?'))
      setNotes(notes.filter(n => n.id !== id));
  };

  const handleToggleComplete = (id) =>
    setNotes(notes.map(n => n.id === id ? { ...n, completed: !n.completed } : n));

  const handleCancel = () => {
    setTitle(''); setDescription(''); setIsTaskMode(false); setEditingId(null);
  };

  // ── Derived values ────────────────────────────────────────────────────────────
  const filteredNotes = notes.filter(n => {
    if (filterActive === 'active')    return n.type === 'task' && !n.completed;
    if (filterActive === 'completed') return n.type === 'task' && n.completed;
    return true;
  });

  const taskCount = notes.filter(n => n.type === 'task' && !n.completed).length;

  const filteredPlannerTasks = plannerTasks.filter(t => {
    if (plannerFilter === 'active')    return t.percentComplete < 100;
    if (plannerFilter === 'completed') return t.percentComplete === 100;
    return true;
  });

  const plannerActiveCount    = plannerTasks.filter(t => t.percentComplete < 100).length;
  const plannerCompletedCount = plannerTasks.filter(t => t.percentComplete === 100).length;

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString())
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isDueSoon = (dueDateTime) => {
    if (!dueDateTime) return false;
    const due = new Date(dueDateTime);
    const diff = (due - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  };

  const isOverdue = (dueDateTime, pct) => {
    if (!dueDateTime || pct === 100) return false;
    return new Date(dueDateTime) < new Date();
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <main className="main-content personal-notes-container">
      <div className="personal-notes-wrapper">

        {/* Header */}
        <div className="notes-header">
          <div className="notes-header-content">
            <h1>My Notes</h1>
            <p className="notes-subtitle">Personal notes, tasks, and Microsoft Planner</p>
          </div>
          {activeTab === 'notes' && taskCount > 0 && (
            <div className="task-counter">
              <i className="fas fa-tasks" />
              <span>{taskCount} active tasks</span>
            </div>
          )}
          {activeTab === 'planner' && plannerActiveCount > 0 && (
            <div className="task-counter">
              <i className="fas fa-tasks" />
              <span>{plannerActiveCount} active planner tasks</span>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="notes-tab-bar">
          <button
            className={`notes-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <i className="fas fa-sticky-note" />
            My Notes
          </button>
          <button
            className={`notes-tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
            onClick={() => setActiveTab('planner')}
          >
            <i className="fas fa-project-diagram" />
            Planner Tasks
            {plannerTasks.length > 0 && (
              <span className="notes-tab-count">{plannerTasks.length}</span>
            )}
          </button>
        </div>

        {/* ── My Notes Panel ──────────────────────────────────────────────────── */}
        {activeTab === 'notes' && (
          <div className="notes-main-grid">
            <section className="notes-input-section">
              <div className="notes-input-card">
                <h2>{editingId ? 'Edit Note' : 'Add New Note'}</h2>

                <div className="note-type-toggle">
                  <label className={`toggle-label ${!isTaskMode ? 'active' : ''}`}>
                    <input type="radio" checked={!isTaskMode} onChange={() => setIsTaskMode(false)} />
                    <span><i className="fas fa-pencil" /> Note</span>
                  </label>
                  <label className={`toggle-label ${isTaskMode ? 'active' : ''}`}>
                    <input type="radio" checked={isTaskMode} onChange={() => setIsTaskMode(true)} />
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

            <section className="notes-list-section">
              <div className="notes-filter-tabs">
                <button className={`filter-tab ${filterActive === 'all' ? 'active' : ''}`} onClick={() => setFilterActive('all')}>
                  All ({notes.length})
                </button>
                <button className={`filter-tab ${filterActive === 'active' ? 'active' : ''}`} onClick={() => setFilterActive('active')}>
                  Active ({notes.filter(n => n.type === 'task' && !n.completed).length})
                </button>
                <button className={`filter-tab ${filterActive === 'completed' ? 'active' : ''}`} onClick={() => setFilterActive('completed')}>
                  Completed ({notes.filter(n => n.type === 'task' && n.completed).length})
                </button>
              </div>

              <div className="notes-list">
                {filteredNotes.length === 0 ? (
                  <div className="notes-empty-state">
                    <i className="fas fa-inbox" />
                    <p>{filterActive === 'all' ? 'No notes yet. Add one to get started!' : `No ${filterActive} items`}</p>
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
                        {note.description && <p className="note-description">{note.description}</p>}
                        <div className="note-meta">
                          <span className="note-date">{formatDate(note.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="note-actions-icons">
                        <button className="note-action-btn edit" onClick={() => handleEditNote(note)} title="Edit">
                          <i className="fas fa-edit" />
                        </button>
                        <button className="note-action-btn delete" onClick={() => handleDeleteNote(note.id)} title="Delete">
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {/* ── Planner Tasks Panel ──────────────────────────────────────────────── */}
        {activeTab === 'planner' && (
          <div className="planner-panel">

            {/* Planner toolbar */}
            <div className="planner-toolbar">
              <div className="notes-filter-tabs" style={{ borderBottom: 'none', marginBottom: 0 }}>
                <button className={`filter-tab ${plannerFilter === 'all' ? 'active' : ''}`} onClick={() => setPlannerFilter('all')}>
                  All ({plannerTasks.length})
                </button>
                <button className={`filter-tab ${plannerFilter === 'active' ? 'active' : ''}`} onClick={() => setPlannerFilter('active')}>
                  Active ({plannerActiveCount})
                </button>
                <button className={`filter-tab ${plannerFilter === 'completed' ? 'active' : ''}`} onClick={() => setPlannerFilter('completed')}>
                  Completed ({plannerCompletedCount})
                </button>
              </div>
              <button
                className="planner-refresh-btn"
                onClick={loadPlannerTasks}
                disabled={plannerLoading}
                title="Refresh from Microsoft Planner"
              >
                <i className={`fas fa-sync-alt ${plannerLoading ? 'fa-spin' : ''}`} />
                {plannerLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            {/* Error states */}
            {plannerError === 'consent_required' && (
              <div className="planner-error-state">
                <i className="fas fa-lock" />
                <strong>Permission Required</strong>
                <p>Your admin needs to grant <em>Tasks.Read</em> permission in Azure Portal for Microsoft Planner access.</p>
              </div>
            )}
            {plannerError === 'no_permission' && (
              <div className="planner-error-state">
                <i className="fas fa-ban" />
                <strong>Access Denied</strong>
                <p>You do not have permission to access Microsoft Planner tasks. Contact your IT admin.</p>
              </div>
            )}
            {plannerError === 'fetch_failed' && (
              <div className="planner-error-state">
                <i className="fas fa-exclamation-triangle" />
                <strong>Could Not Load Tasks</strong>
                <p>Failed to fetch tasks from Microsoft Planner. Please try again.</p>
              </div>
            )}

            {/* Loading skeleton */}
            {plannerLoading && (
              <div className="planner-task-list">
                {[1, 2, 3].map(i => (
                  <div key={i} className="planner-task-skeleton">
                    <div className="skeleton-line short" />
                    <div className="skeleton-line long" />
                    <div className="skeleton-line medium" />
                  </div>
                ))}
              </div>
            )}

            {/* Task list */}
            {!plannerLoading && !plannerError && (
              <div className="planner-task-list">
                {filteredPlannerTasks.length === 0 ? (
                  <div className="notes-empty-state">
                    <i className="fas fa-check-circle" />
                    <p>{plannerFilter === 'all' ? 'No Planner tasks assigned to you.' : `No ${plannerFilter} tasks.`}</p>
                  </div>
                ) : (
                  filteredPlannerTasks.map((task) => {
                    const prio   = getPriority(task.priority);
                    const status = getStatusLabel(task.percentComplete);
                    const overdue = isOverdue(task.dueDateTime, task.percentComplete);
                    const dueSoon = !overdue && isDueSoon(task.dueDateTime);

                    return (
                      <div key={task.id} className={`planner-task-item ${task.percentComplete === 100 ? 'completed' : ''}`}>
                        {/* Progress circle */}
                        <div className={`planner-progress-ring ${status.cls}`} title={status.label}>
                          {task.percentComplete === 100
                            ? <i className="fas fa-check" />
                            : task.percentComplete === 50
                              ? <i className="fas fa-circle-half-stroke" />
                              : <i className="far fa-circle" />
                          }
                        </div>

                        <div className="planner-task-body">
                          <div className="planner-task-header">
                            <span className="planner-task-title">{task.title}</span>
                            <span
                              className="planner-priority-badge"
                              style={{ background: `${prio.color}22`, color: prio.color }}
                            >
                              {prio.label}
                            </span>
                          </div>

                          <div className="planner-task-meta">
                            {task.planTitle && (
                              <span className="planner-plan-chip">
                                <i className="fas fa-th-large" />
                                {task.planTitle}
                              </span>
                            )}
                            {task.dueDateTime && (
                              <span className={`planner-due-chip ${overdue ? 'overdue' : dueSoon ? 'due-soon' : ''}`}>
                                <i className={`fas ${overdue ? 'fa-exclamation-circle' : 'fa-calendar-alt'}`} />
                                Due {formatDate(task.dueDateTime)}
                              </span>
                            )}
                            {task.checklistItemCount > 0 && (
                              <span className="planner-checklist-chip">
                                <i className="fas fa-list-check" />
                                {task.checklistItemCount - task.activeChecklistItemCount}/{task.checklistItemCount}
                              </span>
                            )}
                            <span className={`planner-status-chip ${status.cls}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
};

export default PersonalNotes;
