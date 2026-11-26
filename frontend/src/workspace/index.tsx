import React from 'react';
import { WorkspaceProvider, useWorkspace } from './store';
import { Shell } from './Shell';
import { Overview } from './pages/Overview';
import { Worklist } from './pages/Worklist';
import { NewStudy } from './pages/NewStudy';
import { Study } from './pages/Study';
import { GraphView } from './pages/GraphView';
import { ArchivePage } from './pages/Archive';
import { SettingsPage } from './pages/SettingsPage';

const Workspace: React.FC<{ parts: string[]; query: URLSearchParams }> = ({ parts, query }) => {
  const { ready } = useWorkspace();
  const [, section = 'overview', id, sub] = parts;

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-g-950">
        <div className="text-center">
          <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-[3px] border border-g-600">
            <div className="scanline absolute inset-x-0 h-4 bg-gradient-to-b from-transparent via-signal/60 to-transparent" />
          </div>
          <p className="label-mono mt-4 text-g-400">connecting to inference service</p>
        </div>
      </div>
    );
  }

  let page: React.ReactNode;
  let nav = section;
  switch (section) {
    case 'worklist': page = <Worklist />; break;
    case 'new': page = <NewStudy key={query.get('sample') ?? 'upload'} sample={query.get('sample')} />; break;
    case 'case':
      nav = 'worklist';
      page = sub === 'graph' ? <GraphView key={id} id={id} /> : <Study key={id} id={id} />;
      break;
    case 'archive': page = <ArchivePage />; break;
    case 'settings': page = <SettingsPage />; break;
    default: nav = 'overview'; page = <Overview />;
  }
  return <Shell section={nav}>{page}</Shell>;
};

export default function WorkspaceRoot({ parts, query }: { parts: string[]; query: URLSearchParams }) {
  return (
    <WorkspaceProvider>
      <Workspace parts={parts} query={query} />
    </WorkspaceProvider>
  );
}
