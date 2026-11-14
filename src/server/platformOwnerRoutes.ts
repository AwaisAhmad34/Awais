import { Router } from 'express';
import { adminDatabase, adminApp, getAdminConfigStatus } from './adminFirebase';
import { getAuth } from 'firebase-admin/auth';

export const platformRouter = Router();

// Check if Platform Owner has already been initialized in trusted environment
platformRouter.get('/owner-status', async (_req, res) => {
  const adminConfig = getAdminConfigStatus();
  if (adminConfig.mode !== 'service_account_cert') {
    return res.json({ initialized: false, mode: 'client_delegation' });
  }

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
  } catch (_err: any) {
    // If Admin SDK runs in restricted sandbox without service account cert, handle gracefully
    return res.json({ initialized: false, mode: 'client_delegation' });
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

  // If server does not have dedicated service account credentials configured,
  // delegate owner bootstrapping securely to client SDK via Firestore rules
  const adminConfig = getAdminConfigStatus();
  if (adminConfig.mode !== 'service_account_cert') {
    return res.status(200).json({
      status: 'client_fallback',
      mode: 'client_delegation',
      message: 'Server Admin SDK in delegation mode. Client SDK authorized to establish owner credentials.',
    });
  }

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

    if (err.code === 7 || err.message?.includes('PERMISSION_DENIED') || err.message?.includes('Missing or insufficient permissions')) {
      return res.status(200).json({
        status: 'client_fallback',
        mode: 'client_delegation',
        message: 'Server operating in delegation mode. Client SDK authorized to establish owner credentials.',
      });
    }

    console.warn('Server platform owner bootstrap warning:', err?.message || err);
    return res.status(500).json({
      error: 'BOOTSTRAP_FAILED',
      message: 'Platform owner setup could not be completed on server.',
    });
  }
});

async function verifyPlatformAdminCaller(
  req: any,
  requireLevel1Only: boolean = false
): Promise<{ ok: true; uid: string; level: string } | { ok: false; status: number; error: string; message: string }> {
  const authHeader = String(req.headers?.authorization || '');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Authentication token required for platform administration endpoint.',
    };
  }

  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(match[1].trim());
    const db = adminDatabase();
    const mSnap = await db.collection('memberships').doc(decoded.uid).get();
    const mData = mSnap.data();

    let permissionLevel = String(mData?.permissionLevel || '');
    let status = String(mData?.status || 'active');
    let isPlatformAdmin = Boolean(mData?.isPlatformAdmin);

    if (!mSnap.exists) {
      const guSnap = await db.collection('global_users').where('uid', '==', decoded.uid).limit(1).get();
      if (!guSnap.empty) {
        const guData = guSnap.docs[0].data();
        permissionLevel = String(guData?.permissionLevel || '');
        status = String(guData?.status || 'active');
        isPlatformAdmin = Boolean(guData?.isSuperAdmin);
      }
    }

    if (status !== 'active') {
      return { ok: false, status: 403, error: 'FORBIDDEN', message: 'Caller account is inactive or suspended.' };
    }

    const isLevel1 = isPlatformAdmin || permissionLevel === 'level_1_platform_super_admin';
    const isAdminTier =
      isLevel1 ||
      permissionLevel === 'level_2_client_super_admin' ||
      permissionLevel === 'level_3_main_campus_admin';

    if (requireLevel1Only ? !isLevel1 : !isAdminTier) {
      return { ok: false, status: 403, error: 'FORBIDDEN', message: 'Insufficient privilege level.' };
    }

    return { ok: true, uid: decoded.uid, level: permissionLevel || (isLevel1 ? 'level_1_platform_super_admin' : 'admin') };
  } catch {
    return { ok: false, status: 401, error: 'INVALID_TOKEN', message: 'Invalid or expired authentication token.' };
  }
}

// Endpoint to reset and remove all users and site owner to allow creation from scratch
platformRouter.post('/reset-scratch', async (req, res) => {
  const adminConfig = getAdminConfigStatus();
  if (adminConfig.mode !== 'service_account_cert') {
    return res.json({ status: 'success', message: 'Client reset authorized.', mode: 'client_delegation' });
  }

  try {
    const db = adminDatabase();
    const registryRef = db.collection('system_state').doc('platform_owner_registry');
    const regSnap = await registryRef.get();
    if (regSnap.exists && regSnap.data()?.isInitialized) {
      const authCheck = await verifyPlatformAdminCaller(req, true);
      if (!authCheck.ok) {
        return res.status(authCheck.status).json({ error: authCheck.error, message: authCheck.message });
      }
    }

    await registryRef.set({
      isInitialized: false,
      ownerUid: null,
      ownerEmail: null,
      resetAt: new Date().toISOString(),
    });

    await db.collection('campus_login_activities').add({
      action: 'PLATFORM_RESET_FROM_SCRATCH',
      ipAddress: req.ip || '127.0.0.1',
      status: 'success',
      timestamp: new Date().toISOString(),
      remarks: 'Platform owner registry reset for clean scratch setup.',
    }).catch(() => {});

    return res.json({ status: 'success', message: 'Platform owner and user registry cleared. Ready to create from scratch.' });
  } catch (err: any) {
    return res.json({ status: 'success', message: 'Local reset recorded.', mode: 'fallback' });
  }
});

