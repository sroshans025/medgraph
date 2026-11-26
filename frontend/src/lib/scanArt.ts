/**
 * Procedural radiograph renderer.
 * Produces 512×512 SVG documents that read as a chest PA film or an axial
 * T2 brain slice. Lesions are rendered into the image at the given boxes so
 * detections drawn on top line up with something visible underneath.
 */

export type Box = [number, number, number, number];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function ribs(side: 1 | -1, r: () => number): string {
  const out: string[] = [];
  const cx = 256;
  for (let i = 0; i < 9; i++) {
    const y = 128 + i * 32 + r() * 7;
    const spread = 70 + i * 9;
    const x0 = cx + side * 18;
    const x1 = cx + side * (spread + 70);
    const cy = y - 34 + i * 2;
    const y1 = y + 30 + i * 3;
    out.push(
      `<path d="M${x0},${y} Q${cx + side * spread},${cy} ${x1},${y1}" stroke="#d9d9d9" stroke-opacity="${0.09 + r() * 0.06}" stroke-width="${9 - i * 0.35 + r() * 2}" fill="none" stroke-linecap="round" filter="url(#rib)"/>`
    );
  }
  return out.join('');
}

export function chestXraySvg(seed = 7, lesions: Box[] = []): string {
  const r = rng(seed);
  const tilt = (r() - 0.5) * 3;
  const lesionEls = lesions
    .map(([x1, y1, x2, y2]) => {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const rx = (x2 - x1) / 2, ry = (y2 - y1) / 2;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#e8e8e8" opacity=".42" filter="url(#soft)"/>
              <ellipse cx="${cx + rx * 0.15}" cy="${cy + ry * 0.1}" rx="${rx * 0.55}" ry="${ry * 0.5}" fill="#f4f4f4" opacity=".35" filter="url(#soft)"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="rib" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="softer" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${seed}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .09 0"/></filter>
    <filter id="mottle"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="${seed + 3}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .10 0"/></filter>
    <radialGradient id="vig" cx="50%" cy="48%" r="62%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".8"/></radialGradient>
    <linearGradient id="spine" x1="0" x2="1"><stop offset="0" stop-color="#bbb" stop-opacity="0"/><stop offset=".5" stop-color="#d0d0d0" stop-opacity=".55"/><stop offset="1" stop-color="#bbb" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="512" height="512" fill="#0a0a0a"/>
  <g transform="rotate(${tilt} 256 256)">
    <!-- soft tissue -->
    <path d="M70,512 C60,380 70,220 120,130 C160,70 210,52 256,52 C302,52 352,70 392,130 C442,220 452,380 442,512 Z" fill="#6a6a6a" opacity=".55" filter="url(#softer)"/>
    <!-- shoulders / clavicles -->
    <path d="M110,118 Q180,96 244,124" stroke="#e0e0e0" stroke-opacity=".5" stroke-width="11" fill="none" stroke-linecap="round" filter="url(#soft)"/>
    <path d="M402,118 Q332,96 268,124" stroke="#e0e0e0" stroke-opacity=".5" stroke-width="11" fill="none" stroke-linecap="round" filter="url(#soft)"/>
    <!-- lungs -->
    <path d="M238,120 C200,118 150,150 132,230 C116,310 120,390 150,430 C190,440 225,420 240,400 Z" fill="#0d0d0d" opacity=".92" filter="url(#soft)"/>
    <path d="M274,120 C312,118 362,150 380,230 C396,310 392,390 362,430 C322,440 287,420 272,400 Z" fill="#0d0d0d" opacity=".92" filter="url(#soft)"/>
    <rect width="512" height="512" filter="url(#mottle)"/>
    ${ribs(1, r)}${ribs(-1, r)}
    <!-- spine & mediastinum -->
    <rect x="232" y="60" width="48" height="452" fill="url(#spine)" filter="url(#soft)"/>
    <path d="M250,250 C300,250 340,290 345,350 C345,400 300,420 262,415 C240,410 232,330 250,250 Z" fill="#cfcfcf" opacity=".42" filter="url(#softer)"/>
    <!-- diaphragm -->
    <path d="M130,430 Q190,395 248,420" stroke="#ccc" stroke-opacity=".35" stroke-width="18" fill="none" filter="url(#soft)"/>
    <path d="M264,425 Q330,400 384,432" stroke="#ccc" stroke-opacity=".35" stroke-width="18" fill="none" filter="url(#soft)"/>
    ${lesionEls}
  </g>
  <rect width="512" height="512" fill="url(#vig)"/>
  <rect width="512" height="512" filter="url(#grain)"/>
  <text x="22" y="36" font-family="monospace" font-size="15" fill="#e8e8e8" opacity=".75">R</text>
  <text x="440" y="494" font-family="monospace" font-size="10" fill="#e8e8e8" opacity=".4">PA ERECT</text>
</svg>`;
}

export function brainMriSvg(seed = 11, lesions: Box[] = []): string {
  const r = rng(seed);
  const asym = (r() - 0.5) * 6;
  const lesionEls = lesions
    .map(([x1, y1, x2, y2]) => {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const rx = (x2 - x1) / 2, ry = (y2 - y1) / 2;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 1.25}" ry="${ry * 1.25}" fill="#cfcfcf" opacity=".22" filter="url(#b8)"/>
              <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#2a2a2a" opacity=".55" filter="url(#b3)"/>
              <ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.78}" ry="${ry * 0.74}" fill="#f2f2f2" opacity=".8" filter="url(#b3)"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <filter id="b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="b8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="gyri" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="turbulence" baseFrequency=".028 .034" numOctaves="3" seed="${seed}"/>
      <feColorMatrix values="0 0 0 0 .9  0 0 0 0 .9  0 0 0 0 .9  0 0 0 .55 -.08"/>
      <feGaussianBlur stdDeviation="1.2"/>
    </filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".95" numOctaves="2" seed="${seed + 9}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/></filter>
    <clipPath id="brain"><ellipse cx="256" cy="262" rx="158" ry="192"/></clipPath>
  </defs>
  <rect width="512" height="512" fill="#060606"/>
  <!-- scalp & skull -->
  <ellipse cx="256" cy="262" rx="186" ry="222" fill="#8a8a8a" opacity=".35" filter="url(#b8)"/>
  <ellipse cx="256" cy="262" rx="176" ry="210" fill="#111" />
  <ellipse cx="256" cy="262" rx="170" ry="204" fill="none" stroke="#3a3a3a" stroke-width="10"/>
  <!-- CSF rim (bright on T2) -->
  <ellipse cx="256" cy="262" rx="162" ry="196" fill="#bdbdbd" opacity=".55" filter="url(#b3)"/>
  <!-- parenchyma -->
  <ellipse cx="256" cy="262" rx="156" ry="190" fill="#5c5c5c"/>
  <g clip-path="url(#brain)">
    <rect width="512" height="512" filter="url(#gyri)"/>
    <ellipse cx="256" cy="262" rx="105" ry="140" fill="#4a4a4a" opacity=".55" filter="url(#b8)"/>
  </g>
  <!-- falx -->
  <line x1="256" y1="72" x2="256" y2="452" stroke="#d6d6d6" stroke-opacity=".5" stroke-width="2.5" filter="url(#b3)"/>
  <!-- lateral ventricles -->
  <path d="M250,190 C230,186 214,206 218,240 C222,272 226,300 236,318 C246,310 250,280 251,250 Z" fill="#e6e6e6" opacity=".82" filter="url(#b3)" transform="translate(${asym * 0.4},0)"/>
  <path d="M262,190 C282,186 298,206 294,240 C290,272 286,300 276,318 C266,310 262,280 261,250 Z" fill="#e6e6e6" opacity=".82" filter="url(#b3)" transform="translate(${-asym * 0.4},0)"/>
  <!-- third ventricle -->
  <rect x="252" y="320" width="8" height="34" rx="4" fill="#e6e6e6" opacity=".6" filter="url(#b3)"/>
  ${lesionEls}
  <rect width="512" height="512" filter="url(#grain)"/>
  <text x="22" y="36" font-family="monospace" font-size="15" fill="#e8e8e8" opacity=".75">R</text>
  <text x="422" y="494" font-family="monospace" font-size="10" fill="#e8e8e8" opacity=".4">AX T2 FLAIR</text>
</svg>`;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function scanDataUrl(modality: string, seed: number, lesions: Box[]): string {
  return svgToDataUrl(modality === 'brain_mri' ? brainMriSvg(seed, lesions) : chestXraySvg(seed, lesions));
}
