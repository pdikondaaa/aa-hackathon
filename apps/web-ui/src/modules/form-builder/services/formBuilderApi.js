import httpClient from '../../../services/api';

// ── Admin: Form Definitions ───────────────────────────────────────────────────

export const adminListForms = (params = {}) =>
  httpClient.get('/api/admin/ncl/forms', { params });

export const adminCreateForm = (body) =>
  httpClient.post('/api/admin/ncl/forms', body);

export const adminGetForm = (formId) =>
  httpClient.get(`/api/admin/ncl/forms/${formId}`);

export const adminUpdateForm = (formId, body) =>
  httpClient.patch(`/api/admin/ncl/forms/${formId}`, body);

export const adminPublishForm = (formId, changeNotes) =>
  httpClient.post(`/api/admin/ncl/forms/${formId}/publish`, null, {
    params: changeNotes ? { change_notes: changeNotes } : {},
  });

export const adminArchiveForm = (formId) =>
  httpClient.post(`/api/admin/ncl/forms/${formId}/archive`);

export const adminDeleteForm = (formId) =>
  httpClient.delete(`/api/admin/ncl/forms/${formId}`);

// ── Admin: Fields ─────────────────────────────────────────────────────────────

export const adminAddField = (formId, body) =>
  httpClient.post(`/api/admin/ncl/forms/${formId}/fields`, body);

export const adminUpdateField = (formId, fieldId, body) =>
  httpClient.patch(`/api/admin/ncl/forms/${formId}/fields/${fieldId}`, body);

export const adminDeleteField = (formId, fieldId) =>
  httpClient.delete(`/api/admin/ncl/forms/${formId}/fields/${fieldId}`);

export const adminReorderFields = (formId, fields) =>
  httpClient.put(`/api/admin/ncl/forms/${formId}/fields/reorder`, { fields });

// ── Admin: Submissions ────────────────────────────────────────────────────────

export const adminListSubmissions = (formId, params = {}) =>
  httpClient.get(`/api/admin/ncl/forms/${formId}/submissions`, { params });

export const adminUpdateSubmissionStatus = (submissionId, body) =>
  httpClient.patch(`/api/admin/ncl/submissions/${submissionId}/status`, body);

export const adminDeleteSubmission = (submissionId) =>
  httpClient.delete(`/api/admin/ncl/submissions/${submissionId}`);

// ── Admin: Workflows ──────────────────────────────────────────────────────────

export const adminListWorkflows = (params = {}) =>
  httpClient.get('/api/admin/ncl/workflows', { params });

export const adminCreateWorkflow = (body) =>
  httpClient.post('/api/admin/ncl/workflows', body);

export const adminUpdateWorkflow = (wfId, body) =>
  httpClient.patch(`/api/admin/ncl/workflows/${wfId}`, body);

export const adminDeleteWorkflow = (wfId) =>
  httpClient.delete(`/api/admin/ncl/workflows/${wfId}`);

// ── Admin: Rules ──────────────────────────────────────────────────────────────

export const adminListRules = (formId) =>
  httpClient.get(`/api/admin/ncl/forms/${formId}/rules`);

export const adminCreateRule = (formId, body) =>
  httpClient.post(`/api/admin/ncl/forms/${formId}/rules`, body);

export const adminUpdateRule = (ruleId, body) =>
  httpClient.patch(`/api/admin/ncl/rules/${ruleId}`, body);

export const adminDeleteRule = (ruleId) =>
  httpClient.delete(`/api/admin/ncl/rules/${ruleId}`);

// ── Admin: Audit Logs ─────────────────────────────────────────────────────────

export const adminGetAuditLogs = (params = {}) =>
  httpClient.get('/api/admin/ncl/audit-logs', { params });

// ── Public: Form Discovery & Submission ───────────────────────────────────────

export const searchForms = (q) =>
  httpClient.get('/api/ncl/forms/search', { params: { q } });

export const listPublishedForms = (params = {}) =>
  httpClient.get('/api/ncl/forms/published', { params });

export const getFormBySlug = (slug) =>
  httpClient.get(`/api/ncl/forms/${slug}`);

export const submitForm = (slug, body) =>
  httpClient.post(`/api/ncl/forms/${slug}/submit`, body);

export const listMySubmissions = (params = {}) =>
  httpClient.get('/api/ncl/my-submissions', { params });

export const getSubmission = (submissionId) =>
  httpClient.get(`/api/ncl/submissions/${submissionId}`);

// ── Templates ─────────────────────────────────────────────────────────────────

export const listTemplates = (params = {}) =>
  httpClient.get('/api/ncl/templates', { params });

export const useTemplate = (templateId) =>
  httpClient.post(`/api/ncl/templates/${templateId}/use`);

// ── Rule Engine ───────────────────────────────────────────────────────────────

export const evaluateFormRules = (formId, values, changedFields = null) =>
  httpClient.post(`/api/ncl/forms/${formId}/evaluate-rules`, {
    values,
    changed_fields: changedFields,
  });

export const validateFormRules = (formId, values) =>
  httpClient.post(`/api/ncl/forms/${formId}/validate-rules`, { values });

// ── AI Form Builder ───────────────────────────────────────────────────────────

export const aiFormChat = (message, conversationHistory = [], currentForm = {}) =>
  httpClient.post('/api/admin/ncl/ai-form-builder/chat', {
    message,
    conversation_history: conversationHistory,
    current_form: currentForm,
  });

// ── Admin: Slash Commands ─────────────────────────────────────────────────────

export const adminListSlashCommands = () =>
  httpClient.get('/api/admin/ncl/slash-commands');

export const adminCreateSlashCommand = (body) =>
  httpClient.post('/api/admin/ncl/slash-commands', body);

export const adminUpdateSlashCommand = (cmdId, body) =>
  httpClient.patch(`/api/admin/ncl/slash-commands/${cmdId}`, body);

export const adminDeleteSlashCommand = (cmdId) =>
  httpClient.delete(`/api/admin/ncl/slash-commands/${cmdId}`);

// ── Public: Slash Commands (chat slash menu) ──────────────────────────────────

export const listActiveSlashCommands = (params = {}) =>
  httpClient.get('/api/ncl/slash-commands', { params });

export const searchSlashCommands = (q) =>
  httpClient.get('/api/ncl/slash-commands/search', { params: { q } });

// ── Admin: All Submissions (cross-form view) ──────────────────────────────────

export const adminListAllSubmissions = (params = {}) =>
  httpClient.get('/api/admin/ncl/all-submissions', { params });

// ── Admin: Employee search (approver picker) ──────────────────────────────────

export const adminSearchEmployees = (q) =>
  httpClient.get('/api/admin/ncl/employees/search', { params: { q } });
