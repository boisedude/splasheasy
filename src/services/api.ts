import { Reading, Verdict } from '../types';

const API_BASE_URL = window.location.hostname.includes('azurestaticapps.net') 
  ? '/api' // Azure Static Web Apps automatically routes /api to the Functions app
  : 'http://localhost:7071/api'; // Local development

export class ApiService {
  static async analyzeWater(reading: Reading): Promise<Verdict> {
    try {
      const response = await fetch(`${API_BASE_URL}/analyzeWater`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reading),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }
}