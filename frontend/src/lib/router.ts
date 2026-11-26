import { useEffect, useState } from 'react';

export interface Route { parts: string[]; query: URLSearchParams }

function parse(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}

/** Hash routing keeps deep links working on static hosting without rewrite rules. */
export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    on(); // catch a hash change that happened before this listener attached
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(path: string) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash !== target) {
    window.location.hash = target;
    window.scrollTo({ top: 0 });
  }
}
