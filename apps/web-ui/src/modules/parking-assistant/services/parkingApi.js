import httpClient from '../../../services/api';

export const parkingApi = {
  async getMyRequest() {
    return httpClient.get('/api/parking/request');
  },

  async submitRequest(data) {
    return httpClient.post('/api/parking/request', data);
  },

  async submitDeactivation(data) {
    return httpClient.post('/api/parking/deactivate', data);
  },
};
