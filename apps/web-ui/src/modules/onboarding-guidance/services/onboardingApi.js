let API_URL = import.meta.env.VITE_API_URL || '';
if (import.meta.env.DEV) {
  // In local Vite dev, use the proxy mapped at /api to avoid HTTPS->HTTP mixed content.
  API_URL = '';
}

export async function fetchEmployeeProfile(email) {
  const res = await fetch(
    `${API_URL}/api/onboarding/employee?email=${encodeURIComponent(email)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch employee profile (${res.status})`);
  }
  return res.json();
}

export async function fetchPeers(email) {
  const res = await fetch(
    `${API_URL}/api/onboarding/peers?email=${encodeURIComponent(email)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch peers (${res.status})`);
  }
  return res.json();
}
