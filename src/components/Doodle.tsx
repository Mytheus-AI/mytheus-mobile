import React from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { doodleSpec, drawDoodle, type Shape } from '@/lib/doodle';

/* An agent's doodle face, drawn from its seed exactly as mytheus-ui draws it. Decorative: the
   agent's name is always said next to it. */

function ShapeEl({ s }: { s: Shape }) {
  const stroke = s.stroke ? { stroke: s.stroke, strokeWidth: s.sw ?? 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const } : {};
  const common = { fill: s.fill ?? 'none', opacity: s.opacity, ...stroke };
  if (s.el === 'path') return <Path d={s.d} {...common} />;
  if (s.el === 'circle') return <Circle cx={s.cx} cy={s.cy} r={s.r} {...common} />;
  return <Ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />;
}

export function Doodle({ seed, size = 56 }: { seed: string; size?: number }) {
  const spec = doodleSpec(seed);
  const { back, body, head } = drawDoodle(spec);
  const clip = `dc-${seed.replace(/[^a-z0-9]/gi, '').slice(0, 24) || 'x'}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessible={false}>
      <Defs>
        <ClipPath id={clip}>
          <Circle cx="32" cy="32" r="32" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`}>
        <Rect width="64" height="64" fill={spec.tile} />
        {body.map((s, i) => (
          <ShapeEl key={`b${i}`} s={s} />
        ))}
        <G rotation={spec.tilt} origin="32, 40">
          {back.map((s, i) => (
            <ShapeEl key={`k${i}`} s={s} />
          ))}
          {head.map((s, i) => (
            <ShapeEl key={`h${i}`} s={s} />
          ))}
        </G>
      </G>
    </Svg>
  );
}
