import { test, describe } from 'node:test';
import assert from 'node:assert';
import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_API_BASE || 'http://localhost:5173/api';

describe('Authentication API Tests', { concurrency: false }, () => {
  test('POST /api/auth/register - should register new user', async () => {
    const userData = {
      name: 'Test User',
      email: `test_${Date.now()}@example.com`,
      password: 'password123',
      role: 'user',
    };

    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    assert.strictEqual(response.status, 201);
    const data = await response.json();
    assert.ok(data.token);
    assert.strictEqual(data.user.email, userData.email);
  });

  test('POST /api/auth/login - should authenticate user', async () => {
    const reg = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Login Test',
        email: `login_${Date.now()}@example.com`,
        password: 'password123',
        role: 'user',
      }),
    });
    assert.strictEqual(reg.status, 201);
    const created = await reg.json();
    const loginData = {
      email: created.user.email,
      password: 'password123',
    };

    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.ok(data.token);
    assert.ok(data.user);
  });

  test('POST /api/auth/login - should reject invalid credentials', async () => {
    const loginData = {
      email: `nouser_${Date.now()}@example.com`,
      password: 'wrongpassword',
    };

    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    assert.strictEqual(response.status, 401);
    const data = await response.json();
    assert.strictEqual(data.error, 'Invalid credentials');
  });
});
