import { useState, useEffect, useRef } from "react";
import { useLDClient } from "launchdarkly-react-client-sdk";
import { useCart } from "../context/CartContext";
import products from "../data/products";
import ProductModal from "./ProductModal";
import useReasoningStream from "../hooks/useReasoningStream";
import ReasoningPanel from "./ReasoningPanel";

const RECOMMEND_REGEX = /\[RECOMMEND:(.+?)\]\s*$/;
const ORDER_PLACED_REGEX = /\[ORDER_PLACED:(.+?)\]\s*$/;

function parseRecommendation(text) {
  const orderMatch = text.match(ORDER_PLACED_REGEX);
  if (orderMatch) {
    const [productName] = orderMatch[1].split("|");
    const product = products.find(
      (p) => p.name.toLowerCase() === productName.trim().toLowerCase()
    );
    const displayText = text.replace(ORDER_PLACED_REGEX, "").trim();
    return { displayText, product: product || null, orderPlaced: true };
  }

  const match = text.match(RECOMMEND_REGEX);
  if (!match) return { displayText: text, product: null };

  const productName = match[1].trim();
  const product = products.find(
    (p) => p.name.toLowerCase() === productName.toLowerCase()
  );
  const displayText = text.replace(RECOMMEND_REGEX, "").trim();
  return { displayText, product: product || null };
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Welcome to SoleMate! 👋 How can we help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendedProduct, setRecommendedProduct] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [reasoningId, setReasoningId] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);
  const messagesEndRef = useRef(null);
  const ldClient = useLDClient();
  const { isOpen: cartIsOpen } = useCart();
  const { events: reasoningEvents } = useReasoningStream(reasoningId);

  useEffect(() => {
    if (cartIsOpen) setIsOpen(false);
  }, [cartIsOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen && !modalProduct) setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, modalProduct]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setRecommendedProduct(null);

    const newReasoningId = crypto.randomUUID();
    setReasoningId(newReasoningId);

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const currentContext = ldClient?.getContext();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          userKey: currentContext?.key || "solemate-anonymous",
          reasoningId: newReasoningId,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();

      const rawReply = data.reply || "Sorry, I couldn't process that. Please try again.";

      if (data.escalated && data.blockedReply) {
        const { displayText: blockedText } = parseRecommendation(data.blockedReply);
        const { displayText, product } = parseRecommendation(rawReply);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: blockedText, blocked: true },
          { role: "assistant", content: displayText },
        ]);
        setRecommendedProduct(product);
      } else if (data.pendingApproval) {
        setMessages((prev) => [...prev, { role: "assistant", content: rawReply }]);
        setPendingApproval({ ...data.pendingApproval, reasoningId: data.reasoningId });
      } else {
        const { displayText, product } = parseRecommendation(rawReply);
        setMessages((prev) => [...prev, { role: "assistant", content: displayText }]);
        setRecommendedProduct(product);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Oops — something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    setLoading(true);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasoningId: pendingApproval.reasoningId, approved: true }),
      });
      const data = await res.json();
      if (data.confirmed) {
        const replyText = data.reply || `Order ${data.orderId || ""} placed!`;
        const { displayText, product } = parseRecommendation(replyText);
        setMessages((prev) => [...prev, { role: "assistant", content: displayText }]);
        setRecommendedProduct(product);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong placing the order. Please try again." },
      ]);
    } finally {
      setPendingApproval(null);
      setLoading(false);
    }
  }

  async function handleDecline() {
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasoningId: pendingApproval.reasoningId, approved: false }),
    });
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "No problem, I've cancelled that for you." },
    ]);
    setPendingApproval(null);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Product Modal */}
      {modalProduct && (
        <ProductModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
        />
      )}

      {/* Reasoning Panel */}
      <ReasoningPanel
        events={reasoningEvents}
        isOpen={isPanelOpen && isOpen}
        onClose={() => setIsPanelOpen(false)}
      />

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 bg-white border border-neutral-200 shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "34rem" }}
        >
          {/* Header */}
          <div className="bg-black px-5 py-4 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-widest">
                SoleMate Chat
              </h3>
              <p className="text-neutral-400 text-xs mt-0.5">Powered by Claude</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPanelOpen((p) => !p)}
                className={`text-xs uppercase tracking-wider transition-colors ${
                  isPanelOpen ? "text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Reasoning
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 hover:text-white transition-colors"
                aria-label="Close chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div className={`w-7 h-7 flex items-center justify-center shrink-0 ${msg.blocked ? "bg-red-400" : "bg-sole-red"}`}>
                    <span className="text-white text-[10px] font-bold">SM</span>
                  </div>
                )}
                <div>
                  {msg.blocked && (
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase text-red-500">
                      Blocked by scope guardrail
                    </div>
                  )}
                  <div
                    className={`px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] ${
                      msg.blocked
                        ? "bg-red-50 text-neutral-400 line-through"
                        : msg.role === "user"
                          ? "bg-black text-white"
                          : "bg-neutral-100 text-black"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

            {/* Approval Card */}
            {pendingApproval && !loading && (
              <div className="mx-0 border-2 border-amber-400 bg-amber-50 p-3 text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <p className="font-bold text-xs uppercase tracking-wider text-amber-600">
                    Awaiting Your Approval
                  </p>
                </div>
                {pendingApproval.facts && (
                  <div className="bg-white border border-amber-200 p-2 space-y-1 text-xs">
                    {pendingApproval.facts.stock && (
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Stock</span>
                        <span className={pendingApproval.facts.stock.status === 'ok' ? 'text-green-600' : 'text-red-500'}>
                          {pendingApproval.facts.stock.status === 'ok' ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                    )}
                    {pendingApproval.facts.payment && (
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Payment</span>
                        <span className={pendingApproval.facts.payment.status === 'ok' ? 'text-green-600' : 'text-red-500'}>
                          {pendingApproval.facts.payment.status === 'ok' ? 'Verified' : 'Failed'}
                        </span>
                      </div>
                    )}
                    {pendingApproval.plan && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Product</span>
                          <span className="font-medium">{pendingApproval.plan.parameters?.product || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Qty</span>
                          <span className="font-medium">{pendingApproval.plan.quantity || 1}</span>
                        </div>
                        {pendingApproval.facts.stock?.totalPrice && (
                          <div className="flex justify-between border-t border-amber-200 pt-1 mt-1">
                            <span className="text-neutral-500 font-medium">Total</span>
                            <span className="font-bold">${pendingApproval.facts.stock.totalPrice.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {!pendingApproval.facts && (
                  <p className="text-neutral-700">{pendingApproval.orderSummary}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    className="flex-1 bg-green-600 text-white py-1.5 text-xs font-bold uppercase hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={handleDecline}
                    className="flex-1 bg-red-600 text-white py-1.5 text-xs font-bold uppercase hover:bg-red-700 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 bg-sole-red flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] font-bold">SM</span>
                </div>
                <div className="bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-400">
                  Typing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Recommended Product Card */}
          {recommendedProduct && !loading && (
            <div className="shrink-0 px-3 py-3 border-t">
              <div className="ai-border-glow">
                <button
                  onClick={() => setModalProduct(recommendedProduct)}
                  className="relative z-10 bg-white px-4 py-3 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left w-full"
                >
                  <img
                    src={recommendedProduct.image}
                    alt={recommendedProduct.name}
                    className="w-12 h-12 object-cover bg-neutral-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 mb-0.5">AI Pick</p>
                    <p className="text-sm font-bold uppercase truncate">{recommendedProduct.name}</p>
                    <p className="text-xs text-neutral-500">${recommendedProduct.price.toFixed(2)}</p>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-500 shrink-0">
                    View &rarr;
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t px-3 py-3 flex gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={loading || !!pendingApproval}
              className="flex-1 border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={loading || !!pendingApproval || !input.trim()}
              className={`px-4 py-2 font-bold uppercase text-xs tracking-wider transition-colors ${
                loading || !!pendingApproval || !input.trim()
                  ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                  : "bg-black text-white hover:bg-sole-red"
              }`}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-black text-white pl-5 pr-6 py-4 shadow-xl hover:bg-sole-red transition-colors group"
        aria-label="Toggle chat"
      >
        {isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-7 h-7"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-7 h-7"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
            />
          </svg>
        )}
        <span className="font-bold text-sm uppercase tracking-widest">
          {isOpen ? "Close" : "Chat"}
        </span>
      </button>
    </>
  );
}
