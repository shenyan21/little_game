import React, { useMemo } from 'react';
import { Hex, Player, BOARD_SIZE } from '../types';
import { getHexId } from '../game/logic';

interface HexBoardProps {
  board: Map<string, Player>;
  onCellClick: (q: number, r: number) => void;
  lastMove: Hex | null;
  interactive: boolean;
}

const HEX_SIZE = 24;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HEIGHT = 2 * HEX_SIZE;
const VERT_DIST = 1.5 * HEX_SIZE;
const BORDER_WIDTH = HEX_SIZE * 1.2;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

// Helper to get pixel coordinates (Pointy Top Hexagons)
const getPixel = (q: number, r: number) => ({
  x: (q + r / 2) * HEX_WIDTH,
  y: r * VERT_DIST
});

// Calculate vertices for a single hex at pixel (px, py)
// Vertices are indexed 0 to 5 starting from Top-Right (330deg) and going clockwise
// 0: 330 (-30) deg (Top Right)
// 1: 30 deg (Bottom Right)
// 2: 90 deg (Bottom)
// 3: 150 deg (Bottom Left)
// 4: 210 deg (Top Left)
// 5: 270 deg (Top)
const getHexVertices = (px: number, py: number) => {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle_deg = 60 * i - 30;
    const angle_rad = Math.PI / 180 * angle_deg;
    points.push({
      x: px + HEX_SIZE * Math.cos(angle_rad),
      y: py + HEX_SIZE * Math.sin(angle_rad)
    });
  }
  return points;
};

const p2s = (p: {x:number, y:number}) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

