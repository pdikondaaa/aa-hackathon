import {
  submitProductFeedback,
  listMyProductFeedback,
  listProductFeedbackAdmin,
  updateProductFeedback,
  deleteProductFeedback,
} from '../../../services/api';

const toEntry = (row) => ({
  id: row.id,
  type: row.type,
  module: row.module,
  title: row.title,
  description: row.description,
  rating: row.rating,
  status: row.status,
  adminNotes: row.admin_notes,
  submittedAt: row.created_at,
  reviewedAt: row.reviewed_at,
  userName: row.user_name,
  userEmail: row.user_email,
});

export const getFeedback = async () => {
  const rows = await listMyProductFeedback();
  return rows.map(toEntry);
};

export const getFeedbackForAdmin = async (params) => {
  const { data } = await listProductFeedbackAdmin(params);
  return data.map(toEntry);
};

export const submitFeedback = async (entry) => {
  const row = await submitProductFeedback({
    type: entry.type,
    module: entry.module,
    title: entry.title,
    description: entry.description,
    rating: entry.rating,
  });
  return toEntry(row);
};

export const updateFeedback = async (id, patch) => {
  const row = await updateProductFeedback(id, {
    status: patch.status,
    admin_notes: patch.adminNotes,
  });
  return toEntry(row);
};

export const deleteFeedback = async (id) => {
  await deleteProductFeedback(id);
};
