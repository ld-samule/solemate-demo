import { useState, useEffect, useRef } from "react";
import { useLDClient } from "launchdarkly-react-client-sdk";
import { useCart } from "../context/CartContext";
import products from "../data/products";
import ProductModal from "./ProductModal";

const FALLBACK_SYSTEM_PROMPT = `You are a friendly, knowledgeable shopping assistant for SoleMate, a premium online shoe store. Your tone is warm, confident, and helpful.

Product catalog:
${products.map((p) => `- ${p.name} (${p.category}) — $${p.price.toFixed(2)}`).join("\n")}

Guidelines:
- Keep responses concise — 2-3 sentences max
- When the user asks about shoes, needs, or preferences, recommend exactly 1 shoe from the catalog above
- Pick a shoe that best matches the user's needs. If no clear match, pick one randomly.
- We carry US sizes 7-13. Free shipping on orders over $150.
- Be enthusiastic but not pushy
- If asked about topics unrelated to shoes or SoleMate, politely redirect

CRITICAL: When you recommend a product, you MUST append this exact marker at the very end of your response on its own line:
[RECOMMEND:Exact Product Name]

For example if you recommend the Air Phantom X, end your response with:
[RECOMMEND:Air Phantom X]

Only include the marker when you are actively recommending a product. Use the exact product name from the catalog.`;

const FALLBACK_MODEL = "claude-sonnet-4-20250514";
const RECOMMEND_REGEX = /\[RECOMMEND:(.+?)\]\s*$/;

function parseRecommendation(text) {
  const match = text.match(RECOMMEND_REGEX);
  if (!match) return { displayText: text, product: null };

  const productName = match[1].trim();
  const product = products.find(
    (p) => p.name.toLowerCase() === productName.toLowerCase()
  );
  const displayText = text.replace(RECOMMEND_REGEX, "").trim();
  return { displayText, product: product || null };
}

function useAIConfig() {
  const ldClient = useLDClient();
  const [config, setConfig] = useState({
    systemPrompt: FALLBACK_SYSTEM_PROMPT,
    model: FALLBACK_MODEL,
    variationKey: null,
  });

  useEffect(() => {
    if (!ldClient) return;

    function updateConfig() {
      const aiConfig = ldClient.variation("solemate-chatbot", null);
      console.log("[SoleMate Debug] solemate-chatbot variation:", JSON.stringify(aiConfig, null, 2));
      if (aiConfig && aiConfig.messages) {
        const systemMsg = aiConfig.messages.find((m) => m.role === "system");
        const prompt = systemMsg?.content || FALLBACK_SYSTEM_PROMPT;
        console.log("[SoleMate Debug] Active system prompt:", prompt.substring(0, 120) + "...");
        const modelKey = aiConfig.model?.name || aiConfig.modelConfigKey || "";
        const model = modelKey.includes(".") ? modelKey.split(".").slice(1).join(".") : (modelKey || FALLBACK_MODEL);
        const variationKey = aiConfig._ldMeta?.variationKey || null;
        console.log("[SoleMate Debug] Variation key:", variationKey);
        setConfig({ systemPrompt: prompt, model, variationKey });
      } else {
        console.warn("[SoleMate Debug] No AI config from LD — using FALLBACK prompt (which includes recommendations)");
      }
    }

    updateConfig();
    ldClient.on("change", updateConfig);
    return () => ldClient.off("change", updateConfig);
  }, [ldClient]);

  return config;
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
  const messagesEndRef = useRef(null);
  const triggerFiredRef = useRef(false);
  const { systemPrompt, model, variationKey } = useAIConfig();
  const { isOpen: cartIsOpen } = useCart();

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

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      const rawReply = data.content?.[0]?.text || "Sorry, I couldn't process that. Please try again.";
      const { displayText, product } = parseRecommendation(rawReply);

      setMessages((prev) => [...prev, { role: "assistant", content: displayText }]);
      setRecommendedProduct(product);

      if (variationKey === "linked-in-transformer" && !triggerFiredRef.current) {
        triggerFiredRef.current = true;
        console.log("[SoleMate Debug] Joke variation detected — firing LD trigger in 5s");
        setTimeout(() => {
          fetch("/api/trigger", { method: "POST" })
            .then((r) => console.log("[SoleMate Debug] LD trigger response:", r.status))
            .catch((err) => console.error("[SoleMate Debug] LD trigger failed:", err));
        }, 5000);
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

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 bg-sole-red flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-bold">SM</span>
                  </div>
                )}
                <div
                  className={`px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-black text-white"
                      : "bg-neutral-100 text-black"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
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
              disabled={loading}
              className="flex-1 border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className={`px-4 py-2 font-bold uppercase text-xs tracking-wider transition-colors ${
                loading || !input.trim()
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
