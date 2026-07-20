// ─── User Configuration & Access Control ──────────────────────────────────────
// Manages user permissions and role-based access for the AURA application
// Users are identified by their email (UPN) from Azure AD
//
// Role assignment (who is 'admin', 'hr', etc.) is stored server-side in the
// app_users table and managed from the Admin Panel — see
// apps/api-gateway/app/api/controllers/admin_users_controller.py.
// This file only defines the static ROLES and what each role can do.

// ─── User Roles ───────────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN: 'admin',
  HR: 'hr',
  IT: 'it',
  ORG: 'org',
  USER: 'user', // Default role with limited access
};

// ─── Role Permissions ────────────────────────────────────────────────────────
export const rolePermissions = {
  [ROLES.ADMIN]: {
    canAccessAdminPanel: true,
    canAccessAllAgents: true,
    canManageUsers: true,
    agents: ['admin', 'hr', 'it', 'org'],
  },
  [ROLES.HR]: {
    canAccessAdminPanel: false,
    canAccessAllAgents: false,
    canManageUsers: false,
    agents: ['hr'],
  },
  [ROLES.IT]: {
    canAccessAdminPanel: false,
    canAccessAllAgents: false,
    canManageUsers: false,
    agents: ['it'],
  },
  [ROLES.ORG]: {
    canAccessAdminPanel: false,
    canAccessAllAgents: false,
    canManageUsers: false,
    agents: ['org'],
  },
  [ROLES.USER]: {
    canAccessAdminPanel: false,
    canAccessAllAgents: false,
    canManageUsers: false,
    agents: [], // Limited to general chat only
  },
};

/**
 * Get permissions for a given role.
 * @param {string} role - One of ROLES.*
 * @returns {object} Permissions object for the role (defaults to ROLES.USER)
 */
export function getPermissionsForRole(role) {
  return rolePermissions[role] || rolePermissions[ROLES.USER];
}

/**
 * Check if a user is authorized to access the application.
 * All authenticated Azure AD users are allowed; role defaults to ROLES.USER
 * for anyone without an app_users role assignment.
 * @param {string} userEmail - User's email/UPN from Azure AD
 * @returns {boolean} Always true — access is open to all org members
 */
export function isUserAuthorized(userEmail) {
  return true;
}

// ── Allocation Board roles (sourced from backend; these are UI-side labels) ──
export const ALLOCATION_ROLES = {
  EXECUTIVE:       'executive',
  BUSINESS_LEAD:   'business_lead',
  FUNCTIONAL_LEAD: 'functional_lead',
  TEAM_LEAD:       'team_lead',
  EMPLOYEE:        'employee',
};

export const ANALYTICS_ROLES = [
  ALLOCATION_ROLES.EXECUTIVE,
  ALLOCATION_ROLES.BUSINESS_LEAD,
  ALLOCATION_ROLES.FUNCTIONAL_LEAD,
];
