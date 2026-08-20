export const GRAPH_KEY = 'solemate-graph'
export const MAX_TURNS = 20
export const JUDGE_THRESHOLD = 0.5

// RNG failure rates — tune these before a live demo
export const OUT_OF_STOCK_RATE = 0.15
export const PAYMENT_FAILURE_RATE = 0.10
export const ORDER_PLACEMENT_FAILURE_RATE = 0.05
export const RETURN_WINDOW_EXPIRED_RATE = 0.20
export const REFUND_PROCESSING_FAILURE_RATE = 0.05
export const LOW_STOCK_WARN_RATE = 0.10

export const ORDER_STATUS_WEIGHTS = {
  processing: 0.30,
  shipped: 0.35,
  delivered: 0.25,
  delayed: 0.10,
}

export const PRODUCT_CATALOG = {
  'Air Phantom X': { price: 179.99, category: 'Men\'s Running Shoe' },
  'Sole Fury 90': { price: 149.99, category: 'Men\'s Lifestyle Shoe' },
  'Ultra Glide Pro': { price: 189.99, category: 'Women\'s Running Shoe' },
  'Street Apex Low': { price: 119.99, category: 'Unisex Lifestyle Shoe' },
  'Blaze Runner Elite': { price: 159.99, category: 'Men\'s Training Shoe' },
  'Cloud Nine Max': { price: 139.99, category: 'Women\'s Lifestyle Shoe' },
  'Velocity Pro 3': { price: 199.99, category: 'Men\'s Running Shoe' },
  'Heritage Dunk Mid': { price: 129.99, category: 'Unisex Lifestyle Shoe' },
}

export const FALLBACK_CONFIGS = {
  router: {
    enabled: true,
    model: { name: 'claude-sonnet-4-6', parameters: { max_tokens: 128 } },
    instructions: 'Classify as {"intent":"info"} or {"intent":"action"}. Respond with ONLY the JSON.',
  },
  chatbot: {
    enabled: true,
    model: { name: 'claude-sonnet-4-6', parameters: { max_tokens: 1024 } },
    messages: [{
      role: 'system',
      content: 'You are a friendly shopping assistant for SoleMate. Keep responses concise — 2-3 sentences max.',
    }],
  },
  orchestrator: {
    enabled: true,
    model: { name: 'claude-sonnet-4-6', parameters: { max_tokens: 512 } },
    instructions: 'Output a dispatch plan as JSON.',
  },
  researcher: {
    enabled: true,
    model: { name: 'claude-sonnet-4-6', parameters: { max_tokens: 512 } },
    instructions: 'Summarize research findings as JSON.',
  },
  reviewer: {
    enabled: true,
    model: { name: 'claude-sonnet-4-6', parameters: { max_tokens: 512 } },
    instructions: 'Evaluate and approve or decline.',
  },
  implementer: {
    enabled: true,
    model: { name: 'claude-sonnet-4-6', parameters: { max_tokens: 512 } },
    instructions: 'Execute the action and report the outcome.',
  },
  brandAgent: {
    enabled: true,
    model: { name: 'claude-sonnet-4-6', parameters: { max_tokens: 1024 } },
    messages: [{
      role: 'system',
      content: 'Rewrite the draft to match SoleMate brand voice. Return ONLY the rewritten response.',
    }],
  },
  judge: {
    enabled: true,
    model: { name: 'claude-sonnet-4-6' },
    messages: [{
      role: 'system',
      content:
        'Score 0.0–1.0 whether the assistant response stays strictly on-topic for SoleMate, ' +
        'a shoe store: shoes, footwear, sizing, orders, returns. Score 1.0 for fully on-topic ' +
        'and on-brand. Score near 0.0 if it answers off-domain questions (coding, general ' +
        'knowledge, other brands\' financials), is off-brand, rude, or unsafe. Return score ' +
        'and a one-sentence reasoning.',
    }],
  },
}
