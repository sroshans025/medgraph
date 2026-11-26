/**
 * Lightweight client-side session for the reading room.
 *
 * The hosted preview has no identity provider, so sessions live in
 * localStorage and only gate the UI. The signed-in reviewer's name is what
 * appears on report signatures and in the audit trail.
 */
import { getSettings, saveSettings } from '../services/api';

export interface Session { name: string; email: string; role: string; at: string }

const KEY = 'mg.session.v1';

export const DEMO_ACCOUNT = { email: 'reader@medgraph.dev', password: 'radiology', name: 'Dr. A. Raman', role: 'MD, Radiology' };

export function getSession(): Session | null {
  try { const v = localStorage.getItem(KEY); return v ? (JSON.parse(v) as Session) : null; } catch { return null; }
}

export function signIn(email: string, password: string, name?: string, role?: string): Session {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('Enter a valid email address.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  const isDemo = e === DEMO_ACCOUNT.email;
  if (isDemo && password !== DEMO_ACCOUNT.password) throw new Error('Incorrect password for the demo account.');
  const session: Session = {
    email: e,
    name: (isDemo ? DEMO_ACCOUNT.name : name?.trim()) || `Dr. ${e.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
    role: (isDemo ? DEMO_ACCOUNT.role : role?.trim()) || 'MD, Radiology',
    at: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(session));
  saveSettings({ ...getSettings(), reviewer: session.name, credentials: session.role });
  return session;
}

export function signOut() { localStorage.removeItem(KEY); }
