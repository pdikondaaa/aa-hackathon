import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig, loginRequest, graphRequest, graphConfig, plannerRequest, calendarRequest } from '../config/authConfig';
import {
  isUserAuthorized,
  getUserRole,
  getUserPermissions,
  getAvailableAgents,
  canAccessAdminPanel,
} from '../config/userConfig';

export const msalInstance = new PublicClientApplication(msalConfig);

let _initialized = false;

export async function initializeMsal() {
  if (_initialized) return;
  // initialize() is a no-op after the first call; handleRedirectPromise runs in main.jsx
  await msalInstance.initialize();
  _initialized = true;
}

export function getCachedAccount() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return null;
  msalInstance.setActiveAccount(accounts[0]);
  return accounts[0];
}

export async function loginWithRedirect() {
  await msalInstance.loginRedirect(loginRequest);
  // loginRedirect navigates away — execution never reaches here
}

export async function logout() {
  const account = msalInstance.getActiveAccount();
  await msalInstance.logoutRedirect({ account, postLogoutRedirectUri: window.location.origin });
}

// Build user from MSAL ID token claims — always works, no admin consent required.
function buildUserFromAccount(account) {
  const claims = account?.idTokenClaims || {};
  const name  = claims.name              || account?.name     || account?.username || 'User';
  const email = claims.preferred_username || claims.email     || account?.username || '';
  return { displayName: name, mail: email, userPrincipalName: account?.username || email, department: '', jobTitle: '' };
}

// Acquire a Graph token silently; returns null if consent is missing.
async function acquireGraphToken() {
  try {
    const account = msalInstance.getActiveAccount();
    return await msalInstance.acquireTokenSilent({ ...graphRequest, account });
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) return null;
    throw err;
  }
}

