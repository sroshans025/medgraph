import React, { Suspense, lazy, useEffect } from 'react';
import { navigate, useRoute } from './lib/router';
import { Landing } from './landing/Landing';
import { Login } from './landing/Login';
import { getSession } from './lib/auth';

const WorkspaceRoot = lazy(() => import('./workspace'));

const Boot = () => (
  <div className="flex min-h-screen items-center justify-center bg-g-950">
    <p className="label-mono text-g-500">loading reading room…</p>
  </div>
);

const Redirect: React.FC<{ to: string }> = ({ to }) => {
  useEffect(() => navigate(to), [to]);
  return null;
};

const App: React.FC = () => {
  const { parts, query } = useRoute();
  if (parts[0] === 'login') {
    if (getSession()) return <Redirect to={query.get('next') || '/app'} />;
    return <Login next={query.get('next')} />;
  }
  if (parts[0] === 'app') {
    if (!getSession()) {
      const here = window.location.hash.replace(/^#/, '');
      return <Redirect to={`/login?next=${encodeURIComponent(here)}`} />;
    }
    return (
      <Suspense fallback={<Boot />}>
        <WorkspaceRoot parts={parts} query={query} />
      </Suspense>
    );
  }
  return <Landing />;
};

export default App;
