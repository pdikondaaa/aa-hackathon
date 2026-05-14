const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
