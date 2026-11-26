import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { DEMO_ACCOUNT, register, signIn } from '../lib/auth';
import { detectMode, type Mode } from '../services/api';
import { navigate } from '../lib/router';
import { brainMriSvg, chestXraySvg, svgToDataUrl } from '../lib/scanArt';

const FILMS = [
  { src: () => chestXraySvg(7, [[148, 318, 222, 384]]), box: [148, 318, 222, 384], tag: 'CR · CHEST PA', note: 'Opacity · right lower lobe · p 0.91' },
  { src: () => brainMriSvg(11, [[302, 196, 356, 248]]), box: [302, 196, 356, 248], tag: 'MR · AX T2 FLAIR', note: 'Glioma · left frontal lobe · p 0.88' },
];

export const Login: React.FC<{ next?: string | null }> = ({ next }) => {
  const [mode, setMode] = useState<'signin' | 'request'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('MD, Radiology');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [film, setFilm] = useState(0);
  const [mode_, setMode_] = useState<Mode | null>(null);

  useEffect(() => { detectMode().then(setMode_); }, []);

  const films = useMemo(() => FILMS.map(f => svgToDataUrl(f.src())), []);
  useEffect(() => {
    const t = setInterval(() => setFilm(f => (f + 1) % FILMS.length), 5200);
    return () => clearInterval(t);
  }, []);

  const go = () => navigate(next && next.startsWith('/app') ? next : '/app');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      if (mode === 'request') await register(email, password, name, role);
      else await signIn(email, password);
      go();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  const useDemo = () => {
    setMode('signin');
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
    setError(null);
  };

  const f = FILMS[film];

  return (
    <div className="grid min-h-screen bg-paper text-ink lg:grid-cols-[1.05fr_1fr]">
      {/* Film side */}
      <aside className="relative hidden overflow-hidden bg-ink text-paper lg:flex lg:flex-col">
        <div className="flex items-center justify-between px-10 pt-8">
          <a href="#/" className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
              <rect x="1" y="1" width="30" height="30" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="11" cy="12" r="3" fill="currentColor" /><circle cx="22" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="20" cy="22" r="3" fill="#e4572e" /><path d="M11 12L22 10M11 12L20 22M22 10L20 22" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="text-[15px] font-semibold tracking-tight">MedGraph</span>
          </a>
          <span className="label-mono text-g-500">reading room · RR-1</span>
        </div>

        <div className="flex flex-1 items-center justify-center px-10">
          <div className="relative aspect-square w-full max-w-[460px] overflow-hidden rounded-[2px] bg-black">
            {films.map((src, i) => (
              <img key={i} src={src} alt="" className="absolute inset-0 h-full w-full transition-opacity duration-1000" style={{ opacity: i === film ? 1 : 0 }} />
            ))}
            <div className="scanline pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-signal/15 to-transparent" />
            <svg key={film} viewBox="0 0 512 512" className="rise absolute inset-0 h-full w-full" style={{ animationDelay: '.6s' }}>
              {(() => {
                const [x1, y1, x2, y2] = f.box; const t = 9;
                return (
                  <g>
                    <path d={`M${x1},${y1 + t}V${y1}H${x1 + t} M${x2 - t},${y1}H${x2}V${y1 + t} M${x2},${y2 - t}V${y2}H${x2 - t} M${x1 + t},${y2}H${x1}V${y2 - t}`} stroke="#e4572e" strokeWidth="2" fill="none" />
                    <line x1={x2} y1={y1} x2={x2 + 40} y2={y1 - 40} stroke="#e4572e" />
                  </g>
                );
              })()}
            </svg>
            <div className="absolute left-10 right-3 top-2 flex justify-between font-mono text-[10.5px] text-g-300/80"><span>{f.tag}</span><span>{film + 1}/{FILMS.length}</span></div>
            <div className="absolute bottom-2 left-3 font-mono text-[10.5px] text-g-300/80">{f.note}</div>
          </div>
        </div>

        <div className="border-t border-g-700 px-10 py-8">
          <p className="max-w-md font-display text-[30px] leading-[1.1]">
            “A finding you can’t trace is a finding you can’t <em className="text-signal">sign</em>.”
          </p>
          <p className="label-mono mt-3 text-g-500">design principle 01</p>
        </div>
      </aside>

      {/* Form side */}
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <a href="#/" className="inline-flex items-center gap-2 text-[13px] text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to site</a>
          <span className="label-mono text-ink-3 lg:hidden">MedGraph</span>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <div className="flex items-center justify-between">
            <p className="label-mono text-ink-3"><span className="text-signal">§</span> {mode === 'signin' ? 'Sign in' : 'Request access'}</p>
            {mode_ && (
              <span className={`label-mono flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 ${mode_ === 'live' ? 'border-[#5a8a52]/40 text-[#3f6b38]' : 'border-rule text-ink-3'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${mode_ === 'live' ? 'bg-[#5a8a52]' : 'bg-[#c99a2e]'}`} />
                {mode_ === 'live' ? 'secure server' : 'demo mode'}
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-[52px] leading-[0.98] tracking-[-0.01em]">
            {mode === 'signin' ? <>Welcome back to the <em>reading room</em>.</> : <>Set up your <em>reader</em> profile.</>}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            {mode === 'signin' ? 'Your name is attached to every report you sign and every edit in the audit log.' : 'The name and credentials you enter here appear on report signatures.'}
          </p>

          <form onSubmit={submit} className="mt-9 space-y-5" noValidate>
            {mode === 'request' && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label-mono text-ink-3">Full name</span>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Dr. Jane Okafor" className="mt-2 h-11 w-full rounded-[3px] border border-rule bg-paper px-3 text-[14px] placeholder:text-ink-3/60 focus:border-ink focus:outline-none" />
                </label>
                <label className="block">
                  <span className="label-mono text-ink-3">Credentials</span>
                  <input value={role} onChange={e => setRole(e.target.value)} className="mt-2 h-11 w-full rounded-[3px] border border-rule bg-paper px-3 text-[14px] focus:border-ink focus:outline-none" />
                </label>
              </div>
            )}
            <label className="block">
              <span className="label-mono text-ink-3">Work email</span>
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@hospital.org" className="mt-2 h-11 w-full rounded-[3px] border border-rule bg-paper px-3 text-[14px] placeholder:text-ink-3/60 focus:border-ink focus:outline-none" />
            </label>
            <label className="block">
              <span className="label-mono flex justify-between text-ink-3"><span>Password</span><span className="normal-case tracking-normal text-ink-3">{mode === 'signin' ? 'min. 6 characters' : 'min. 8 characters'}</span></span>
              <div className="relative mt-2">
                <input type={show ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} className="h-11 w-full rounded-[3px] border border-rule bg-paper px-3 pr-11 text-[14px] focus:border-ink focus:outline-none" />
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center text-ink-3 hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {error && <p className="rounded-[3px] border border-signal/40 bg-signal/10 px-3 py-2 text-[13px] text-[#a83a1b]">{error}</p>}

            <button type="submit" disabled={busy} className="group flex h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-ink text-[14.5px] font-medium text-paper transition hover:bg-signal disabled:opacity-60">
              {busy ? 'Verifying…' : mode === 'signin' ? 'Sign in' : 'Create profile & enter'}
              {!busy && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
            </button>
          </form>

          <div className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-rule" /><span className="label-mono text-ink-3">or</span><span className="h-px flex-1 bg-rule" /></div>

          <button onClick={useDemo} className="flex w-full items-center justify-between rounded-[3px] border border-ink px-4 py-3 text-left transition hover:bg-ink hover:text-paper">
            <span>
              <span className="block text-[14px] font-medium">Use the demo reader account</span>
              <span className="mt-0.5 block font-mono text-[11.5px] opacity-70">{DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}</span>
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="mt-8 text-[13.5px] text-ink-2">
            {mode === 'signin' ? 'New to MedGraph? ' : 'Already have a profile? '}
            <button onClick={() => { setMode(m => (m === 'signin' ? 'request' : 'signin')); setError(null); }} className="font-medium text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-signal">
              {mode === 'signin' ? 'Request access' : 'Sign in instead'}
            </button>
          </p>
        </div>

        <p className="mx-auto max-w-[400px] text-center text-[11.5px] leading-relaxed text-ink-3">
          {mode_ === 'live'
            ? 'Connected to the MedGraph API: passwords are checked server-side against salted PBKDF2 hashes and sessions use signed, expiring tokens.'
            : 'Demo mode: no API is reachable, so profiles stay in this browser and nothing is sent to a server.'}{' '}
          Research prototype, not for diagnostic use.
        </p>
      </main>
    </div>
  );
};
