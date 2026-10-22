import { MannequinFigure } from "@/components/pitch/mannequin-figure";
import { DEFAULT_OPPONENT_COLOR, DEFAULT_PLAYER_COLOR } from "@/lib/club/board";
import type { SetupDiagram } from "@/lib/club/catalog";

type DiagramProps = {
  diagram: SetupDiagram;
  pitchSetup: string;
  size?: "sm" | "md";
};

const frame = {
  sm: { width: 96, height: 64 },
  md: { width: 176, height: 112 },
};

export function DrillSetupDiagram({ diagram, pitchSetup, size = "md" }: DiagramProps) {
  const box = frame[size];
  return (
    <svg
      viewBox="0 0 160 100"
      width={box.width}
      height={box.height}
      role="img"
      aria-label={`Setup diagram. ${pitchSetup}`}
      className="shrink-0 rounded-lg bg-emerald-50 ring-1 ring-emerald-700"
    >
      <rect x="1" y="1" width="158" height="98" rx="8" fill="#ecfaf8" stroke="#0f766e" strokeWidth="2" />
      <SetupShape diagram={diagram} />
    </svg>
  );
}

function SetupShape({ diagram }: { diagram: SetupDiagram }) {
  switch (diagram) {
    case "square":
      return <SquarePassing />;
    case "channel":
      return <ChannelToGoal />;
    case "rondo":
      return <Rondo />;
    case "overlap":
      return <Overlap />;
    case "press":
      return <Press />;
    case "gates":
      return <TwoGates />;
    case "lanes":
      return <Lanes />;
    case "corner":
      return <Corner />;
  }
}

function Cone({ x, y }: { x: number; y: number }) {
  return <polygon points={`${x},${y + 8} ${x - 6},${y + 16} ${x + 6},${y + 16}`} fill="#d97706" stroke="#78350f" strokeWidth="1" />;
}

function Player({ x, y, dark = false }: { x: number; y: number; dark?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(4.2)`}>
      <MannequinFigure fill={dark ? DEFAULT_OPPONENT_COLOR : DEFAULT_PLAYER_COLOR} ring="#ffffff" label="" />
    </g>
  );
}

function Ball({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="3.5" fill="#fff" stroke="#0f172a" strokeWidth="1" />;
}

function Goal({ x, y, vertical = false }: { x: number; y: number; vertical?: boolean }) {
  if (vertical) {
    return <path d={`M${x} ${y} h10 v22 h-10`} fill="none" stroke="#0f172a" strokeWidth="2" />;
  }
  return <path d={`M${x} ${y} v10 h22 v-10`} fill="none" stroke="#0f172a" strokeWidth="2" />;
}

function SquarePassing() {
  return (
    <g>
      <rect x="48" y="22" width="64" height="56" fill="none" stroke="#047857" strokeWidth="1.5" strokeDasharray="3 2" />
      <Cone x={48} y={14} />
      <Cone x={112} y={14} />
      <Cone x={48} y={62} />
      <Cone x={112} y={62} />
      <Player x={48} y={30} />
      <Player x={112} y={30} />
      <Player x={112} y={78} />
      <Player x={48} y={78} />
      <Ball x={78} y={30} />
      <path d="M58 28 H96" fill="none" stroke="#0f172a" strokeWidth="1.5" />
      <polygon points="96,24 104,28 96,32" fill="#0f172a" />
    </g>
  );
}

function ChannelToGoal() {
  return (
    <g>
      <rect x="28" y="18" width="78" height="64" fill="none" stroke="#047857" strokeWidth="1.5" />
      <Goal x={106} y={39} vertical />
      <Cone x={36} y={42} />
      <Player x={48} y={50} />
      <Player x={78} y={50} dark />
      <Ball x={58} y={50} />
    </g>
  );
}

function Rondo() {
  return (
    <g>
      <rect x="40" y="18" width="80" height="64" fill="none" stroke="#047857" strokeWidth="1.5" />
      <Player x={40} y={18} />
      <Player x={120} y={18} />
      <Player x={120} y={82} />
      <Player x={40} y={82} />
      <Player x={70} y={50} dark />
      <Player x={92} y={50} dark />
      <Ball x={104} y={24} />
    </g>
  );
}

function Overlap() {
  return (
    <g>
      <rect x="18" y="16" width="110" height="68" fill="none" stroke="#047857" strokeWidth="1.5" />
      <Goal x={128} y={39} vertical />
      <Cone x={36} y={22} />
      <Cone x={36} y={58} />
      <Player x={48} y={34} />
      <Player x={70} y={58} />
      <path d="M48 40 C70 40 78 62 100 50" fill="none" stroke="#0f172a" strokeWidth="1.5" />
      <Ball x={108} y={48} />
    </g>
  );
}

function Press() {
  return (
    <g>
      <rect x="16" y="14" width="128" height="72" fill="none" stroke="#047857" strokeWidth="1.5" />
      <Goal x={16} y={39} vertical />
      <Player x={36} y={50} />
      <Player x={52} y={28} />
      <Player x={52} y={42} />
      <Player x={52} y={58} />
      <Player x={52} y={72} />
      <Player x={96} y={30} dark />
      <Player x={110} y={44} dark />
      <Player x={110} y={58} dark />
      <Player x={96} y={72} dark />
      <Ball x={84} y={50} />
    </g>
  );
}

function TwoGates() {
  return (
    <g>
      <path d="M36 28 v44 M52 28 v44" stroke="#d97706" strokeWidth="3" />
      <path d="M108 28 v44 M124 28 v44" stroke="#d97706" strokeWidth="3" />
      <path d="M52 50 H108" stroke="#0f172a" strokeWidth="1.5" strokeDasharray="4 3" />
      <Player x={64} y={50} />
      <Ball x={74} y={50} />
    </g>
  );
}

function Lanes() {
  return (
    <g>
      {[28, 58, 88, 118].map((x) => (
        <g key={x}>
          <rect x={x} y={18} width="16" height="64" fill="none" stroke="#047857" strokeWidth="1.5" />
          <Player x={x + 8} y={70} />
        </g>
      ))}
    </g>
  );
}

function Corner() {
  return (
    <g>
      <rect x="20" y="16" width="120" height="70" fill="none" stroke="#047857" strokeWidth="1.5" />
      <Goal x={58} y={16} />
      <path d="M20 86 a16 16 0 0 0 16-16" fill="none" stroke="#0f172a" strokeWidth="1.5" />
      <Player x={32} y={74} />
      <Player x={62} y={36} />
      <Player x={80} y={48} />
      <Player x={98} y={36} />
      <Player x={70} y={48} dark />
      <Ball x={36} y={70} />
    </g>
  );
}