const HexCell = ({
  q,
  r,
  owner,
  isLastMove,
  onClick,
  disabled
}: {
  q: number;
  r: number;
  owner: Player;
  isLastMove: boolean;
  onClick: () => void;
  disabled: boolean;
}) => {
  const { x, y } = getPixel(q, r);
  const vertices = getHexVertices(x, y);
  const pointsStr = vertices.map(v => `${v.x},${v.y}`).join(' ');

  // Styles
  let fillClass = 'fill-[#dcb482]'; // Standard wood/beige
  if (owner === Player.Black) fillClass = 'fill-[#1a1a1a]';
  if (owner === Player.White) fillClass = 'fill-[#f3f4f6]';

  return (
    <g
      className={`transition-all duration-150 ${!disabled && owner === Player.None ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={!disabled ? onClick : undefined}
    >
      <polygon
        points={pointsStr}
        className={`${fillClass} stroke-[#6b4e3d] stroke-[1.5]`}
      />
      {owner !== Player.None && (
        <g className="pointer-events-none">
          <circle cx={x} cy={y} r={HEX_SIZE * 0.65} className={owner === Player.Black ? "fill-black" : "fill-white"} />
          <circle cx={x} cy={y} r={HEX_SIZE * 0.65} className="fill-transparent stroke-black/20 stroke-1" />
          <ellipse 
             cx={x - HEX_SIZE*0.2} cy={y - HEX_SIZE*0.2} 
             rx={HEX_SIZE*0.2} ry={HEX_SIZE*0.12} 
             transform={`rotate(-45, ${x - HEX_SIZE*0.2}, ${y - HEX_SIZE*0.2})`}
             className="fill-white/40" 
          />
        </g>
      )}
      {isLastMove && (
        <circle cx={x} cy={y} r={HEX_SIZE * 0.25} className="fill-red-500 animate-pulse pointer-events-none" />
      )}
    </g>
  );
};

export const HexBoard: React.FC<HexBoardProps> = ({ board, onCellClick, lastMove, interactive }) => {
  // Board dimensions calculations
  const topCenter = getPixel(0, 0);
  const bottomCenter = getPixel(BOARD_SIZE - 1, BOARD_SIZE - 1);
  
  // Calculate specific corner vertices for precise border attachment
  const TL_Hex_V4 = getHexVertices(getPixel(0,0).x, getPixel(0,0).y)[4]; // Top Left Vertex of (0,0)
  const TR_Hex_V0 = getHexVertices(getPixel(BOARD_SIZE-1,0).x, getPixel(BOARD_SIZE-1,0).y)[0]; // Top Right Vertex of (N-1,0)
  const BL_Hex_V3 = getHexVertices(getPixel(0,BOARD_SIZE-1).x, getPixel(0,BOARD_SIZE-1).y)[3]; // Bot Left Vertex of (0,N-1)
  const BR_Hex_V1 = getHexVertices(getPixel(BOARD_SIZE-1,BOARD_SIZE-1).x, getPixel(BOARD_SIZE-1,BOARD_SIZE-1).y)[1]; // Bot Right Vertex of (N-1,N-1)

  // Outer Border Box Logic (Parallelogram)
  // We define 4 lines and find their intersections.
  // Slope of left/right edges is sqrt(3) (60 degrees)
  const slope = Math.sqrt(3);
  
  // Line Equations: y = mx + c  =>  c = y - mx;
  // x = (y - c) / m
  
  const yTop = TL_Hex_V4.y - BORDER_WIDTH;
  const yBot = BR_Hex_V1.y + BORDER_WIDTH;
  
  // Left Line passes through a point offset from TL
  // Using TL_Hex_V4 as anchor, shift left
  const xLeftAnchor = TL_Hex_V4.x - BORDER_WIDTH * 1.5;
  const cLeft = TL_Hex_V4.y - slope * xLeftAnchor;
  
  // Right Line passes through a point offset from TR
  const xRightAnchor = TR_Hex_V0.x + BORDER_WIDTH * 1.5;
  const cRight = TR_Hex_V0.y - slope * xRightAnchor;

  // Intersections
  const getX = (y: number, c: number) => (y - c) / slope;

  const TL_Outer = { x: getX(yTop, cLeft), y: yTop };
  const TR_Outer = { x: getX(yTop, cRight), y: yTop };
  const BL_Outer = { x: getX(yBot, cLeft), y: yBot };
  const BR_Outer = { x: getX(yBot, cRight), y: yBot };

  // Generate Border Polygons
  const topBorderPath = useMemo(() => {
    let path = `M ${p2s(TL_Outer)} L ${p2s(TR_Outer)} `;
    // Inner jagged edge: Right to Left (q: N-1 -> 0)
    for (let q = BOARD_SIZE - 1; q >= 0; q--) {
      const v = getHexVertices(getPixel(q, 0).x, getPixel(q, 0).y);
      path += `L ${p2s(v[0])} L ${p2s(v[5])} `; // V0(TopRight) -> V5(Top)
      if (q === 0) path += `L ${p2s(v[4])} `; // Close at TL corner V4
    }
    path += "Z";
    return path;
  }, [TL_Outer, TR_Outer]);

  const bottomBorderPath = useMemo(() => {
    let path = `M ${p2s(BL_Outer)} L ${p2s(BR_Outer)} `;
    // Inner jagged edge: Right to Left (q: N-1 -> 0)
    // Actually we need to connect BR_Outer to the rightmost hex bottom
    for (let q = BOARD_SIZE - 1; q >= 0; q--) {
      const v = getHexVertices(getPixel(q, BOARD_SIZE - 1).x, getPixel(q, BOARD_SIZE - 1).y);
      path += `L ${p2s(v[1])} L ${p2s(v[2])} `; // V1(BotRight) -> V2(Bot)
      if (q === 0) path += `L ${p2s(v[3])} `; // Close at BL corner V3
    }
    path += "Z";
    return path;
  }, [BL_Outer, BR_Outer]);

  const leftBorderPath = useMemo(() => {
    let path = `M ${p2s(TL_Outer)} L ${p2s(BL_Outer)} `;
    // Inner jagged edge: Bottom to Top (r: N-1 -> 0)
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const v = getHexVertices(getPixel(0, r).x, getPixel(0, r).y);
      path += `L ${p2s(v[3])} L ${p2s(v[4])} `; // V3(BotLeft) -> V4(TopLeft)
    }
    path += "Z";
    return path;
  }, [TL_Outer, BL_Outer]);

  const rightBorderPath = useMemo(() => {
    let path = `M ${p2s(TR_Outer)} L ${p2s(BR_Outer)} `;
    // Inner jagged edge: Bottom to Top (r: N-1 -> 0)
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const v = getHexVertices(getPixel(BOARD_SIZE - 1, r).x, getPixel(BOARD_SIZE - 1, r).y);
      path += `L ${p2s(v[1])} L ${p2s(v[0])} `; // V1(BotRight) -> V0(TopRight)
    }
    path += "Z";
    return path;
  }, [TR_Outer, BR_Outer]);

  // Labels
  const labels = [];
  // Left Numbers
  for(let r=0; r<BOARD_SIZE; r++) {
      const p = getPixel(0, r);
      // Project onto the outer left line
      const xOnLine = getX(p.y, cLeft);
      labels.push(
          <text key={`L${r}`} x={xOnLine + BORDER_WIDTH*0.6} y={p.y} dominantBaseline="middle" textAnchor="middle" className="fill-gray-400 text-[11px] font-bold">
              {r + 1}
          </text>
      );
  }
  // Right Numbers
  for(let r=0; r<BOARD_SIZE; r++) {
      const p = getPixel(BOARD_SIZE-1, r);
      const xOnLine = getX(p.y, cRight);
      labels.push(
          <text key={`R${r}`} x={xOnLine - BORDER_WIDTH*0.6} y={p.y} dominantBaseline="middle" textAnchor="middle" className="fill-gray-400 text-[11px] font-bold">
              {r + 1}
          </text>
      );
  }
  // Top Letters
  for(let q=0; q<BOARD_SIZE; q++) {
      const p = getPixel(q, 0);
      labels.push(
          <text key={`T${q}`} x={p.x} y={yTop + BORDER_WIDTH*0.5} dominantBaseline="middle" textAnchor="middle" className="fill-gray-600 text-[11px] font-bold uppercase">
              {ALPHABET[q]}
          </text>
      );
  }
  // Bottom Letters
  for(let q=0; q<BOARD_SIZE; q++) {
      const p = getPixel(q, BOARD_SIZE-1);
      // Moved further down (increased multiplier from 0.5 to 0.3 relative to yBot subtraction, closer to yBot)
      // Original was yBot - 0.5*Border. yBot is bottom-most.
      // Moving closer to yBot (smaller subtraction) moves it down.
      labels.push(
          <text key={`B${q}`} x={p.x} y={yBot - BORDER_WIDTH*0.3} dominantBaseline="middle" textAnchor="middle" className="fill-gray-600 text-[11px] font-bold uppercase">
              {ALPHABET[q]}
          </text>
      );
  }

  // Cells
  const cells = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let q = 0; q < BOARD_SIZE; q++) {
      const id = getHexId(q, r);
      cells.push(
        <HexCell
          key={id}
          q={q}
          r={r}
          owner={board.get(id) || Player.None}
          isLastMove={lastMove?.q === q && lastMove?.r === r}
          onClick={() => onCellClick(q, r)}
          disabled={!interactive || board.has(id)}
        />
      );
    }
  }

  // ViewBox
  const vbPadding = 50; // Increased padding to prevent clipping of bottom labels
  const minX = Math.min(TL_Outer.x, BL_Outer.x) - vbPadding;
  const maxX = Math.max(TR_Outer.x, BR_Outer.x) + vbPadding;
  const minY = Math.min(TL_Outer.y, TR_Outer.y) - vbPadding;
  const maxY = Math.max(BL_Outer.y, BR_Outer.y) + vbPadding;

  return (
    <div className="flex items-center justify-center w-full h-full p-2 overflow-hidden">
      <svg
        viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
        className="max-w-full max-h-full drop-shadow-2xl select-none"
        style={{ maxHeight: '90vh' }}
      >
        <defs>
             <filter id="shadow">
                <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.3" />
             </filter>
        </defs>
        
        {/* Borders */}
        {/* Top (White) */}
        <path d={topBorderPath} className="fill-[#e5e7eb] stroke-none" />
        {/* Bottom (White) */}
        <path d={bottomBorderPath} className="fill-[#e5e7eb] stroke-none" />
        {/* Left (Black) */}
        <path d={leftBorderPath} className="fill-[#1f2937] stroke-none" />
        {/* Right (Black) */}
        <path d={rightBorderPath} className="fill-[#1f2937] stroke-none" />

        {/* Labels */}
        <g className="pointer-events-none select-none">{labels}</g>
        
        {/* Cells */}
        <g>{cells}</g>
      </svg>
    </div>
  );
};
