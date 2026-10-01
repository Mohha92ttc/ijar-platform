import { test, describe } from 'node:test';
import assert from 'node:assert';
import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_API_BASE || 'http://localhost:5173/api';

describe('Equipment API Tests', { concurrency: false }, () => {
  let createdEquipmentId;

  test('GET /api/equipment - should get all equipment', async () => {
    const response = await fetch(`${BASE_URL}/equipment`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.ok(Array.isArray(data));
  });

  test('POST /api/equipment - should create new equipment', async () => {
    const equipmentData = {
      name: 'Test Excavator',
      description: 'Heavy duty excavator',
      category: 'construction',
      price: 150,
      location: 'Baghdad',
      specifications: {
        weight: '5000kg',
        power: '200HP',
      },
    };

    const response = await fetch(`${BASE_URL}/equipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-token',
      },
      body: JSON.stringify(equipmentData),
    });

    assert.strictEqual(response.status, 201);
    const data = await response.json();
    assert.strictEqual(data.title, equipmentData.name);
    assert.strictEqual(data.category, equipmentData.category);
    createdEquipmentId = data.id;
  });

  test('GET /api/equipment/:id - should get specific equipment', async () => {
    assert.ok(createdEquipmentId, 'create test must run first');
    const response = await fetch(`${BASE_URL}/equipment/${createdEquipmentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.ok(data.id);
    assert.ok(data.title);
  });
});
