import type { Polyline } from './types';

/**
 * 가변폭 폴리라인 → SVG (docs/claude_mellan_pipeline_v2.md §6 출력 계층).
 * SVG stroke-width 는 경로를 따라 변할 수 없으므로, 각 폴리라인을 **오프셋 아웃라인
 * 폴리곤**으로 채운다: 점마다 국소 법선 방향으로 ±thickness/2 만큼 좌/우 오프셋한 뒤
 * 좌측 정방향 + 우측 역방향으로 닫아 하나의 채움 도형을 만든다. 전 폴리라인을 subpath
 * (M…Z)로 이어 단일 <path fill> 로 출력(해상도 독립 벡터).
 */
export function svgFromPolylines(
  polys: Polyline[],
  width: number,
  height: number,
  opts: { background?: string; color?: string } = {},
): string {
  const bg = opts.background ?? '#ffffff';
  const color = opts.color ?? '#111111';
  const subpaths: string[] = [];
  for (const poly of polys) {
    if (poly.length < 2) continue;
    const left: string[] = [];
    const right: string[] = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const a = poly[Math.max(0, i - 1)];
      const b = poly[Math.min(poly.length - 1, i + 1)];
      let tx = b.x - a.x;
      let ty = b.y - a.y;
      const m = Math.hypot(tx, ty) || 1;
      tx /= m;
      ty /= m;
      const nx = -ty; // 접선의 좌법선
      const ny = tx;
      const h = p.thickness / 2;
      left.push(`${(p.x + nx * h).toFixed(2)},${(p.y + ny * h).toFixed(2)}`);
      right.push(`${(p.x - nx * h).toFixed(2)},${(p.y - ny * h).toFixed(2)}`);
    }
    right.reverse();
    subpaths.push(`M${left.join(' L')} L${right.join(' L')}Z`);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${bg}"/>` +
    `<path d="${subpaths.join(' ')}" fill="${color}" fill-rule="nonzero"/>` +
    `</svg>`
  );
}
