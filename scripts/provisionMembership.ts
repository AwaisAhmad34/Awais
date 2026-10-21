import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, adminDatabase } from '../src/server/adminFirebase';
import { contextFromMembership } from '../src/server/authentication';

// Input contains membership metadata only; create the Auth account separately.
const path = process.argv[2];
if (!path) throw new Error('Usage: node --import tsx scripts/provisionMembership.ts /absolute/path/membership.json');
const input = JSON.parse(await readFile(path, 'utf8'));
const { uid, ...membership } = input;
if (typeof uid !== 'string' || !uid || uid.includes('/')) throw new Error('A valid Firebase Auth UID is required.');
if ('password' in membership) throw new Error('Do not include passwords in membership files.');
contextFromMembership(uid, membership);
const user = await getAuth(adminApp()).getUser(uid);
if (user.disabled) throw new Error('Firebase Authentication account is disabled.');
// create() deliberately refuses to overwrite an existing membership.
await adminDatabase().collection('memberships').doc(uid).create(membership);
console.log('Membership created for the existing Firebase Authentication account.');
