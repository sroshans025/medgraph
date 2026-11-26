/**
 * Reader sessions.
 *
 * When the inference API is reachable, sign-in and registration go to the
 * backend (`/auth/login`, `/auth/register`), which checks PBKDF2-hashed
 * passwords and issues a signed bearer token. Every API call then carries
 * that token. When no API is reachable (the hosted demo), a browser-only
 * profile is created instead so the demo stays usable.
 */
import axios from 'axios';
import { detectMode, getSettings, saveSettings } from '../services/api';

export interface Session {
  name: string;
  email: string;
  role: string;
  at: string;
  source: 'server' | 'local';
  token?: string;
  expiresAt?: string;
}

const KEY = 'mg.session.v1';
export const TOKEN_KEY = KEY;

export const DEMO_ACCOUNT = { email: 'reader@medgraph.dev', password: 'radiology', name: 'Dr. A. Raman', role: 'MD, Radiology' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (s.expiresAt && new Date(s.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch { return null; }
}

function store(s: Session): Session {
  localStorage.setItem(KEY, JSON.stringify(s));
  saveSettings({ ...getSettings(), reviewer: s.name, credentials: s.role });
  return s;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  user: { email: string; name: string; credentials: string };
}

function fromToken(r: TokenResponse): Session {
  return store({
    name: r.user.name, email: r.user.email, role: r.user.credentials, source: 'server',
    token: r.access_token, at: new Date().toISOString(),
    expiresAt: new Date(Date.now() + r.expires_in * 1000).toISOString(),
  });
}

function apiError(e: any, fallback: string): Error {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return new Error(d);
  if (Array.isArray(d) && d[0]?.msg) return new Error(String(d[0].msg).replace(/^Value error, /, ''));
  return new Error(fallback);
}

function validate(email: string, password: string, minLen: number) {
  if (!EMAIL_RE.test(email)) throw new Error('Enter a valid email address.');
  if (password.length < minLen) throw new Error(`Password must be at least ${minLen} characters.`);
}

export async function signIn(emailRaw: string, password: string): Promise<Session> {
  const email = emailRaw.trim().toLowerCase();
  validate(email, password, 6);
  if ((await detectMode()) === 'live') {
    try {
      const r = await axios.post<TokenResponse>(`${getSettings().apiUrl}/auth/login`, { email, password }, { timeout: 10000 });
      return fromToken(r.data);
    } catch (e) { throw apiError(e, 'Sign-in failed. Check the API connection.'); }
  }
  const isDemo = email === DEMO_ACCOUNT.email;
  if (isDemo && password !== DEMO_ACCOUNT.password) throw new Error('Incorrect email or password.');
  return store({
    email, source: 'local', at: new Date().toISOString(),
    name: isDemo ? DEMO_ACCOUNT.name : `Dr. ${email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
    role: DEMO_ACCOUNT.role,
  });
}

export async function register(emailRaw: string, password: string, name: string, role: string): Promise<Session> {
  const email = emailRaw.trim().toLowerCase();
  validate(email, password, 8);
  if (name.trim().length < 2) throw new Error('Enter your full name.');
  if ((await detectMode()) === 'live') {
    try {
      const r = await axios.post<TokenResponse>(`${getSettings().apiUrl}/auth/register`, { email, password, name: name.trim(), credentials: role.trim() || 'MD, Radiology' }, { timeout: 10000 });
      return fromToken(r.data);
    } catch (e) { throw apiError(e, 'Registration failed. Check the API connection.'); }
  }
  return store({ email, name: name.trim(), role: role.trim() || 'MD, Radiology', source: 'local', at: new Date().toISOString() });
}

export function signOut() { localStorage.removeItem(KEY); }
