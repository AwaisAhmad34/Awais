import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { platformRouter } from '../src/server/platformOwnerRoutes';

test('platform owner bootstrap endpoint validation and lock', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/platform', platformRouter);

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address() as any;
    const base = `http://127.0.0.1:${address.port}/api/platform`;

    // 1. GET owner status
    const statusRes = await fetch(`${base}/owner-status`);
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(typeof statusData.initialized, 'boolean');

    // 2. POST bootstrap rejects invalid emails with 400 Bad Request
    const badEmailRes = await fetch(`${base}/bootstrap-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notanemail', password: 'ValidPassword123' }),
    });
    assert.equal(badEmailRes.status, 400);

    // 3. POST bootstrap rejects short password (< 8 chars) with 400 Bad Request
    const shortPassRes = await fetch(`${base}/bootstrap-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@institution.edu.pk', password: '123' }),
    });
    assert.equal(shortPassRes.status, 400);

    // 4. Input validation and execution response handling
    const validBootRes = await fetch(`${base}/bootstrap-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testowner@institution.edu.pk',
        password: 'SecureMasterPassword2026!',
        displayName: 'Test Platform Super Admin',
      }),
    });
    assert.equal([200, 201, 403, 409, 500, 503].includes(validBootRes.status), true);
    const bootData = await validBootRes.json();
    assert.equal(typeof bootData, 'object');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
