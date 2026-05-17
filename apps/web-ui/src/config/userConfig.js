// ─── User Configuration & Access Control ──────────────────────────────────────
// Manages user permissions and role-based access for the AURA application
// Users are identified by their email (UPN) from Azure AD

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

// ─── Authorized Users ────────────────────────────────────────────────────────
// Add users by their email (UPN from Azure AD)
// Format: 'user@domain.com': ROLES.<ROLE>
export const authorizedUsers = {
  // Admin Users
  'amol.metkari@alignedautomation.com': ROLES.ADMIN,
  'ayushi.singh@alignedautomation.com': ROLES.ADMIN,
  'maithili.joshi@alignedautomation.com': ROLES.ADMIN,
  'prashant.dikonda@alignedautomation.com': ROLES.ADMIN,
  'yogeshbrijlal.chandan@alignedautomation.com': ROLES.ADMIN,

  // HR Department
  'hr.manager@alignedautomation.com': ROLES.HR,
  'sarah.smith@alignedautomation.com': ROLES.HR,
  'hr.specialist@alignedautomation.com': ROLES.HR,
  
  // IT Department
  'it.manager@alignedautomation.com': ROLES.IT,
  'tech.lead@alignedautomation.com': ROLES.IT,
  'it.support@alignedautomation.com': ROLES.IT,
  
  // Organization / Management
  'org.manager@alignedautomation.com': ROLES.ORG,
  'operations@alignedautomation.com': ROLES.ORG,
  
  // Regular Users (can access chat but limited agent access)
  'jane.wilson@alignedautomation.com': ROLES.USER,
  'mike.johnson@alignedautomation.com': ROLES.USER,
};

// ─── User Access Control Functions ────────────────────────────────────────────

/**
 * Check if a user is authorized to access the application
 * @param {string} userEmail - User's email/UPN from Azure AD
 * @returns {boolean} True if user is authorized
 */
export function isUserAuthorized(userEmail) {
  return userEmail in authorizedUsers;
}

/**
 * Get the role for a specific user
 * @param {string} userEmail - User's email/UPN
 * @returns {string} User's role or ROLES.USER as default
 */
export function getUserRole(userEmail) {
  return authorizedUsers[userEmail] || ROLES.USER;
}

/**
 * Get permissions for a user
 * @param {string} userEmail - User's email/UPN
 * @returns {object} Permissions object for the user's role
 */
export function getUserPermissions(userEmail) {
  const role = getUserRole(userEmail);
  return rolePermissions[role] || rolePermissions[ROLES.USER];
}

/**
 * Check if user has access to a specific agent
 * @param {string} userEmail - User's email/UPN
 * @param {string} agentType - Agent type ('admin', 'hr', 'it', 'org')
 * @returns {boolean} True if user can access the agent
 */
export function canAccessAgent(userEmail, agentType) {
  const permissions = getUserPermissions(userEmail);
  return permissions.agents.includes(agentType);
}

/**
 * Check if user can access admin panel
 * @param {string} userEmail - User's email/UPN
 * @returns {boolean} True if user can access admin panel
 */
export function canAccessAdminPanel(userEmail) {
  const permissions = getUserPermissions(userEmail);
  return permissions.canAccessAdminPanel;
}

/**
 * Check if user can manage other users
 * @param {string} userEmail - User's email/UPN
 * @returns {boolean} True if user can manage users
 */
export function canManageUsers(userEmail) {
  const permissions = getUserPermissions(userEmail);
  return permissions.canManageUsers;
}

/**
 * Get all available agents for a user
 * @param {string} userEmail - User's email/UPN
 * @returns {array} Array of agent types the user can access
 */
export function getAvailableAgents(userEmail) {
  const permissions = getUserPermissions(userEmail);
  return permissions.agents;
}

/**
 * Add a new user (Admin only)
 * Note: This modifies the runtime config; for persistence, update the server-side config
 * @param {string} userEmail - User's email/UPN
 * @param {string} role - Role to assign
 * @returns {boolean} True if user was added successfully
 */
export function addUser(userEmail, role) {
  if (!Object.values(ROLES).includes(role)) {
    console.error(`Invalid role: ${role}`);
    return false;
  }
  authorizedUsers[userEmail] = role;
  console.log(`User ${userEmail} added with role ${role}`);
  return true;
}

/**
 * Remove a user (Admin only)
 * @param {string} userEmail - User's email/UPN
 * @returns {boolean} True if user was removed
 */
export function removeUser(userEmail) {
  if (userEmail in authorizedUsers) {
    delete authorizedUsers[userEmail];
    console.log(`User ${userEmail} removed`);
    return true;
  }
  return false;
}

/**
 * Update a user's role
 * @param {string} userEmail - User's email/UPN
 * @param {string} newRole - New role to assign
 * @returns {boolean} True if role was updated
 */
export function updateUserRole(userEmail, newRole) {
  if (!Object.values(ROLES).includes(newRole)) {
    console.error(`Invalid role: ${newRole}`);
    return false;
  }
  if (userEmail in authorizedUsers) {
    authorizedUsers[userEmail] = newRole;
    console.log(`User ${userEmail} role updated to ${newRole}`);
    return true;
  }
  return false;
}

/**
 * Get all users in a specific role
 * @param {string} role - Role to filter by
 * @returns {array} Array of users in the specified role
 */
export function getUsersByRole(role) {
  return Object.entries(authorizedUsers)
    .filter(([_, userRole]) => userRole === role)
    .map(([email, _]) => email);
}

/**
 * Get user summary for admin panel
 * @returns {array} Array of all users with their roles
 */
export function getAllUsers() {
  return Object.entries(authorizedUsers).map(([email, role]) => ({
    email,
    role,
    permissions: rolePermissions[role],
  }));
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
