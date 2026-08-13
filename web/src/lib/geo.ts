interface LatLon {
  lat: number;
  lon: number;
}

/** Points along the great circle from a to b, as [lon, lat] pairs. */
export function greatCirclePoints(a: LatLon, b: LatLon, n = 64): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const toVec = (p: LatLon) => {
    const lat = toRad(p.lat);
    const lon = toRad(p.lon);
    return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  };
  const va = toVec(a);
  const vb = toVec(b);
  const dot = Math.min(Math.max(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1), 1);
  const angle = Math.acos(dot);
  if (angle < 1e-6) {
    return [
      [a.lon, a.lat],
      [b.lon, b.lat],
    ];
  }

  const points: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const s1 = Math.sin((1 - f) * angle) / Math.sin(angle);
    const s2 = Math.sin(f * angle) / Math.sin(angle);
    const x = s1 * va[0] + s2 * vb[0];
    const y = s1 * va[1] + s2 * vb[1];
    const z = s1 * va[2] + s2 * vb[2];
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }

  // Unwrap longitudes so lines don't jump across the antimeridian.
  for (let i = 1; i < points.length; i++) {
    while (points[i][0] - points[i - 1][0] > 180) points[i][0] -= 360;
    while (points[i][0] - points[i - 1][0] < -180) points[i][0] += 360;
  }
  return points;
}
