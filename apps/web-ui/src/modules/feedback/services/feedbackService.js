const STORAGE_KEY = 'aa_feedback_submissions';

export const getFeedback = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

const save = (items) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

export const submitFeedback = (entry) => {
  const newEntry = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...entry,
    status: 'open',
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    adminNotes: '',
  };
  save([newEntry, ...getFeedback()]);
  return newEntry;
};

export const updateFeedback = (id, patch) => {
  const updated = getFeedback().map(item =>
    item.id === id ? { ...item, ...patch, reviewedAt: new Date().toISOString() } : item
  );
  save(updated);
};

export const deleteFeedback = (id) => {
  save(getFeedback().filter(item => item.id !== id));
};