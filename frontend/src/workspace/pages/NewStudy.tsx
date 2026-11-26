import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload as UploadIcon, FileImage, X, Check, AlertCircle } from 'lucide-react';
import { apiService, PIPELINE_STAGES } from '../../services/api';
import { useWorkspace } from '../store';
import { navigate } from '../../lib/router';
import { scanDataUrl } from '../../lib/scanArt';
import { SectionTitle } from '../../components/ui';
import type { Modality } from '../../lib/engine';

const randomPid = () => `PT-${Math.floor(36000 + Math.random() * 6000)}`;

export const NewStudy: React.FC<{ sample?: string | null }> = ({ sample }) => {
  const { upsertCase, toast, mode } = useWorkspace();
  const [patientId, setPatientId] = useState(randomPid);
  const [override, setOverride] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const running = stage >= 0 && stage < PIPELINE_STAGES.length;
  const started = useRef(false);

  const thumbs = useMemo(() => ({
    chest_xray: scanDataUrl('chest_xray', 7, [[150, 320, 220, 380]]),
    brain_mri: scanDataUrl('brain_mri', 11, [[300, 200, 350, 246]]),
  }), []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File) => {
    setFile(f); setError(null);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  };

  const finish = (id: string) => {
    toast('Study analysed and added to worklist');
    setTimeout(() => navigate(`/app/case/${id}`), 450);
  };

  const run = async () => {
    if (!file) return setError('Choose a scan file first.');
    if (!patientId.trim()) return setError('Patient identifier is required.');
    setError(null); setStage(0);
    try {
      const c = await apiService.analyzeScan(file, patientId.trim(), override || undefined, setStage);
      upsertCase(c); finish(c.case_id);
    } catch (e: any) {
      setStage(-1);
      setError(e?.response?.data?.detail || e?.message || 'Pipeline failed.');
    }
  };

  const runSample = async (m: Modality) => {
    setError(null); setStage(0);
    const c = await apiService.runSample(m, patientId.trim() || randomPid(), setStage);
    upsertCase(c); finish(c.case_id);
  };

  useEffect(() => {
    if ((sample === 'chest_xray' || sample === 'brain_mri') && !started.current) {
      started.current = true;
      runSample(sample);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample]);

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8 md:px-10">
      <SectionTitle kicker="Ingest" title="New study" />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <section className="panel">
            <div className="panel-head"><p className="label-mono text-g-300">Upload</p><span className="font-mono text-[11px] text-g-500">{mode === 'live' ? '→ inference API' : '→ demo engine'}</span></div>
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label-mono text-g-400">Patient identifier</span>
                  <input value={patientId} onChange={e => setPatientId(e.target.value)} className="field mt-1.5 font-mono" />
                </label>
                <label className="block">
                  <span className="label-mono text-g-400">Modality</span>
                  <select value={override} onChange={e => setOverride(e.target.value)} className="field mt-1.5">
                    <option value="">Auto-detect</option>
                    <option value="chest_xray">Chest radiograph</option>
                    <option value="brain_mri">Brain MRI</option>
                  </select>
                </label>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) pick(e.dataTransfer.files[0]); }}
                onClick={() => !file && inputRef.current?.click()}
                className={`relative flex min-h-[220px] flex-col items-center justify-center rounded-[4px] border border-dashed transition ${drag ? 'border-signal bg-signal/5' : file ? 'border-g-600 bg-g-950' : 'cursor-pointer border-g-600 bg-g-950 hover:border-g-400'}`}
              >
                <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.dcm,.nii,.gz" className="hidden" onChange={e => e.target.files?.[0] && pick(e.target.files[0])} />
                {file ? (
                  <div className="flex w-full items-center gap-4 p-4">
                    {preview ? <img src={preview} alt="" className="h-28 w-28 rounded-[2px] bg-black object-contain" /> : <div className="flex h-28 w-28 items-center justify-center rounded-[2px] bg-g-800"><FileImage className="h-8 w-8 text-g-400" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] text-g-100">{file.name}</p>
                      <p className="mt-1 font-mono text-[11.5px] text-g-400">{(file.size / 1024).toFixed(0)} KB · {file.type || 'binary'}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); }} className="btn btn-ghost !px-2"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <UploadIcon className="h-6 w-6 text-g-400" strokeWidth={1.5} />
                    <p className="mt-3 text-[14px] text-g-100">Drop a scan, or click to browse</p>
                    <p className="mt-1 font-mono text-[11px] text-g-500">PNG · JPEG · DICOM · NIfTI</p>
                  </>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2.5 rounded-[4px] border border-sev-critical/30 bg-sev-critical/10 px-3 py-2.5 text-[13px] text-sev-critical">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <button onClick={run} disabled={!file || running} className="btn btn-primary h-10 w-full justify-center text-[13.5px]">
                {running ? 'Running pipeline…' : 'Analyse study'}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><p className="label-mono text-g-300">Or run a sample</p><span className="font-mono text-[11px] text-g-500">synthetic, no PHI</span></div>
            <div className="grid grid-cols-2 gap-px bg-g-700">
              {(['chest_xray', 'brain_mri'] as Modality[]).map(m => (
                <button key={m} disabled={running} onClick={() => runSample(m)} className="group flex items-center gap-4 bg-g-900 p-4 text-left transition hover:bg-g-850 disabled:opacity-50">
                  <img src={thumbs[m]} alt="" className="h-20 w-20 rounded-[2px] bg-black grayscale transition group-hover:grayscale-0" />
                  <div>
                    <p className="text-[14px] text-g-100">{m === 'chest_xray' ? 'Chest PA' : 'Brain axial T2'}</p>
                    <p className="mt-1 font-mono text-[11px] text-g-500">{m === 'chest_xray' ? 'CR · YOLOv11' : 'MR · U-Net + classifier'}</p>
                    <p className="mt-2 text-[12px] text-g-300 group-hover:text-signal">Run →</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Pipeline trace */}
        <section className="panel h-fit">
          <div className="panel-head">
            <p className="label-mono text-g-300">Pipeline</p>
            <span className="font-mono text-[11px] text-g-500">{stage < 0 ? 'idle' : stage >= PIPELINE_STAGES.length ? 'complete' : `stage ${stage + 1}/${PIPELINE_STAGES.length}`}</span>
          </div>
          <ol className="relative p-5">
            <span className="absolute bottom-9 left-[33px] top-9 w-px bg-g-700" />
            {PIPELINE_STAGES.map((s, i) => {
              const done = stage > i, cur = stage === i;
              return (
                <li key={s.key} className="relative flex gap-4 pb-5 last:pb-0">
                  <span className={`relative z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${done ? 'border-sev-minimal bg-sev-minimal text-g-950' : cur ? 'border-signal bg-g-900' : 'border-g-600 bg-g-900'}`}>
                    {done ? <Check className="h-3 w-3" strokeWidth={3} /> : cur ? <span className="h-1.5 w-1.5 rounded-full bg-signal blink" /> : null}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-[13.5px] ${done || cur ? 'text-g-100' : 'text-g-400'}`}>{s.label}</p>
                    <p className="font-mono text-[11px] text-g-500">{s.detail}</p>
                    {cur && <div className="mt-2 h-[2px] w-40 overflow-hidden bg-g-700"><div className="h-full w-1/3 bg-signal" style={{ animation: 'slide 0.9s ease-in-out infinite alternate' }} /></div>}
                  </div>
                </li>
              );
            })}
          </ol>
          <style>{`@keyframes slide { from { transform: translateX(0) } to { transform: translateX(200%) } }`}</style>
        </section>
      </div>
    </div>
  );
};
