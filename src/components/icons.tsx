import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

/** Reprise four-point sparkle (filled). The brand mark. */
export const Sparkle = ({ size = 14, color = '#D97757' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 2 13.7 9.4 21 12 13.7 14.6 12 22 10.3 14.6 3 12 10.3 9.4Z"
      fill={color}
    />
  </Svg>
);

export const Mic = ({ size = 16, color = '#fff' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={9} y={3} width={6} height={11} rx={3} fill={color} />
    <Path
      d="M5 11a7 7 0 0 0 14 0M12 18v3"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export const Home = ({ size = 22, color = '#1F1E1D' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"
      stroke={color}
      strokeWidth={1.9}
      strokeLinejoin="round"
    />
  </Svg>
);

export const SparkOutline = ({ size = 22, color = '#BBAFA3' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 4l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1L4.5 9.5l5.2-.8z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </Svg>
);

export const People = ({ size = 22, color = '#BBAFA3' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={9} cy={9} r={3} stroke={color} strokeWidth={1.8} />
    <Path
      d="M3.5 19a5.5 5.5 0 0 1 11 0M16 7a3 3 0 0 1 0 6m4.5 6a4.6 4.6 0 0 0-3.5-4.4"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </Svg>
);

export const Gallery = ({ size = 22, color = '#BBAFA3' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3.5} y={5} width={17} height={14} rx={3} stroke={color} strokeWidth={1.8} />
    <Circle cx={9} cy={10} r={1.6} fill={color} />
    <Path
      d="M5 17l4.5-4 3 2.5L16 12l3 3"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const Back = ({ size = 18, color = '#5A554E' }: IconProps) => (
  <Svg width={(size * 11) / 18} height={size} viewBox="0 0 11 18" fill="none">
    <Path
      d="M9 2 1.5 9 9 16"
      stroke={color}
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const Pencil = ({ size = 13, color = '#7A6356' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 20h4L19 9l-4-4L4 16z"
      stroke={color}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  </Svg>
);

export const Pin = ({ size = 11, color = '#6F5D54' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} />
    <Path
      d="M12 2c4 0 7 3 7 7 0 4.5-7 13-7 13S5 13.5 5 9c0-4 3-7 7-7z"
      stroke={color}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  </Svg>
);

export const Lock = ({ size = 13, color = '#998F84' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={4.5} y={10} width={15} height={10} rx={2.5} stroke={color} strokeWidth={2} />
    <Path d="M8 10V7a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={2} />
  </Svg>
);

export const Check = ({ size = 12, color = '#fff' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12.5 10 17.5 19 7"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const Share = ({ size = 17, color = '#5A554E' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 15V4m0 0 4 4m-4-4-4 4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export const ArrowRight = ({ size = 17, color = '#fff' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12h13m0 0-5-5m5 5-5 5"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const Play = ({ size = 14, color = '#fff' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M7 4 19 12 7 20Z" fill={color} />
  </Svg>
);

export const Pause = ({ size = 14, color = '#fff' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x={6} y={4} width={4.5} height={16} rx={1.5} fill={color} />
    <Rect x={13.5} y={4} width={4.5} height={16} rx={1.5} fill={color} />
  </Svg>
);

export const Search = ({ size = 18, color = '#A39A8E' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={1.9} />
    <Path d="M16 16l4 4" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
  </Svg>
);

/** Circle with a check - used for the Actions tab and completed states. */
export const CheckCircle = ({ size = 22, color = '#BBAFA3' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.8} />
    <Path
      d="M8.5 12.2 11 14.7 15.6 9.5"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ChevronRight = ({ size = 16, color = '#C4BBAD' }: IconProps) => (
  <Svg width={(size * 8) / 16} height={size} viewBox="0 0 8 16" fill="none">
    <Path
      d="M1.5 1.5 7 8l-5.5 6.5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const Clock = ({ size = 13, color = '#A8A096' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.9} />
    <Path d="M12 7.5V12l3 2" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const Plus = ({ size = 18, color = '#fff' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);

export const Calendar = ({ size = 16, color = '#6F5D54' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3.5} y={5} width={17} height={15} rx={3.5} stroke={color} strokeWidth={1.9} />
    <Path
      d="M3.5 9.5h17M8 3v4M16 3v4"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
    />
  </Svg>
);

/** Three ascending bars - used for the Insights entry point and header. */
export const Chart = ({ size = 16, color = '#C15F3C' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={4} y={12} width={3.6} height={8} rx={1.6} fill={color} />
    <Rect x={10.2} y={6} width={3.6} height={14} rx={1.6} fill={color} />
    <Rect x={16.4} y={9.5} width={3.6} height={10.5} rx={1.6} fill={color} />
  </Svg>
);

/** Live-captions glyph: a rounded panel with two text lines. */
export const Captions = ({ size = 13, color = '#6F5D54' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={5} width={18} height={14} rx={3.5} stroke={color} strokeWidth={1.9} />
    <Path
      d="M7 10.5h3.5M7 14h7M14 10.5h3"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
    />
  </Svg>
);
