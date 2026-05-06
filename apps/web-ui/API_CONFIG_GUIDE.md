# AURA API Configuration Guide

## Overview

The AURA frontend now includes a comprehensive API configuration system that supports:
- ✅ Multiple environment deployments (dev, staging, production)
- ✅ Automatic retry logic for failed requests
- ✅ Request/response logging in development mode
- ✅ Timeout handling and error management
- ✅ Credentials support for authenticated requests

## Quick Start

### 1. Configure API Endpoint

Edit `.env.local` (local development) or set environment variables during deployment:

```bash
# Local Development
REACT_APP_API_URL=http://localhost:8000

# Staging
REACT_APP_API_URL=https://api-staging.aligned.com

# Production
REACT_APP_API_URL=https://api.aligned.com
```

### 2. Use API in Components

```javascript
import { askBot, getLeaves, createITTicket, apiConfig } from '@/services/api';

// Simple chat request
const response = await askBot("How many leaves do I have?");
console.log(response); // { answer: "..." }

// HR API
const leaves = await getLeaves();
console.log(leaves); // { total: 20, used: 5, remaining: 15 }

// IT API - Create ticket
const ticket = await createITTicket({
  title: "VPN not working",
  description: "Cannot connect to VPN",
  priority: "high"
});

// Check API status
console.log(apiConfig.baseUrl); // Current API base URL
console.log(apiConfig.environment); // dev, staging, or production
```

## Environment Variables

### Required for Deployment

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Base API URL | `https://api.aligned.com` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_TENANT_ID` | Azure AD Tenant ID | - |
| `REACT_APP_CLIENT_ID` | Azure AD Client ID | - |
| `REACT_APP_REDIRECT_URI` | OAuth Redirect URI | `http://localhost:3000` |
| `REACT_APP_ENABLE_STREAMING` | Enable streaming responses | `true` |
| `REACT_APP_ENABLE_DARK_MODE` | Enable dark theme | `true` |

## API Endpoints Structure

All endpoints are centralized in `src/config/apiConfig.js`:

### Chat Endpoints
```
POST   /api/chat              # Send message
POST   /api/chat/stream       # Stream response
GET    /api/chat/history      # Get chat history
GET    /api/chat/sessions     # List sessions
```

### HR Endpoints
```
GET    /api/hr/leaves         # Get leave balance
POST   /api/hr/leaves/request # Request leave
GET    /api/hr/payroll        # Get payroll info
GET    /api/hr/benefits       # Get benefits
GET    /api/hr/profile        # Get HR profile
```

### IT Endpoints
```
GET    /api/it/tickets              # List tickets
POST   /api/it/tickets/create       # Create ticket
GET    /api/it/tickets/:id          # Get ticket
PUT    /api/it/tickets/:id          # Update ticket
POST   /api/it/access/request       # Request access
```

### Admin Endpoints
```
GET    /api/admin/users             # List users
GET    /api/admin/roles             # Get roles
GET    /api/admin/permissions       # Get permissions
GET    /api/admin/audit-logs        # Get audit logs
```

### Org Endpoints
```
GET    /api/org/structure           # Get org structure
GET    /api/org/directory           # Search directory
GET    /api/org/teams               # Get teams
GET    /api/org/announcements       # Get announcements
```

### Document Endpoints
```
GET    /api/documents               # List documents
POST   /api/documents/generate      # Generate document
GET    /api/documents/:id/download  # Download document
```

## API Functions

### Basic HTTP Methods

```javascript
import { 
  apiGet, 
  apiPost, 
  apiPut, 
  apiDelete, 
  apiPatch 
} from '@/services/api';

// GET request
const data = await apiGet('/api/hr/leaves');

// POST request
const result = await apiPost('/api/hr/leaves/request', {
  startDate: '2026-05-20',
  endDate: '2026-05-22',
  reason: 'Personal'
});

// PUT request
const updated = await apiPut('/api/it/tickets/:id', 
  { status: 'resolved' },
  { id: '123' }
);

// DELETE request
await apiDelete('/api/chat/sessions', { sessionId: '456' });

// PATCH request
const patched = await apiPatch('/api/hr/profile', 
  { department: 'Engineering' }
);
```

### Helper Functions

```javascript
import { getApiUrl, apiConfig } from '@/services/api';

// Get full API URL
const url = getApiUrl('/api/chat', {}); 
// Result: "http://localhost:8000/api/chat" or "https://api.aligned.com/api/chat"

// Replace URL parameters
const url = getApiUrl('/api/it/tickets/:id', { id: '123' });
// Result: "http://localhost:8000/api/it/tickets/123"

// Check current configuration
console.log(apiConfig.baseUrl);       // Current API URL
console.log(apiConfig.environment);   // Current environment
console.log(apiConfig.debug);         // Debug logging enabled?
```

## Error Handling

All API calls include automatic retry logic for transient failures:

