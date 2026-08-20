import { useEffect, useRef } from "react";
import PipelineGraph from "./PipelineGraph";

const STATUS_BORDER = {
  info: "border-neutral-300",
  active: "border-blue-400",
  success: "border-green-500",
  warn: "border-amber-400",
  block: "border-red-500",
  blocked: "border-red-500",
  awaiting_approval: "border-amber-400",
};

const STATUS_DOT = {
  info: "bg-neutral-400",
  active: "bg-blue-500",
  success: "bg-green-500",
  warn: "bg-amber-500",
  block: "bg-red-500",
  blocked: "bg-red-500",
  awaiting_approval: "bg-amber-500",
};

function eventLabel(evt) {
  if (evt.label) return evt.label;
  if (evt.node) {
    const name = evt.node.replace("solemate-", "").replace(/-/g, " ");
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    if (evt.status === "active") return `${cap} running`;
    if (evt.status === "success") return `${cap} complete`;
    if (evt.status === "awaiting_approval") return `${cap} — awaiting approval`;
    if (evt.status === "warn") return `${cap} — warning`;
    if (evt.status === "blocked") return `${cap} — blocked`;
    return cap;
  }
  return "Event";
}

export default function ReasoningPanel({ events, isOpen, onClose }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-24 right-[26rem] z-50 w-[26rem] bg-white border border-neutral-200 shadow-2xl flex flex-col overflow-hidden"
      style={{ height: "34rem" }}
    >
      {/* Header */}
      <div className="bg-black px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <h3 className="text-white font-bold text-xs uppercase tracking-widest">
            Agent Reasoning
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white transition-colors"
          aria-label="Close reasoning panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Graph Visualization */}
      <div className="px-3 pt-3 pb-1 border-b border-neutral-100 shrink-0 bg-neutral-50">
        <PipelineGraph events={events} />
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-neutral-400 text-xs text-center px-4">
              Send a message to see the agent&apos;s reasoning.
            </p>
          </div>
        ) : (
          events.map((evt, i) => {
            const status = evt.status || "info";
            return (
              <div
                key={i}
                className={`border-l-2 pl-3 py-1.5 ${STATUS_BORDER[status] || STATUS_BORDER.info}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status] || STATUS_DOT.info}`} />
                  <p className="text-xs font-semibold text-black leading-snug">
                    {eventLabel(evt)}
                  </p>
                  {evt.node && (
                    <span className="text-[9px] text-neutral-400 uppercase tracking-wider ml-auto shrink-0">
                      {evt.node.replace("solemate-", "")}
                    </span>
                  )}
                </div>
                {evt.detail && (
                  <p className="text-xs text-neutral-500 mt-0.5 leading-snug pl-3 break-words">
                    {evt.detail.length > 120 ? evt.detail.slice(0, 120) + "..." : evt.detail}
                  </p>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
