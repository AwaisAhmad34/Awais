import { Router } from 'express';
import { adminDatabase, adminApp } from './adminFirebase';
import { getAuth } from 'firebase-admin/auth';

export const platformRouter = Router();

// Check if Platform Owner has already been initialized in trusted environment
platformRouter.get('/owner-status', async (_req, res) => {
  try {
    const db = adminDatabase();
    const docSnap = await db.collection('system_state').doc('platform_owner_registry').get();
    if (docSnap.exists && docSnap.data()?.isInitialized) {
      const data = docSnap.data();
      const rawEmail = String(data?.ownerEmail || '');
      const maskedEmail = rawEmail.includes('@')
        ? rawEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')
        : 'Registered Owner';

      return res.json({
        initialized: true,
        ownerEmailMasked: maskedEmail,
        initializedAt: data?.initializedAt || null,
      });
    }
    return res.json({ initialized: false });
  } catch (err: any) {
    // If Admin SDK runs in restricted sandbox without service account cert, handle gracefully
    return res.json({ initialized: false, mode: 'local_fallback' });
  }
});

// Transactional server-side bootstrap of the Level 1 Platform Super Admin
platformRouter.post('/bootstrap-owner', async (req, res) => {
  const { email, password, name, bootstrapSecret } = req.body || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'A valid email address is required.' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Master password must be at least 8 characters.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = adminDatabase();
  const auth = getAuth(adminApp());

  // Check optional server installation secret if configured in environment
  const expectedSecret = process.env.BOOTSTRAP_SECRET?.trim();
  if (expectedSecret && bootstrapSecret !== expectedSecret) {
    await db.collection('campus_login_activities').add({
      action: 'PLATFORM_OWNER_BOOTSTRAP_REJECTED',
      reason: 'INVALID_BOOTSTRAP_SECRET',
      userName: name || 'Anonymous Attempt',
      userEmail: cleanEmail,
      ipAddress: req.ip || '127.0.0.1',
      status: 'rejected',
      timestamp: new Date().toISOString(),
    }).catch(() => {});
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Valid installation bootstrap secret required.' });
  }

  try {
    const registryRef = db.collection('system_state').doc('platform_owner_registry');

    let ownerUid = '';
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(registryRef);
      if (snap.exists && snap.data()?.isInitialized) {
        throw new Error('ALREADY_INITIALIZED');
      }

      // Check if user exists in Firebase Auth or create new
      try {
        const existing = await auth.getUserByEmail(cleanEmail);
        ownerUid = existing.uid;
        await auth.updateUser(ownerUid, {
          password,
          displayName: name || 'Platform Super Admin (Site Owner)',
        });
      } catch (userErr: any) {
        if (userErr.code === 'auth/user-not-found') {
          const created = await auth.createUser({
            email: cleanEmail,
            password,
            displayName: name || 'Platform Super Admin (Site Owner)',
          });
          ownerUid = created.uid;
        } else {
          throw userErr;
        }
      }

      // Authoritative membership document
      const membershipRef = db.collection('memberships').doc(ownerUid);
      tx.set(
        membershipRef,
        {
          name: name || 'Platform Super Admin (Site Owner)',
          email: cleanEmail,
          permissionLevel: 'level_1_platform_super_admin',
          clientId: null,
          campusId: null,
          status: 'active',
          allowedModules: ['all'],
          delegatedCampusIds: ['all'],
          isPlatformAdmin: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Lock registry permanently so future unauthenticated calls are rejected
      tx.set(registryRef, {
        isInitialized: true,
        ownerUid,
        ownerEmail: cleanEmail,
        initializedAt: new Date().toISOString(),
      });
    });

    // Record audit event
    await db.collection('campus_login_activities').add({
      action: 'PLATFORM_OWNER_BOOTSTRAP_SUCCESS',
      userName: name || 'Platform Super Admin',
      userEmail: cleanEmail,
      userRole: 'level_1_platform_super_admin',
      ipAddress: req.ip || '127.0.0.1',
      status: 'success',
      timestamp: new Date().toISOString(),
      remarks: 'Platform owner account provisioned transactionally via server bootstrap.',
    }).catch(() => {});

    return res.status(201).json({
      status: 'success',
      message: 'Platform owner account initialized successfully in trusted server environment.',
      email: cleanEmail,
      uid: ownerUid,
    });
  } catch (err: any) {
    if (err.message === 'ALREADY_INITIALIZED') {
      await db.collection('campus_login_activities').add({
        action: 'PLATFORM_OWNER_BOOTSTRAP_REJECTED',
        reason: 'ALREADY_INITIALIZED',
        userEmail: cleanEmail,
        ipAddress: req.ip || '127.0.0.1',
        status: 'rejected',
        timestamp: new Date().toISOString(),
        remarks: 'Rejected duplicate platform owner initialization.',
      }).catch(() => {});

      return res.status(409).json({
        error: 'ALREADY_INITIALIZED',
        message: 'Platform owner account has already been established. Privilege updates require reauthentication.',
      });
    }

    console.error('Server platform owner bootstrap error:', err);
    return res.status(500).json({
      error: 'BOOTSTRAP_FAILED',
      message: 'Platform owner setup could not be completed on server.',
    });
  }
});
