import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { HeroLoupe } from './HeroLoupe';
import { CalibrationPlayground, GraphTrace, PipelineSection } from './Sections';
import { navigate } from '../lib/router';

const Mark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <rect x="1" y="1" width="30" height="30" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="11" cy="12" r="3" fill="currentColor" />
    <circle cx="22" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="20" cy="22" r="3" fill="#e4572e" />
    <path d="M11 12L22 10M11 12L20 22M22 10L20 22" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const Section: React.FC<{ id?: string; n: string; kicker: string; title: React.ReactNode; lede?: string; children: React.ReactNode; tone?: 'paper' | 'paper2' }> = ({ id, n, kicker, title, lede, children, tone = 'paper' }) => (
  <section id={id} className={`${tone === 'paper2' ? 'bg-paper-2' : 'bg-paper'} border-t border-rule`}>
    <div className="mx-auto max-w-[1240px] px-6 py-24 md:px-10">
      <div className="mb-14 grid grid-cols-1 gap-6 md:grid-cols-[180px_1fr]">
        <div className="label-mono pt-2 text-ink-3">
          <span className="text-signal">§{n}</span> {kicker}
        </div>
        <div>
          <h2 className="max-w-3xl font-display text-[44px] leading-[1.02] tracking-[-0.01em] text-ink md:text-[60px]">{title}</h2>
          {lede && <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-2">{lede}</p>}
        </div>
      </div>
      {children}
    </div>
  </section>
);

const FEATURES = [
  ['Triage worklist', 'Studies are ordered by a priority score combining severity, calibrated confidence and time waiting, so critical films rise without anyone sorting.'],
  ['Reading-room viewer', 'Zoom, pan, window/level and invert, with detection boxes linked both ways to the findings table. Hover a row, the region lights up.'],
  ['Reasoning graph', 'Every recommendation can be followed back to the pixels that produced it. Click a node to see the rule and the evidence behind it.'],
  ['Versioned reports', 'Edits create a new version with a revision note. Signing locks the draft; editing after sign-off reopens it and is logged.'],
  ['Audit trail', 'Ingestion, revisions, sign-off and exports are recorded per study with actor and timestamp, ready for QA review.'],
  ['Side-by-side compare', 'Put two studies next to each other with their findings and calibration to check progression or a second opinion.'],
];

export const Landing: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on);
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Nav */}
      <header className={`sticky top-0 z-40 transition ${scrolled ? 'border-b border-rule bg-paper/95 backdrop-blur' : 'bg-transparent'}`}>
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6 md:px-10">
          <a href="#/" className="flex items-center gap-2.5">
            <Mark className="h-7 w-7 text-ink" />
            <span className="text-[15px] font-semibold tracking-tight">MedGraph</span>
            <span className="label-mono hidden rounded-[2px] md:inline border border-ink/30 px-1.5 py-[1px] text-ink-3 sm:inline">v2 · research</span>
          </a>
          <nav className="hidden items-center gap-8 text-[13.5px] text-ink-2 md:flex">
            <a href="#pipeline" onClick={e => { e.preventDefault(); document.getElementById('pipeline')?.scrollIntoView(); }} className="hover:text-ink">Pipeline</a>
            <a href="#calibration" onClick={e => { e.preventDefault(); document.getElementById('calibration')?.scrollIntoView(); }} className="hover:text-ink">Calibration</a>
            <a href="#graph" onClick={e => { e.preventDefault(); document.getElementById('graph')?.scrollIntoView(); }} className="hover:text-ink">Reasoning</a>
            <a href="https://github.com/sroshans025/medgraph" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink">Source <ArrowUpRight className="h-3.5 w-3.5" /></a>
          </nav>
          <div className="flex items-center gap-4">
          <a href="#/login" className="hidden text-[13.5px] text-ink-2 hover:text-ink sm:inline">Sign in</a>
          <button onClick={() => navigate('/app')} className="inline-flex h-9 items-center gap-2 rounded-[3px] bg-ink px-4 text-[13px] font-medium text-paper transition hover:bg-signal">
            Reading room <ArrowRight className="h-3.5 w-3.5" />
          </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-14 px-6 pb-24 pt-10 md:px-10 lg:grid-cols-[1fr_minmax(0,560px)] lg:pt-16">
          <div className="rise">
            <p className="label-mono flex items-center gap-2 text-ink-3">
              <span className="inline-block h-[1px] w-8 bg-ink" /> Clinical decision support · chest CR & brain MR
            </p>
            <h1 className="mt-6 font-display text-[56px] leading-[0.95] tracking-[-0.02em] sm:text-[84px] xl:text-[104px]">
              Every finding,<br />
              <em className="text-signal">traced</em> back to<br />
              the pixel.
            </h1>
            <p className="mt-8 max-w-[34rem] text-[18px] leading-relaxed text-ink-2">
              MedGraph reads chest radiographs and brain MRIs, calibrates what the models think they see, and links each
              finding through a clinical graph to a draft report a radiologist can check line by line.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button onClick={() => navigate('/app')} className="group inline-flex h-12 items-center gap-3 rounded-[3px] bg-signal px-6 text-[14.5px] font-medium text-white transition hover:bg-ink">
                Open the reading room <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
              <button onClick={() => navigate('/app/new')} className="inline-flex h-12 items-center gap-2 rounded-[3px] border border-ink px-6 text-[14.5px] font-medium transition hover:bg-ink hover:text-paper">
                Run a sample study
              </button>
            </div>
            <dl className="mt-14 grid max-w-lg grid-cols-3 border-t border-ink pt-5">
              {[['6', 'pipeline stages'], ['0', 'free-text generation'], ['100%', 'findings with a box']].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-[40px] leading-none">{v}</dt>
                  <dd className="label-mono mt-2 text-ink-3">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rise" style={{ animationDelay: '.12s' }}>
            <HeroLoupe />
          </div>
        </div>

        {/* Ticker */}
        <div className="overflow-hidden border-y border-ink bg-ink py-3 text-paper">
          <div className="marquee flex w-max gap-10 whitespace-nowrap font-mono text-[12px] uppercase tracking-[0.12em]">
            {Array.from({ length: 2 }).flatMap((_, k) =>
              ['YOLOv11 chest detector', 'MONAI U-Net segmentation', 'Platt scaling k=8', 'NetworkX clinical graph', 'Grounded report templates', 'Versioned physician edits', 'Per-study audit log', 'DICOM · NIfTI · PNG'].map((t, i) => (
                <span key={`${k}-${i}`} className="flex items-center gap-10">{t}<span className="text-signal">✕</span></span>
              )))}
          </div>
        </div>
      </section>

      <Section id="pipeline" n="1" kicker="Pipeline" title={<>Six stages, each one <em>inspectable</em>.</>} lede="Nothing is a black box end to end. Every stage writes a structured output that the next stage consumes and that you can open in the viewer.">
        <PipelineSection />
      </Section>

      <Section id="calibration" n="2" kicker="Calibration" tone="paper2" title={<>A 0.72 from a network is not a 72% chance.</>} lede="Detector scores are overconfident in the middle of the range. MedGraph maps them through a Platt curve before anyone sees a number, and reports which band the result lands in.">
        <CalibrationPlayground />
      </Section>

      <Section id="graph" n="3" kicker="Reasoning" title={<>Hover any node to follow the <em>chain</em>.</>} lede="The knowledge graph is the explanation. Two findings from one MRI fan out into differentials, severity and next steps. Every edge is a rule in the builder, not an inference.">
        <div className="rounded-[3px] border border-ink bg-paper p-3 sm:p-6">
          <GraphTrace />
        </div>
      </Section>

      <Section n="4" kicker="Workspace" tone="paper2" title={<>Built for the reading room, not the demo reel.</>}>
        <div className="grid grid-cols-1 border-t border-ink md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, d], i) => (
            <div key={t} className={`border-b border-rule py-8 pr-8 ${i % 3 !== 2 ? 'lg:border-r' : ''} ${i % 3 !== 0 ? 'lg:pl-8' : ''}`}>
              <p className="font-mono text-[11px] text-signal">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-3 font-display text-[28px] leading-tight">{t}</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="5" kicker="Limits" title={<>What it will not do.</>}>
        <div className="grid gap-px overflow-hidden rounded-[3px] border border-ink bg-ink grid-cols-1 md:grid-cols-3">
          {[
            ['Sign for you', 'Every draft is marked physician review required. A study only reaches Signed when a named reviewer signs it.'],
            ['Invent findings', 'Report text is filled from model outputs only. If a region was not detected, the report does not mention it.'],
            ['Replace history', 'It does not see labs, priors or the clinical question. The limitations section says so on every report.'],
          ].map(([t, d]) => (
            <div key={t} className="bg-paper p-8">
              <p className="font-display text-[30px] leading-none"><span className="text-signal">✕</span> {t}</p>
              <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-10 px-6 py-24 md:flex-row md:items-end md:px-10">
          <h2 className="max-w-3xl font-display text-[52px] leading-[0.98] md:text-[76px]">
            Twelve studies are waiting<br />in the <em className="text-signal">worklist</em>.
          </h2>
          <button onClick={() => navigate('/app/worklist')} className="group inline-flex h-14 shrink-0 items-center gap-3 rounded-[3px] bg-paper px-7 text-[15px] font-medium text-ink transition hover:bg-signal hover:text-white">
            Start reading <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      <footer className="border-t border-g-700 bg-ink text-g-400">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-6 py-8 text-[12.5px] md:flex-row md:items-center md:justify-between md:px-10">
          <div className="flex items-center gap-2.5 text-g-200"><Mark className="h-5 w-5" /> MedGraph AI</div>
          <p className="max-w-xl">Research prototype. Not a medical device and not for diagnostic use. Sample studies are synthetic renderings, not patient data.</p>
          <p className="font-mono text-[11px]">FastAPI · PyTorch · React</p>
        </div>
      </footer>
    </div>
  );
};
