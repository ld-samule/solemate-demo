const NODES = [
  { id: "solemate-router", label: "Router", col: 0, row: 1 },
  { id: "solemate-chatbot", label: "Chatbot", col: 1, row: 0 },
  { id: "solemate-scope-judge", label: "Judge", col: 2, row: 0 },
  { id: "solemate-task-orchestrator", label: "Orchestrator", col: 1, row: 2 },
  { id: "solemate-researcher", label: "Researcher", col: 2, row: 2 },
  { id: "solemate-reviewer", label: "Reviewer", col: 3, row: 2 },
  { id: "solemate-implementer", label: "Implementer", col: 4, row: 2 },
  { id: "solemate-brand-agent", label: "Brand Agent", col: 5, row: 1 },
];

const EDGES = [
  { from: "solemate-router", to: "solemate-chatbot", label: "info" },
  { from: "solemate-router", to: "solemate-task-orchestrator", label: "action" },
  { from: "solemate-chatbot", to: "solemate-scope-judge" },
  { from: "solemate-scope-judge", to: "solemate-brand-agent" },
  { from: "solemate-task-orchestrator", to: "solemate-researcher" },
  { from: "solemate-researcher", to: "solemate-reviewer" },
  { from: "solemate-reviewer", to: "solemate-implementer" },
  { from: "solemate-implementer", to: "solemate-brand-agent" },
];

const STATUS_STYLES = {
  idle: { border: "border-neutral-300", bg: "bg-neutral-50", text: "text-neutral-400" },
  active: { border: "border-blue-500", bg: "bg-blue-50", text: "text-blue-700", pulse: true },
  awaiting_approval: { border: "border-amber-400", bg: "bg-amber-50", text: "text-amber-700", pulse: true },
  success: { border: "border-green-500", bg: "bg-green-50", text: "text-green-700" },
  warn: { border: "border-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  blocked: { border: "border-red-500", bg: "bg-red-50", text: "text-red-700" },
};

const CELL_W = 80;
const CELL_H = 50;
const NODE_W = 70;
const NODE_H = 28;
const PAD_X = 10;
const PAD_Y = 8;

function getNodeStatus(nodeId, events) {
  let status = "idle";
  for (const evt of events) {
    if (evt.node === nodeId) status = evt.status;
  }
  return status;
}

function nodeCenter(node) {
  return {
    x: PAD_X + node.col * CELL_W + NODE_W / 2,
    y: PAD_Y + node.row * CELL_H + NODE_H / 2,
  };
}

export default function PipelineGraph({ events = [] }) {
  const maxCol = Math.max(...NODES.map((n) => n.col));
  const maxRow = Math.max(...NODES.map((n) => n.row));
  const svgW = PAD_X * 2 + (maxCol + 1) * CELL_W;
  const svgH = PAD_Y * 2 + (maxRow + 1) * CELL_H;

  const nodeMap = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ minHeight: 130 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="6" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 10 3 L 0 6 z" fill="#a3a3a3" />
        </marker>
        <marker id="arrow-active" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="6" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 10 3 L 0 6 z" fill="#3b82f6" />
        </marker>
      </defs>

      {/* Edges */}
      {EDGES.map((edge, i) => {
        const from = nodeMap[edge.from];
        const to = nodeMap[edge.to];
        if (!from || !to) return null;
        const a = nodeCenter(from);
        const b = nodeCenter(to);

        const fromStatus = getNodeStatus(edge.from, events);
        const toStatus = getNodeStatus(edge.to, events);
        const isActive = fromStatus !== "idle" && toStatus !== "idle";

        return (
          <line
            key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={isActive ? "#3b82f6" : "#d4d4d4"}
            strokeWidth={isActive ? 1.5 : 1}
            markerEnd={isActive ? "url(#arrow-active)" : "url(#arrow)"}
          />
        );
      })}

      {/* Nodes */}
      {NODES.map((node) => {
        const status = getNodeStatus(node.id, events);
        const style = STATUS_STYLES[status] || STATUS_STYLES.idle;
        const x = PAD_X + node.col * CELL_W;
        const y = PAD_Y + node.row * CELL_H;

        const borderColor =
          status === "active" ? "#3b82f6"
          : status === "awaiting_approval" ? "#f59e0b"
          : status === "success" ? "#22c55e"
          : status === "warn" ? "#f59e0b"
          : status === "blocked" ? "#ef4444"
          : "#d4d4d4";
        const fillColor =
          status === "active" ? "#eff6ff"
          : status === "awaiting_approval" ? "#fffbeb"
          : status === "success" ? "#f0fdf4"
          : status === "warn" ? "#fffbeb"
          : status === "blocked" ? "#fef2f2"
          : "#fafafa";

        return (
          <g key={node.id}>
            {style.pulse && (
              <rect
                x={x} y={y} width={NODE_W} height={NODE_H} rx={4}
                fill="none" stroke={borderColor} strokeWidth={2}
                opacity={0.4}
              >
                <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" />
              </rect>
            )}
            <rect
              x={x} y={y} width={NODE_W} height={NODE_H} rx={4}
              fill={fillColor} stroke={borderColor} strokeWidth={1.5}
            />
            <text
              x={x + NODE_W / 2} y={y + NODE_H / 2 + 1}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fontWeight={600}
              fill={status === "idle" ? "#a3a3a3" : borderColor}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
