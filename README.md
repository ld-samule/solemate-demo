# SoleMate

A premium shoe store built with React + Vite, demonstrating feature flags,
AI-powered experiences, and experimentation using the LaunchDarkly
[React SDK](https://docs.launchdarkly.com/sdk/client-side/react/react-web) and
[Node.js AI SDK](https://docs.launchdarkly.com/sdk/ai/node-js).

---

## What This App Demonstrates

- A fully functional shoe store with product listing, product detail modals, shopping cart, and checkout
- A **[feature flag](https://docs.launchdarkly.com/home/flags)** controlling the visibility of an AI chatbot widget
- An **[AI Config](https://docs.launchdarkly.com/home/ai-configs)** (`solemate-chatbot`) that manages the chatbot's system prompt and model — evaluated server-side using the official [Node.js AI SDK](https://docs.launchdarkly.com/sdk/ai/node-js) with full **[metric tracking](https://docs.launchdarkly.com/sdk/features/ai-metrics)** (tokens, latency, success/error)
- A **[flag trigger](https://docs.launchdarkly.com/home/flags/triggers)** that automatically turns off a flag variation after the AI responds
- A **[conversion experiment](https://docs.launchdarkly.com/home/experimentation)** measuring whether the chatbot drives more purchases
- A **150-user context simulator** built into the UI to generate experiment data at scale

---

## Assumptions About Your Environment

Before you begin, this guide assumes:

- You have **Node.js v18 or higher** installed. Check with `node -v`
- You have **npm v9 or higher** installed. Check with `npm -v`
- You have a **LaunchDarkly account**. Sign up free at https://launchdarkly.com/start-trial/
- You have an **Anthropic API key** for the Claude-powered chatbot. Get one at https://console.anthropic.com/
- You are using a **Unix-based terminal** (Mac/Linux) or **Windows with Git Bash**

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/ld-samule/solemate-demo.git
cd solemate-demo
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Your Environment Variables

Create a `.env` file in the project root:

```bash
touch .env
```

Paste the following into `.env` and replace each placeholder with your real values:

```
VITE_LAUNCHDARKLY_CLIENT_ID=your-client-side-id-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here
LD_SERVER_SDK_KEY=your-server-side-sdk-key-here
LD_TRIGGER_URL=your-launchdarkly-trigger-url-here
```

| Variable | Where to find it |
|---|---|
| `VITE_LAUNCHDARKLY_CLIENT_ID` | LaunchDarkly → **Projects** → your project → **Environments** → copy the **Client-side ID** (not the SDK key) |
| `ANTHROPIC_API_KEY` | Anthropic Console → **API Keys** → create or copy a key |
| `LD_SERVER_SDK_KEY` | LaunchDarkly → **Projects** → your project → **Environments** → copy the **SDK key** (the server-side one, not the Client-side ID) |
| `LD_TRIGGER_URL` | LaunchDarkly → **Feature Flags** → your flag → 3 dots on environment → configuration in environment → **Triggers** tab → Add Trigger → copy the webhook URL (single-use; replace after each firing) |

> **Note:** `ANTHROPIC_API_KEY`, `LD_SERVER_SDK_KEY`, and `LD_TRIGGER_URL` are server-side only (no `VITE_` prefix).
> They are used by the Vite dev server backend and never sent to the browser.

---

### 4. Create Feature Flags in LaunchDarkly

You need to create the following flags in your LaunchDarkly project.

> The flag keys must match exactly as shown below, including casing and hyphens.

#### `show-chatbot` (Boolean)

| Property | Value |
|---|---|
| **Key** | `show-chatbot` |
| **Type** | Boolean |
| **Default** | `false` |
| **Description** | Shows the SoleMate Assistant chatbot widget. Used as the experiment flag for purchase conversion. |

**How to create:**
1. Go to **Feature Flags** → **Create flag**
2. Enter the key `show-chatbot`, select Boolean type
3. Set variations: `true` / `false`, default `false`
4. Save and toggle it **on** to see the chatbot
5. Ensure the flag has **client-side SDK availability** enabled. [Docs](https://docs.launchdarkly.com/home/flags/proj-flag-settings#client-side-availability)

#### `solemate-chatbot` (AI Config)

| Property | Value |
|---|---|
| **Key** | `solemate-chatbot` |
| **Type** | AI Config |
| **Mode** | Completion |
| **Description** | Controls the chatbot's system prompt and model. Variations let you swap the chatbot personality live. |

**How to create** ([AI Config docs](https://docs.launchdarkly.com/home/ai-configs/create)):
1. Go to **AI Config** → **Create AI Config** → select **Completion** as the mode
2. Set the name to `solemate-chatbot`
3. Hit Create
4. Create the three [variations](https://docs.launchdarkly.com/home/ai-configs/create-variation) below
5. Save and toggle on

##### Variation 1: Key: `default` —  Name: "With Recommendations"

| Setting | Value |
|---|---|
| **Variation key** | `default` |
| **Variation name** | With Recommendations |
| **Provider** | Anthropic |
| **Model** | `claude-sonnet-4-20250514` or any Claude Model |

Add Message -> **System prompt:**

```
You are a friendly, knowledgeable shopping assistant for SoleMate, a premium online shoe store. Your tone is warm, confident, and helpful.

Product catalog:
- Air Phantom X (Men's Running Shoe) — $179.99
- Sole Fury 90 (Men's Lifestyle Shoe) — $149.99
- Ultra Glide Pro (Women's Running Shoe) — $189.99
- Street Apex Low (Unisex Lifestyle Shoe) — $119.99
- Blaze Runner Elite (Men's Training Shoe) — $159.99
- Cloud Nine Max (Women's Lifestyle Shoe) — $139.99
- Velocity Pro 3 (Men's Running Shoe) — $199.99
- Heritage Dunk Mid (Unisex Lifestyle Shoe) — $129.99

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

Only include the marker when you are actively recommending a product. Use the exact product name from the catalog.
```

This is the primary variation. The `[RECOMMEND:...]` marker is parsed by the app to render a clickable product card below the chat response.

##### Variation 2: `no-recommendations` — "No Recommendations"

| Setting | Value |
|---|---|
| **Variation key** | `no-recommendations` |
| **Variation name** | No Recommendations |
| **Provider** | Anthropic |
| **Model** | `claude-sonnet-4-20250514` or any Claude Model |

Add Message -> **System prompt:**

```
You are a friendly, knowledgeable shoe expert for SoleMate, a premium online shoe store. Your tone is warm, confident, and helpful.

Guidelines:
- Keep responses concise — 2-3 sentences max
- Answer questions about shoes in general: materials, fit, care, running form, shoe types, styling tips, etc.
- Do NOT recommend or mention any specific SoleMate products by name
- Do NOT suggest particular shoes to buy
- Focus on being educational and helpful about footwear in general
- We carry US sizes 7-13. Free shipping on orders over $150.
- If asked about topics unrelated to shoes, politely redirect
```

This variation turns the chatbot into a general shoe expert that never recommends specific products. Useful for A/B testing whether product recommendations drive more purchases.

##### Variation 3: Key: `linked-in-transformer` — Name: "joke"

| Setting | Value |
|---|---|
| **Variation key** | `linked-in-transformer` |
| **Variation name** | joke |
| **Provider** | Anthropic |
| **Model** | `claude-sonnet-4-5` or any Claude model |

**System prompt:**

```
Im using this prompt for testing. Answer the customer with a joke in spainish and then answer their question.
```

This is a demo/prank variation that makes the chatbot respond with a joke in Spanish before answering. When this variation is active and the user sends a message, the app automatically fires the `LD_TRIGGER_URL` after 5 seconds to turn the flag off — reverting the chatbot to normal. See [Set Up a Flag Trigger](#5-set-up-a-flag-trigger-optional) for details.

---

### 5. Set Up a Flag Trigger (Optional)

The app can automatically turn off a flag variation after the chatbot responds. This is useful for demos where you want to briefly show a "prank" variation, then have it revert.

1. In LaunchDarkly, go to your flag → 3 Dots on environment → Confirugation in environment →  **Triggers** tab → Add trigger
2. Create a trigger that turns off the flag
3. Copy the webhook URL and paste it into `LD_TRIGGER_URL` in your `.env`
4. Restart the dev server

When the chatbot generates a response while the `linked-in-transformer` variation is active, the app waits 5 seconds, then POSTs to the trigger URL. The trigger URL is single-use — replace it in `.env` after each firing.

---

### 6. Set Up the Experiment (This step can be done in the demo flow)

#### Create the Metric

Before creating the experiment, you need a metric to measure conversions.

1. In LaunchDarkly, go to **Iterate** → **Metrics** → **Create metric**
2. Fill in the following:

| Setting | Value |
|---|---|
| **Event kind** | Custom |
| **Event key** | `SoleMate-Purchases` |
| **What do you want to measure?** | Count |
| **Metric definition** | Average of event count per user where higher is better |
| **Metric name** | SoleMate Purchases |
| **Metric key** | `solemate-purchases` |
| **Description** | Tracks purchase events fired from the cart checkout and the 150-user simulator |

3. Click **Create metric**

> The event key `SoleMate-Purchases` must match exactly — this is the key the app passes to `ldClient.track()` when a user checks out or during the 150-user simulation.

#### Create the Experiment

1. Go to **Experiments** → **Create experiment**
2. Name it something like `Chatbot Purchase Conversion`
3. Set the **hypothesis:** Users who see the chatbot will purchase more often
4. Create Experiment
5. Add the **SoleMate Purchases** metric you just created
6. Attach the **`show-chatbot`** flag as the experiment flag
7. Set the rollout to **50/50** between `true` and `false`
8. Add the **SoleMate Purchases** metric you just created
9. Save and Start the experiment. You may need to turn the flag on before starting experiment.

**To generate experiment data:**
1. Run the app locally
2. Click the **gear icon** in the top nav to open the LD Context panel
3. Click **"Simulate 150 Users"**
4. The app sends 150 unique user contexts to LaunchDarkly, evaluates `show-chatbot` for each, and fires `SoleMate-Purchases` events accordingly
5. Return to your experiment in LaunchDarkly to view results — you need a minimum of 100 exposures per variation for statistical significance
6. It may take up to 10 mins from when events are pushed until data is shown in the platform.

---

### 7. Run the App

```bash
npm run dev
```

Open your browser to **http://localhost:5173**

---


## Feature Flag Reference

| Flag | Type | Evaluated where | What it does |
|---|---|---|---|
| `show-chatbot` | Boolean | Client ([React SDK](https://docs.launchdarkly.com/sdk/client-side/react/react-web)) | Toggles the SoleMate Assistant chat widget |
| `solemate-chatbot` | [AI Config](https://docs.launchdarkly.com/home/ai-configs) | Server ([Node.js AI SDK](https://docs.launchdarkly.com/sdk/ai/node-js)) | Controls the chatbot's system prompt, model, and personality — with metric tracking |

`show-chatbot` responds in real time on the client via the React SDK's streaming connection. `solemate-chatbot` is evaluated fresh on the server with every chat request via `completionConfig()`, so switching variations in LaunchDarkly takes effect on the next message sent.

---

## Use Cases
---

1. Release & Remediate

Users can turn features on/off in run time without a page reload. In the demo users can turn flag show-chatbot on/off. For remdiate, if the user uses the joke prompt a trigger will automatically turn the chatbot functionality off. Simulating how users can quickly remediate unintended responses from AI.

2. Target

Users can create custom rules in the flag show-chatbot to target users or groups for specific features. Example could be new rules and regulations in place that require explicit permission to use AI functionality. Users can use LD to target regions without those laws/regulations. 

3. AI Configs

Users can use AI config flag solemate-chatbot to modify and measure prompts in runtime. The different variations show how users can operationalize AI to have an impact on metrics that matter. In this case, we implemented a normal chat bot with the default variation that can be helpful in answering questions about products. The recommendation variation takes this a step further and recommends specific items to users and makes it easier to buy. The Joke variation simulates the non-deterministic nature of flags and how LD can quickly remediate. 

4. Experimentation

Users can use the AI configs flag solemate-chatbot and run an experiment on users in a specific location to understand if the recommend prompt actually increases conversions. Experimentation provides the hard metrics to show how AI can have an impact on business metrics. 

5. Integrations

With the MCP server, users can pick the winning variation from the experiment and remove the feature flags to make it permanent. Making it easy to create/remove feature flags after the use case has been proven. 

6. Platform

LD is the only platform that allows for self-healing and self-optimizing software. 


---
## AI Config Supported implementation vs MCP solution

AI Config flags under the hood are regular LaunchDarkly flags with sctructed JSON values. So ldClient.variation("solemate-chatbot", null) — the same call you'd use for any feature flag — returns the raw JSON for whichever variation is active.

When I used cursor and the LD MCP to implement AI configs it used the under the hood feature flag to make the AI functionality work. 

The App was essentially treating the AI Config as a structured JSON flag and parsing it by hand.

What you lose vs. the official server-side AI SDK
No completionConfig() helper — the official SDK handles evaluation, context substitution (the {{ ldctx.name }} template syntax), and fallback logic in one call.

No built-in AI tracking — the server-side AI SDK includes a tracker that records token usage, latency, and generation metrics back to LD

No prompt templating — if your prompt uses {{ ldctx.city }} or {{ customVar }}, the client SDK won't substitute those; you'd have to do it yourself.

The previous implementation works but recreates the AI config functionlality using the Feature flag underneath but doesnt incorporate the specialized features that are built in using the AI SDK for AI configs. 


---
## Architecture

### Server-Side AI Config Evaluation

The chatbot uses the [LaunchDarkly Node.js AI SDK](https://docs.launchdarkly.com/sdk/ai/node-js) on the server side, following the official best-practice pattern. This runs inside Vite's dev server middleware (`vite.config.js`).

**How a chat request flows:**

1. The React frontend sends `{ messages, userKey }` to `POST /api/chat`
2. The server builds an [LD context](https://docs.launchdarkly.com/home/getting-started/vocabulary#context) from the user key
3. [`completionConfig()`](https://docs.launchdarkly.com/sdk/features/ai-config#nodejs-server-side-ai) evaluates the `solemate-chatbot` AI Config for that context, returning the system prompt, model, and a [tracker](https://docs.launchdarkly.com/sdk/features/ai-metrics#nodejs-server-side-ai)
4. If the config is disabled, a graceful fallback message is returned
5. The server calls the Anthropic API with the prompt and model from the AI Config
6. The tracker records token usage, latency, and success/error back to LaunchDarkly
7. If the active variation is `linked-in-transformer`, the server fires the [flag trigger](https://docs.launchdarkly.com/home/flags/triggers) after 5 seconds
8. The reply text is returned to the frontend

The frontend has **no knowledge** of prompts, models, or AI Config variations — it just sends messages and displays replies.

### API Endpoints

| Endpoint | What it does |
|---|---|
| `POST /api/chat` | Evaluates the AI Config, calls Claude, tracks metrics, returns `{ reply }` |
| `POST /api/trigger` | Fires the `LD_TRIGGER_URL` webhook (also triggered automatically by `/api/chat` for the joke variation) |

### SDK Usage

| SDK | Used where | Purpose | Docs |
|---|---|---|---|
| `launchdarkly-react-client-sdk` | React frontend (`main.jsx`, `App.jsx`, `SettingsPanel.jsx`) | Feature flags, context management, experiment events | [React SDK](https://docs.launchdarkly.com/sdk/client-side/react/react-web) |
| `@launchdarkly/node-server-sdk` | Vite server middleware (`vite.config.js`) | Server-side flag evaluation for AI Configs | [Node.js SDK](https://docs.launchdarkly.com/sdk/server-side/node-js) |
| `@launchdarkly/server-sdk-ai` | Vite server middleware (`vite.config.js`) | `completionConfig()` + metric tracking | [Node.js AI SDK](https://docs.launchdarkly.com/sdk/ai/node-js) |

---

## Project Structure

```
src/
  components/
    Navbar.jsx            # Top navigation bar with LD Context panel toggle
    ProductCard.jsx       # Individual product card used in the listing grid
    ProductModal.jsx      # Full-screen product detail overlay with size selector and add-to-cart
    Cart.jsx              # Slide-out cart drawer with checkout
    Chatbot.jsx           # AI chatbot widget — sends messages to /api/chat, displays replies
    SettingsPanel.jsx     # LD Context editor and 150-user experiment simulator
  pages/
    Home.jsx              # Product listing page with hero banner
    Checkout.jsx          # Checkout form with order summary
  context/
    CartContext.jsx        # Global cart state using React Context
  data/
    products.js            # Hardcoded product data (8 shoes)
  App.jsx                  # Root component with flag-gated chatbot
  main.jsx                 # Vite entry point, initializes LaunchDarkly provider
  index.css                # Global styles and Tailwind imports
vite.config.js             # Vite config + server backend (LD AI SDK, Anthropic proxy, trigger)
```

---

## Troubleshooting

**Flags aren't changing anything in the UI**
- Double-check your SDK key in `.env` is the **Client-side ID**, not the server-side SDK key
- Make sure flag keys in LaunchDarkly exactly match the keys listed above
- Make sure the flag is **enabled** (toggled on) in your LaunchDarkly environment

**Chatbot doesn't respond**
- Check that `ANTHROPIC_API_KEY` is set in `.env` and is a valid key
- Check that `LD_SERVER_SDK_KEY` is set — without it the server falls back to a minimal config. Look for `[LD Server] AI SDK initialized` in the terminal where Vite is running
- Open the browser console and look for errors on the `/api/chat` request
- Make sure `show-chatbot` is toggled **on** so the widget appears

**AI Config variation isn't taking effect**
- The AI Config is evaluated server-side on each request — check the Vite terminal for `[LD Server]` logs
- Make sure `LD_SERVER_SDK_KEY` is the **server-side SDK key** (not the Client-side ID)
- Confirm the `solemate-chatbot` AI Config is toggled **on** in your LaunchDarkly environment

**LD trigger doesn't fire**
- Check the Vite terminal for `[LD Trigger] linked-in-transformer detected` — if you don't see it, the variation key may not match
- Make sure `LD_TRIGGER_URL` is set in `.env` and the dev server has been restarted since setting it
- Trigger URLs are single-use; generate a new one in LaunchDarkly after each firing

**`npm install` fails**
- Make sure you are running Node.js v18+. Use `nvm use 18` if you have nvm installed.

---

## Built With

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React Router](https://reactrouter.com/)
- [LaunchDarkly React SDK](https://docs.launchdarkly.com/sdk/client-side/react/react-web) — client-side feature flags and context management
- [LaunchDarkly Node.js Server SDK](https://docs.launchdarkly.com/sdk/server-side/node-js) — server-side flag evaluation
- [LaunchDarkly Node.js AI SDK](https://docs.launchdarkly.com/sdk/ai/node-js) — AI Config evaluation and metric tracking
- [Anthropic Claude API](https://docs.anthropic.com/en/docs/about-claude/models) — powers the chatbot