// Silently try Microsoft Graph for richer profile data (department, jobTitle).
// Falls back gracefully if User.Read consent has not been granted by an admin.
async function tryGraphEnrichment() {
  try {
    const token = await acquireGraphToken();
    if (!token) return null;
    const res = await fetch(graphConfig.graphMeEndpoint, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

// Fetch the user's profile photo from Graph and return a blob object URL.
// Returns null if the user has no photo or User.Read consent is missing.
async function fetchUserPhotoUrl() {
  try {
    const token = await acquireGraphToken();
    if (!token) return null;
    const res = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// Primary entry point called after login and on session restore.
// ID token always provides name + email. Graph optionally adds department/jobTitle/photo.
export async function fetchUserProfile() {
  const account = getCachedAccount();
  if (!account) throw new Error('No active account');

  const base  = buildUserFromAccount(account);
  const [graph, photo] = await Promise.all([tryGraphEnrichment(), fetchUserPhotoUrl()]);

  return {
    displayName: graph?.displayName || base.displayName,
    mail:        graph?.mail        || base.mail,
    userPrincipalName: graph?.userPrincipalName || base.userPrincipalName,
    department:  graph?.department  || '',
    jobTitle:    graph?.jobTitle    || '',
    photo:       photo              || null,
  };
}

export function getInitials(displayName = '') {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

export function buildUser(profile) {
  return {
    name:       profile.displayName        || profile.userPrincipalName || 'User',
    email:      profile.mail               || profile.userPrincipalName || '',
    initials:   getInitials(profile.displayName || profile.userPrincipalName || ''),
    department: profile.department         || '',
    jobTitle:   profile.jobTitle           || '',
    photo:      profile.photo              || null,
  };
}

// ─── Microsoft Planner Integration ────────────────────────────────────────────

async function acquirePlannerToken() {
  try {
    const account = msalInstance.getActiveAccount();
    return await msalInstance.acquireTokenSilent({ ...plannerRequest, account });
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      try {
        return await msalInstance.acquireTokenPopup({ ...plannerRequest });
      } catch {
        return null;
      }
    }
    throw err;
  }
}

export async function fetchPlannerTasks() {
  try {
    const token = await acquirePlannerToken();
    if (!token) return { tasks: [], error: 'consent_required' };

    const res = await fetch('https://graph.microsoft.com/v1.0/me/planner/tasks', {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });

    if (!res.ok) {
      if (res.status === 403) return { tasks: [], error: 'no_permission' };
      return { tasks: [], error: 'fetch_failed' };
    }

    const data = await res.json();
    const rawTasks = data.value || [];

    // Fetch plan titles in parallel (deduplicated by planId)
    const planIds = [...new Set(rawTasks.map(t => t.planId).filter(Boolean))];
    const planTitles = {};
    await Promise.all(
      planIds.map(async (planId) => {
        try {
          const planRes = await fetch(`https://graph.microsoft.com/v1.0/planner/plans/${planId}`, {
            headers: { Authorization: `Bearer ${token.accessToken}` },
          });
          if (planRes.ok) {
            const plan = await planRes.json();
            planTitles[planId] = plan.title;
          }
        } catch { /* ignore individual plan fetch failures */ }
      })
    );

    return {
      tasks: rawTasks.map(t => ({
        id: t.id,
        title: t.title,
        percentComplete: t.percentComplete ?? 0,
        dueDateTime: t.dueDateTime || null,
        createdDateTime: t.createdDateTime || null,
        planId: t.planId,
        bucketId: t.bucketId,
        priority: t.priority ?? 9,
        planTitle: planTitles[t.planId] || null,
        checklistItemCount: t.checklistItemCount ?? 0,
        activeChecklistItemCount: t.activeChecklistItemCount ?? 0,
      })),
      error: null,
    };
  } catch {
    return { tasks: [], error: 'fetch_failed' };
  }
}

// ─── Calendar Integration ──────────────────────────────────────────────────────

async function acquireCalendarToken() {
  try {
    const account = msalInstance.getActiveAccount();
    return await msalInstance.acquireTokenSilent({ ...calendarRequest, account });
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      try {
        return await msalInstance.acquireTokenPopup({ ...calendarRequest });
      } catch {
        return null;
      }
    }
    throw err;
  }
}

export async function fetchCalendarEvents(daysAhead = 30, top = 10) {
  try {
    const token = await acquireCalendarToken();
    if (!token) return { events: [], error: 'consent_required' };

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + daysAhead);

    const params = new URLSearchParams({
      startDateTime: now.toISOString(),
      endDateTime:   end.toISOString(),
      $top:          String(top),
      $select:       'subject,start,end,isAllDay,location',
      $orderby:      'start/dateTime',
    });

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
      { headers: { Authorization: `Bearer ${token.accessToken}` } },
    );

    if (!res.ok) {
      if (res.status === 403) return { events: [], error: 'no_permission' };
      return { events: [], error: 'fetch_failed' };
    }

    const data = await res.json();
    return {
      events: (data.value || []).map((e, i) => ({
        id:           e.id || i,
        title:        e.subject || '(No title)',
        start:        e.start?.dateTime || e.start?.date || null,
        startZone:    e.start?.timeZone || null,
        end:          e.end?.dateTime   || e.end?.date   || null,
        endZone:      e.end?.timeZone   || null,
        isAllDay:     e.isAllDay ?? false,
        location:     e.location?.displayName || null,
      })),
      error: null,
    };
  } catch {
    return { events: [], error: 'fetch_failed' };
  }
}

// ─── User Authorization Functions ─────────────────────────────────────────────

/**
 * Check if the logged-in user is authorized to access the application
 * @param {string} userEmail - User's email/UPN
 * @returns {boolean} True if user is authorized
 */
export function checkUserAuthorization(userEmail) {
  return isUserAuthorized(userEmail);
}

/**
 * Get user's role and permissions
 * @param {string} userEmail - User's email/UPN
 * @returns {object} User info with role and permissions
 */
export function getUserInfo(userEmail) {
  return {
    email: userEmail,
    role: getUserRole(userEmail),
    permissions: getUserPermissions(userEmail),
    availableAgents: getAvailableAgents(userEmail),
    isAdmin: canAccessAdminPanel(userEmail),
  };
}

