export function MannequinFigure({ fill, ring, label }: { fill: string; ring: string; label: string }) {
  return (
    <g data-figure="mannequin" data-fill={fill}>
      <circle cy="-1.15" r="0.82" fill={fill} stroke={ring} strokeWidth="0.22" />
      <path
        d="M-1.05 -0.42 C-1.25 0.4 -1.05 1.15 -0.72 1.38 L0.72 1.38 C1.05 1.15 1.25 0.4 1.05 -0.42 Z"
        fill={fill}
        stroke={ring}
        strokeWidth="0.22"
      />
      {label ? (
        <text y="0.85" textAnchor="middle" fontSize="1.15" fontWeight="700" fill={inkOn(fill)} stroke="none">
          {label}
        </text>
      ) : null}
    </g>
  );
}

function inkOn(hex: string) {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "#ffffff";
  const red = Number.parseInt(raw.slice(0, 2), 16);
  const green = Number.parseInt(raw.slice(2, 4), 16);
  const blue = Number.parseInt(raw.slice(4, 6), 16);
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.64 ? "#0b1b33" : "#ffffff";
}