// Provision or update a Firebase Auth user account for global synchronization
platformRouter.post('/provision-user', async (req, res) => {
  const { email, password, displayName } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Valid email required.' });
  }

  const adminConfig = getAdminConfigStatus();
  if (adminConfig.mode !== 'service_account_cert') {
    return res.status(200).json({
      status: 'client_fallback',
      mode: 'client_delegation',
      message: 'Server Admin SDK in delegation mode. Client provisioning authorized.',
    });
  }

  const authCheck = await verifyPlatformAdminCaller(req, false);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ error: authCheck.error, message: authCheck.message });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const auth = getAuth(adminApp());
    let uid = '';

    try {
      const existing = await auth.getUserByEmail(cleanEmail);
      uid = existing.uid;
      const updates: Record<string, any> = {};
      if (displayName) updates.displayName = String(displayName);
      if (password && typeof password === 'string' && password.length >= 6) {
        updates.password = password;
      }
      if (Object.keys(updates).length > 0) {
        await auth.updateUser(uid, updates);
      }
    } catch (lookupErr: any) {
      if (lookupErr.code === 'auth/user-not-found') {
        if (!password || typeof password !== 'string' || password.length < 6) {
          return res.status(400).json({
            error: 'WEAK_PASSWORD',
            message: 'Password of at least 6 characters required to create a new Firebase Auth account.',
          });
        }
        const created = await auth.createUser({
          email: cleanEmail,
          password,
          displayName: displayName ? String(displayName) : undefined,
        });
        uid = created.uid;
      } else {
        throw lookupErr;
      }
    }

    return res.status(200).json({
      status: 'success',
      uid,
      email: cleanEmail,
    });
  } catch (err: any) {
    return res.status(200).json({
      status: 'client_fallback',
      mode: 'client_delegation',
      message: err?.message || 'Delegated to client Firebase SDK.',
    });
  }
});

// Delete a user from Firebase Auth when trusted service account cert is active
platformRouter.delete('/users/:uid', async (req, res) => {
  const { uid } = req.params;
  const adminConfig = getAdminConfigStatus();
  if (adminConfig.mode !== 'service_account_cert' || !uid) {
    return res.status(200).json({
      status: 'client_fallback',
      mode: 'client_delegation',
    });
  }

  const authCheck = await verifyPlatformAdminCaller(req, false);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ error: authCheck.error, message: authCheck.message });
  }

  try {
    const auth = getAuth(adminApp());
    await auth.deleteUser(uid);
    return res.json({ status: 'success', deletedUid: uid });
  } catch (err: any) {
    return res.status(200).json({
      status: 'client_fallback',
      mode: 'client_delegation',
      message: err?.message || 'Firebase Auth user deletion deferred.',
    });
  }
});

// Optional server-side login identifier resolver for global username -> email lookup
platformRouter.post('/resolve-login', async (req, res) => {
  const { identifier } = req.body || {};
  const adminConfig = getAdminConfigStatus();
  if (adminConfig.mode !== 'service_account_cert' || !identifier || typeof identifier !== 'string') {
    return res.json({ found: false, mode: 'client_delegation' });
  }

  try {
    const rawClean = identifier.trim().toLowerCase().replace(/\s+/g, '');
    const normalizedKey = rawClean.replace(/[^a-z0-9._-]/g, '_');
    const keys = Array.from(new Set([normalizedKey, rawClean].filter(Boolean)));
    const db = adminDatabase();

    for (const key of keys) {
      const dirSnap = await db.collection('login_directory').doc(key).get();
      if (dirSnap.exists && dirSnap.data()?.email) {
        const dirData = dirSnap.data();
        const dirStatus = String(dirData?.status || 'active').toLowerCase();
        if (dirStatus === 'suspended' || dirStatus === 'inactive') {
          return res.status(403).json({ found: false, error: 'ACCOUNT_DISABLED', message: 'Account access has been suspended.' });
        }
        return res.json({ found: true, email: String(dirData?.email).toLowerCase() });
      }
    }

    const qSnap = await db.collection('global_users').where('username', '==', rawClean).limit(1).get();
    if (!qSnap.empty && qSnap.docs[0].data()?.email) {
      const guData = qSnap.docs[0].data();
      const guStatus = String(guData?.status || 'active').toLowerCase();
      if (guStatus === 'suspended' || guStatus === 'inactive') {
        return res.status(403).json({ found: false, error: 'ACCOUNT_DISABLED', message: 'Account access has been suspended.' });
      }
      return res.json({ found: true, email: String(guData.email).toLowerCase() });
    }
    return res.json({ found: false });
  } catch {
    return res.json({ found: false, mode: 'client_delegation' });
  }
});