```javascript
import { askBot } from '@/services/api';

try {
  const response = await askBot("Hello");
  console.log(response);
} catch (error) {
  // Auto-retried 3 times, all failed
  console.error('API Error:', error.message);
  console.error('Status:', error.status);
  console.error('Details:', error.data);
  
  // Show user-friendly error
  if (error.status === 401) {
    // Handle unauthorized
  } else if (error.status === 503) {
    // Service unavailable
  } else {
    // Generic error
  }
}
```

## Request/Response Logging

In development mode (NODE_ENV=development), all API calls are logged to the console:

```
🔗 API Call — POST
URL: http://localhost:8000/api/chat
Data: { message: "How many leaves?" }

✅ API Response — POST
URL: http://localhost:8000/api/chat
Response: { answer: "You have 15 days left" }
Duration: 245ms
```

To disable logging, modify `apiConfig.debug`:

```javascript
// src/config/apiConfig.js
debug: false, // Change from ENV === 'development'
```

## Deployment Examples

### Docker Build with Custom API

```bash
# Staging
docker build \
  --build-arg REACT_APP_API_URL=https://api-staging.aligned.com \
  --build-arg REACT_APP_CLIENT_ID=staging-client-id \
  --build-arg REACT_APP_TENANT_ID=staging-tenant-id \
  -t aura-web-ui:staging .

docker run -p 3000:3000 aura-web-ui:staging
```

```bash
# Production
docker build \
  --build-arg REACT_APP_API_URL=https://api.aligned.com \
  --build-arg REACT_APP_CLIENT_ID=prod-client-id \
  --build-arg REACT_APP_TENANT_ID=prod-tenant-id \
  -t aura-web-ui:latest .

docker run -p 3000:3000 aura-web-ui:latest
```

### CI/CD Pipeline (GitHub Actions Example)

```yaml
- name: Build Docker image
  run: |
    docker build \
      --build-arg REACT_APP_API_URL=${{ secrets.API_URL }} \
      --build-arg REACT_APP_CLIENT_ID=${{ secrets.CLIENT_ID }} \
      --build-arg REACT_APP_TENANT_ID=${{ secrets.TENANT_ID }} \
      -t aura-web-ui:latest .
```

### Local Development

```bash
# Copy example env file
cp .env.example .env.local

# Edit .env.local with your settings
# Point to local API
REACT_APP_API_URL=http://localhost:8000

# Start development server
npm start
```

## Configuration by Environment

### Development (Local)
- API: `http://localhost:8000`
- Retries: Enabled (3 attempts)
- Logging: Enabled
- Timeout: 30 seconds

### Staging
- API: `https://api-staging.aligned.com`
- Retries: Enabled (3 attempts)
- Logging: Disabled
- Timeout: 30 seconds

### Production
- API: `https://api.aligned.com`
- Retries: Enabled (3 attempts)
- Logging: Disabled
- Timeout: 30 seconds

## Common Tasks

### Change API Endpoint at Runtime

```javascript
// Note: This is for advanced use cases only
// Best practice: Use environment variables
import apiConfig from '@/config/apiConfig';

apiConfig.baseUrl = 'https://new-api.example.com';
```

### Add Custom Headers

```javascript
import { apiPost } from '@/services/api';

const response = await apiPost(
  '/api/chat',
  { message: 'Hello' },
  { 'X-Custom-Header': 'value' }  // Custom headers
);
```

### Implement Request Timeout Alert

```javascript
import { apiConfig } from '@/services/api';

const originalTimeout = apiConfig.timeout;

// Increase timeout for slow networks
apiConfig.timeout = 60000; // 60 seconds

try {
  await someApiCall();
} finally {
  // Restore original timeout
  apiConfig.timeout = originalTimeout;
}
```

## Troubleshooting

### "Failed to fetch" Error

**Issue**: Cannot reach API server

**Solution**:
1. Check `REACT_APP_API_URL` is correct
2. Verify API server is running
3. Check CORS configuration on API server
4. Check browser console for detailed error

### 401 Unauthorized

**Issue**: Authentication failed

**Solution**:
1. Ensure user is logged in
2. Check Azure AD configuration in `.env.local`
3. Verify credentials are being sent with requests

### Timeout Errors

**Issue**: Request takes too long

**Solution**:
1. Increase `apiConfig.timeout` in code
2. Check API server performance
3. Reduce data size in requests

## File Structure

```
src/
├── config/
│   ├── apiConfig.js          ← API configuration (edit here)
│   └── chatConfig.js         ← UI configuration
├── services/
│   ├── api.js                ← API functions (auto-uses apiConfig)
│   └── authService.js        ← Authentication
└── components/
    └── ChatWindow.jsx        ← Example usage: askBot()
```

## Next Steps

1. **Configure API URL** in `.env.local` for your deployment
2. **Test API connection** by opening DevTools → Console
3. **Deploy** using Docker with appropriate build arguments
4. **Monitor** API calls in browser DevTools

For more information, see the API code in `src/config/apiConfig.js` and `src/services/api.js`.
