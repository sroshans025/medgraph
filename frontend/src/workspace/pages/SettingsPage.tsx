import React, { useState } from 'react';
import { useWorkspace } from '../store';
import { getSettings, resetDemo, saveSettings, type Settings } from '../../services/api';
import { Kbd, SectionTitle } from '../../components/ui';

export const SettingsPage: React.FC = () => {
  const { mode, recheckMode, toast } = useWorkspace();
  const [s, setS] = useState<Settings>(getSettings());
  const [checking, setChecking] = useState(false);

  const save = async () => {
    saveSettings(s);
    setChecking(true);
    await recheckMode();
    setChecking(false);
    toast('Settings saved');
  };

  return (
    <div className="mx-auto max-w-[860px] px-6 py-8 md:px-10">
      <SectionTitle kicker="Workspace" title="Settings" />

      <section className="panel mb-6">
        <div className="panel-head"><p className="label-mono text-g-300">Reviewer</p></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label><span className="label-mono text-g-400">Name on signatures</span><input className="field mt-1.5" value={s.reviewer} onChange={e => setS({ ...s, reviewer: e.target.value })} /></label>
          <label><span className="label-mono text-g-400">Credentials</span><input className="field mt-1.5" value={s.credentials} onChange={e => setS({ ...s, credentials: e.target.value })} /></label>
        </div>
      </section>

      <section className="panel mb-6">
        <div className="panel-head">
          <p className="label-mono text-g-300">Inference API</p>
          <span className={`flex items-center gap-1.5 font-mono text-[11px] ${mode === 'live' ? 'text-sev-minimal' : 'text-sev-moderate'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${mode === 'live' ? 'bg-sev-minimal' : 'bg-sev-moderate'}`} />{mode === 'live' ? 'connected' : 'using demo engine'}
          </span>
        </div>
        <div className="space-y-4 p-5">
          <label className="block"><span className="label-mono text-g-400">Base URL</span><input className="field mt-1.5 font-mono" value={s.apiUrl} onChange={e => setS({ ...s, apiUrl: e.target.value })} /></label>
          <label className="flex items-center gap-3 text-[13px] text-g-200">
            <input type="checkbox" checked={s.forceDemo} onChange={e => setS({ ...s, forceDemo: e.target.checked })} className="accent-[#e4572e]" />
            Always use the in-browser demo engine
          </label>
          <p className="text-[12.5px] leading-relaxed text-g-500">
            Start the backend with <code className="rounded-[3px] bg-g-800 px-1.5 py-0.5 font-mono text-g-200">uvicorn backend.main:app --port 8000</code>. Browsers block plain-http APIs from an https page, so on the hosted preview the demo engine is used unless the API is served over https.
          </p>
        </div>
      </section>

      <div className="mb-10 flex gap-2">
        <button className="btn btn-primary" onClick={save} disabled={checking}>{checking ? 'Checking connection…' : 'Save & reconnect'}</button>
        <button className="btn" onClick={() => { if (confirm('Reset demo studies and review history on this device?')) { resetDemo(); location.reload(); } }}>Reset demo data</button>
      </div>

      <section className="panel">
        <div className="panel-head"><p className="label-mono text-g-300">Keyboard</p></div>
        <div className="grid gap-x-10 gap-y-2.5 p-5 text-[13px] text-g-300 sm:grid-cols-2">
          {[
            [['⌘', 'K'], 'Command palette'], [['/'], 'Search'], [['G', 'W'], 'Worklist'], [['G', 'O'], 'Overview'],
            [['G', 'A'], 'Archive'], [['N'], 'New study'], [['J', 'K'], 'Move in worklist'], [['[', ']'], 'Previous / next study'],
            [['1', '2', '3'], 'Study tabs'], [['O'], 'Toggle detections'], [['I'], 'Invert'], [['M'], 'Measure'], [['R'], 'Reset viewer'], [['Esc'], 'Back to worklist'],
          ].map(([keys, label]) => (
            <div key={label as string} className="flex items-center justify-between border-b border-g-800 pb-2">
              <span>{label as string}</span>
              <span className="flex gap-1">{(keys as string[]).map(k => <Kbd key={k}>{k}</Kbd>)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
