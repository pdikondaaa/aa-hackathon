// ─────────────────────────────────────────────────────────────────────────────
// AURA API Quick Reference
// Quick copy-paste examples for common API calls
// ─────────────────────────────────────────────────────────────────────────────

// IMPORT
// ─────────────────────────────────────────────────────────────────────────────
import { 
  askBot,
  getLeaves,
  requestLeave,
  getPayroll,
  getITTickets,
  createITTicket,
  getDirectory,
  apiConfig,
  apiGet,
  apiPost,
} from '@/services/api';

// ═════════════════════════════════════════════════════════════════════════════
// CHAT / AI ASSISTANT
// ═════════════════════════════════════════════════════════════════════════════

// Send a message to AI assistant
const response = await askBot("How many leaves do I have?");
console.log(response.answer);

// ═════════════════════════════════════════════════════════════════════════════
// HR REQUESTS
// ═════════════════════════════════════════════════════════════════════════════

// Check leave balance
const leaves = await getLeaves();
// { total: 20, used: 5, remaining: 15, ... }

// Request leave
const leaveRequest = await requestLeave({
  startDate: '2026-05-20',
  endDate: '2026-05-22',
  reason: 'Personal',
  type: 'casual'
});

// Get payroll info
const payroll = await getPayroll();
// { salary: 100000, YTD: 45000, ... }

// Get benefits
const benefits = await getBenefits();

// ═════════════════════════════════════════════════════════════════════════════
// IT REQUESTS
// ═════════════════════════════════════════════════════════════════════════════

// Get IT tickets
const tickets = await getITTickets();
// [{ id: 'INC001', title: '...', status: 'open', ... }]

// Create IT ticket
const ticket = await createITTicket({
  title: 'VPN not working',
  description: 'Cannot connect to office VPN',
  priority: 'high',
  category: 'network'
});

// Request access
const accessRequest = await requestAccess({
  resource: 'SharePoint-Docs',
  reason: 'Project onboarding',
  duration: '30-days'
});

// ═════════════════════════════════════════════════════════════════════════════
// ORG / DIRECTORY
// ═════════════════════════════════════════════════════════════════════════════

// Search directory
const employees = await getDirectory({ query: 'John', department: 'Engineering' });

// Get organization structure
const orgChart = await getOrgStructure();

// Get teams
const teams = await getTeams();

// Get announcements
const announcements = await getAnnouncements();

// ═════════════════════════════════════════════════════════════════════════════
// DOCUMENTS
// ═════════════════════════════════════════════════════════════════════════════

// List available documents
const docs = await listDocuments();
// [{ id: 'doc1', name: 'NOC Letter', type: 'noc', ... }]

// Generate document
const generated = await generateDocument({
  type: 'noc-letter',
  employeeId: '12345',
  purpose: 'Visa application'
});

// Download document (opens in browser)
downloadDocument('doc-id-123');

// ═════════════════════════════════════════════════════════════════════════════
// GENERIC API CALLS
// ═════────────────────────────────────────────────────────────────────────────

// GET request
const data = await apiGet('/api/hr/profile');

// POST request with data
const result = await apiPost('/api/chat', {
  message: 'Hello',
  sessionId: '123'
});

// POST with custom headers
const result = await apiPost(
  '/api/documents/generate',
  { type: 'offer-letter' },
  { 'X-Authorization': 'Bearer token' }
);

// ═════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═════════════════════════════════════════════════════════════════════════════

try {
  const response = await askBot("Hello");
  console.log(response);
} catch (error) {
  console.error('API Error:', error.message);
  
  if (error.status === 401) {
    // Unauthorized - redirect to login
    window.location.href = '/login';
  } else if (error.status === 403) {
    // Forbidden - show permission error
    alert('You do not have permission to perform this action');
  } else if (error.status >= 500) {
    // Server error - show retry option
    alert('Server error. Please try again later.');
  } else {
    // Other error
    alert(`Error: ${error.message}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CHECK API STATUS
// ═════════════════════════════════════════════════════════════════════════════

// Check current API configuration
console.log('API URL:', apiConfig.baseUrl);
// Output: http://localhost:8000 or https://api.aligned.com

console.log('Environment:', apiConfig.environment);
// Output: development, staging, or production

console.log('Timeout:', apiConfig.timeout);
// Output: 30000 (30 seconds)

console.log('Retry attempts:', apiConfig.retryAttempts);
// Output: 3

// ═════════════════════════════════════════════════════════════════════════════
// IN REACT COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { getLeaves } from '@/services/api';

function MyComponent() {
  const [leaves, setLeaves] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getLeaves();
        setLeaves(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <p>Remaining leaves: {leaves.remaining} days</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES (.env.local)
// ═════════════════════════════════════════════════════════════════════════════

// LOCAL DEVELOPMENT
REACT_APP_API_URL=http://localhost:8000

// STAGING DEPLOYMENT
REACT_APP_API_URL=https://api-staging.aligned.com

// PRODUCTION DEPLOYMENT
REACT_APP_API_URL=https://api.aligned.com

// ═════════════════════════════════════════════════════════════════════════════
// DOCKER BUILD WITH API URL
// ═════════════════════════════════════════════════════════════════════════════

// Development
docker build -t aura-web-ui:dev .
docker run -p 3000:3000 aura-web-ui:dev

// Production with custom API
docker build \
  --build-arg REACT_APP_API_URL=https://api.aligned.com \
  --build-arg REACT_APP_CLIENT_ID=prod-client-id \
  -t aura-web-ui:latest .

docker run -p 3000:3000 aura-web-ui:latest

// ═════════════════════════════════════════════════════════════════════════════
// See API_CONFIG_GUIDE.md for detailed documentation
// ═════════════════════════════════════════════════════════════════════════════
