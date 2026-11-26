import React, { Suspense, lazy } from 'react';
import { useRoute } from './lib/router';
import { Landing } from './landing/Landing';

const WorkspaceRoot = lazy(() => import('./workspace'));

const Boot = () => (
  <div className="flex min-h-screen items-center justify-center bg-g-950">
    <p className="label-mono text-g-500">loading reading room…</p>
  </div>
);

const App: React.FC = () => {
  const { parts, query } = useRoute();
  if (parts[0] === 'app') {
    return (
      <Suspense fallback={<Boot />}>
        <WorkspaceRoot parts={parts} query={query} />
      </Suspense>
    );
  }
  return <Landing />;
};

export default App;
