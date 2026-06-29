// Field type definitions for the form designer palette

export const FIELD_CATEGORIES = [
  { id: 'basic',    label: 'Basic Fields' },
  { id: 'choice',   label: 'Choice Fields' },
  { id: 'datetime', label: 'Date & Time' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'layout',   label: 'Layout' },
];

export const FIELD_TYPES = [
  // Basic
  { type: 'text',      label: 'Short Text',     icon: 'fa-font',          category: 'basic'    },
  { type: 'textarea',  label: 'Long Text',      icon: 'fa-align-left',    category: 'basic'    },
  { type: 'number',    label: 'Number',         icon: 'fa-hashtag',       category: 'basic'    },
  { type: 'email',     label: 'Email',          icon: 'fa-envelope',      category: 'basic'    },
  { type: 'phone',     label: 'Phone',          icon: 'fa-phone',         category: 'basic'    },
  { type: 'url',       label: 'URL',            icon: 'fa-link',          category: 'basic'    },
  // Choice
  { type: 'dropdown',  label: 'Dropdown',       icon: 'fa-chevron-down',  category: 'choice'   },
  { type: 'radio',     label: 'Radio Buttons',  icon: 'fa-circle-dot',    category: 'choice'   },
  { type: 'checkbox',  label: 'Checkboxes',     icon: 'fa-check-square',  category: 'choice'   },
  { type: 'toggle',    label: 'Toggle',         icon: 'fa-toggle-on',     category: 'choice'   },
  { type: 'rating',    label: 'Rating',         icon: 'fa-star',          category: 'choice'   },
  { type: 'slider',    label: 'Slider',         icon: 'fa-sliders',       category: 'choice'   },
  // Date & Time
  { type: 'date',      label: 'Date',           icon: 'fa-calendar',      category: 'datetime' },
  { type: 'datetime',  label: 'Date & Time',    icon: 'fa-calendar-days', category: 'datetime' },
  { type: 'time',      label: 'Time',           icon: 'fa-clock',         category: 'datetime' },
  // Advanced
  { type: 'file',      label: 'File Upload',    icon: 'fa-upload',        category: 'advanced' },
  { type: 'signature', label: 'Signature',      icon: 'fa-pen-nib',       category: 'advanced' },
  { type: 'richtext',  label: 'Rich Text',      icon: 'fa-pen-to-square', category: 'advanced' },
  { type: 'hidden',    label: 'Hidden Field',   icon: 'fa-eye-slash',     category: 'advanced' },
  // Layout
  { type: 'heading',   label: 'Heading',        icon: 'fa-heading',       category: 'layout'   },
  { type: 'paragraph', label: 'Paragraph',      icon: 'fa-paragraph',     category: 'layout'   },
  { type: 'divider',   label: 'Divider',        icon: 'fa-minus',         category: 'layout'   },
];

export const FIELD_TYPE_MAP = Object.fromEntries(FIELD_TYPES.map(f => [f.type, f]));

export const HAS_OPTIONS = ['dropdown', 'radio', 'checkbox'];
export const HAS_FORMULA = ['number', 'text', 'hidden'];
export const LAYOUT_TYPES = ['heading', 'paragraph', 'divider'];
export const NON_DATA_TYPES = ['heading', 'paragraph', 'divider'];

export const WIDTH_OPTIONS = [
  { value: 'full',    label: 'Full Width' },
  { value: 'half',    label: 'Half Width' },
  { value: 'third',   label: 'One Third' },
  { value: 'quarter', label: 'One Quarter' },
];

export const OPERATOR_OPTIONS = [
  { value: 'eq',        label: 'equals' },
  { value: 'neq',       label: 'does not equal' },
  { value: 'gt',        label: 'is greater than' },
  { value: 'gte',       label: 'is greater than or equal to' },
  { value: 'lt',        label: 'is less than' },
  { value: 'lte',       label: 'is less than or equal to' },
  { value: 'contains',  label: 'contains' },
  { value: 'empty',     label: 'is empty' },
  { value: 'not_empty', label: 'is not empty' },
];

export const CONDITION_ACTIONS = [
  { value: 'show',      label: 'Show this field' },
  { value: 'hide',      label: 'Hide this field' },
  { value: 'require',   label: 'Make required' },
  { value: 'unrequire', label: 'Make optional' },
  { value: 'set_value', label: 'Set value' },
];

export const DEFAULT_SETTINGS = {
  submit_label:      'Submit',
  success_message:   'Thank you! Your response has been submitted.',
  width:             '720px',
  show_progress:     false,
  allow_draft:       false,
  multi_submit:      false,
};
