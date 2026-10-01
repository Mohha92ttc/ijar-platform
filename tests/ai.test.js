import { test, describe } from 'node:test';
import assert from 'node:assert';
import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_API_BASE || 'http://localhost:5173/api';

describe('AI API Tests', () => {
  test('POST /api/ai/recommendations - should get AI recommendations', async () => {
    const requestData = {
      userId: 'test-user-id',
      equipmentType: 'construction',
      location: 'Baghdad'
    };

    const response = await fetch(`${BASE_URL}/ai/recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token'
      },
      body: JSON.stringify(requestData)
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.ok(data.personalized);
    assert.ok(Array.isArray(data.personalized));
  });

  test('POST /api/ai/demand-prediction - should predict equipment demand', async () => {
    const requestData = {
      timeRange: 'next_month',
      equipmentCategory: 'construction',
      location: 'Baghdad'
    };

    const response = await fetch(`${BASE_URL}/ai/demand-prediction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token'
      },
      body: JSON.stringify(requestData)
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.ok(data.nextMonth);
    assert.ok(data.nextMonth.demand);
    assert.ok(data.nextMonth.confidence);
  });

  test('POST /api/ai/smart-search - should perform smart search', async () => {
    const requestData = {
      query: 'excavator',
      filters: {
        category: 'construction',
        priceRange: [100, 200]
      },
      userId: 'test-user-id'
    };

    const response = await fetch(`${BASE_URL}/ai/smart-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token'
      },
      body: JSON.stringify(requestData)
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.ok(data.results);
    assert.ok(Array.isArray(data.results));
    assert.ok(data.searchTime);
  });
});
