import { useState, useCallback } from 'react';
import { DEFAULT_SETTINGS } from '../constants/fieldTypes';
import {
  adminCreateForm, adminUpdateForm, adminAddField,
  adminUpdateField, adminDeleteField, adminReorderFields,
  adminPublishForm, adminGetForm,
} from '../services/formBuilderApi';

const _id = () => `tmp_${Math.random().toString(36).slice(2, 9)}`;

function buildField(fieldType, orderIndex = 0) {
  return {
    id: _id(),
    field_type: fieldType,
    label: fieldType.charAt(0).toUpperCase() + fieldType.slice(1),
    name: `${fieldType}_${Date.now()}`,
    placeholder: '',
    help_text: '',
    default_value: '',
    required: false,
    read_only: false,
    hidden: false,
    order_index: orderIndex,
    width: 'full',
    options: [],
    validation_rules: {},
    conditional_logic: [],
    formula: '',
    style: {},
    metadata: {},
    _isNew: true,
  };
}

export function useFormDesigner(initialFormId = null) {
  const [formId, setFormId] = useState(initialFormId);
  const [formMeta, setFormMeta] = useState({
    name: '',
    slug: '',
    description: '',
    category: '',
    icon: '',
    alias: '',
    tags: [],
    keywords: [],
    allowed_roles: [],
    settings: { ...DEFAULT_SETTINGS },
  });
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // ── Load existing form ──────────────────────────────────────────────────────
  const loadForm = useCallback(async (id) => {
    try {
      const data = await adminGetForm(id);
      setFormId(data.id);
      setFormMeta({
        name: data.name,
        slug: data.slug,
        description: data.description || '',
        category: data.category || '',
        icon: data.icon || '',
        alias: data.alias || '',
        tags: data.tags || [],
        keywords: data.keywords || [],
        allowed_roles: data.allowed_roles || [],
        settings: data.settings || { ...DEFAULT_SETTINGS },
      });
      setSections(data.sections || []);
      setFields(data.fields || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // ── Drag and drop: add field from palette ──────────────────────────────────
  const addField = useCallback((fieldType, sectionId = null, afterIndex = null) => {
    const orderIndex = afterIndex !== null ? afterIndex + 1 : fields.length;
    const newField = { ...buildField(fieldType, orderIndex), section_id: sectionId };
    setFields(prev => {
      const updated = [
        ...prev.slice(0, orderIndex),
        newField,
        ...prev.slice(orderIndex),
      ].map((f, i) => ({ ...f, order_index: i }));
      return updated;
    });
    setSelectedFieldId(newField.id);
  }, [fields.length]);

  // ── Move field (drag within canvas) ───────────────────────────────────────
  const moveField = useCallback((fromIndex, toIndex) => {
    setFields(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated.map((f, i) => ({ ...f, order_index: i }));
    });
  }, []);

  // ── Update selected field properties ──────────────────────────────────────
  const updateField = useCallback((fieldId, changes) => {
    setFields(prev =>
      prev.map(f => f.id === fieldId ? { ...f, ...changes } : f)
    );
  }, []);

  // ── Remove field ──────────────────────────────────────────────────────────
  const removeField = useCallback((fieldId) => {
    setFields(prev =>
      prev.filter(f => f.id !== fieldId).map((f, i) => ({ ...f, order_index: i }))
    );
    setSelectedFieldId(null);
  }, []);

  // ── Duplicate field ────────────────────────────────────────────────────────
  const duplicateField = useCallback((fieldId) => {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === fieldId);
      if (idx < 0) return prev;
      const source = prev[idx];
      const copy = {
        ...source,
        id: _id(),
        name: `${source.name}_copy`,
        order_index: idx + 1,
        _isNew: true,
      };
      return [
        ...prev.slice(0, idx + 1),
        copy,
        ...prev.slice(idx + 1),
      ].map((f, i) => ({ ...f, order_index: i }));
    });
  }, []);

  // ── Add / update section ──────────────────────────────────────────────────
  const addSection = useCallback((sectionData = {}) => {
    setSections(prev => [
      ...prev,
      {
        id: _id(),
        title: sectionData.title || 'Section',
        description: sectionData.description || '',
        order_index: prev.length,
        collapsed: false,
        conditions: [],
        _isNew: true,
      },
    ]);
  }, []);

  const updateSection = useCallback((sectionId, changes) => {
    setSections(prev =>
      prev.map(s => s.id === sectionId ? { ...s, ...changes } : s)
    );
  }, []);

  const removeSection = useCallback((sectionId) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
    setFields(prev =>
      prev.map(f => f.section_id === sectionId ? { ...f, section_id: null } : f)
    );
  }, []);

  // ── Save / publish ─────────────────────────────────────────────────────────
  const saveForm = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      let id = formId;
      if (!id) {
        // Derive slug from name when blank
        const resolvedSlug = formMeta.slug ||
          formMeta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        if (!formMeta.name.trim()) {
          throw new Error('Form name is required before saving');
        }
        if (!resolvedSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resolvedSlug)) {
          throw new Error('Could not generate a valid slug — set one in Settings');
        }

        const created = await adminCreateForm({
          ...formMeta,
          slug: resolvedSlug,
          sections,
          fields: fields.map(f => {
            // eslint-disable-next-line no-unused-vars
            const { id: _ignore, _isNew, ...rest } = f;
            return rest;
          }),
        });
        id = created.id;
        setFormId(id);
        await loadForm(id);
      } else {
        await adminUpdateForm(id, formMeta);
        // Sync fields that changed
        for (const f of fields) {
          const { _isNew, ...data } = f;
          if (_isNew) {
            await adminAddField(id, data);
          } else {
            await adminUpdateField(id, f.id, data);
          }
        }
        await adminReorderFields(
          id,
          fields.map(f => ({
            id: f.id,
            order_index: f.order_index,
            section_id: f.section_id || null,
          }))
        );
        await loadForm(id);
      }
      return id;
    } catch (e) {
      setError(e.message || 'Save failed');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [formId, formMeta, sections, fields, loadForm]);

  const publishForm = useCallback(async (changeNotes) => {
    const id = formId || (await saveForm());
    await adminPublishForm(id, changeNotes);
    await loadForm(id);
  }, [formId, saveForm, loadForm]);

  const selectedField = fields.find(f => f.id === selectedFieldId) || null;

  return {
    formId, formMeta, sections, fields, selectedField, selectedFieldId,
    saving, error,
    setFormMeta, setSelectedFieldId, setFields, setSections,
    loadForm, addField, moveField, updateField, removeField, duplicateField,
    addSection, updateSection, removeSection,
    saveForm, publishForm,
  };
}
