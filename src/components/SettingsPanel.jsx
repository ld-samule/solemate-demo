import { useState, useEffect } from "react";
import { useLDClient } from "launchdarkly-react-client-sdk";
import products from "../data/products";

const REGIONS = [
  "us-east-1",
  "us-west-1",
  "af-south-1",
  "ap-east-1",
  "ap-west-1",
  "ap-northeast-1",
  "ap-southeast-1",
  "eu-central-1",
  "eu-west-1",
  "eu-south-1",
  "sa-east-1",
  "me-south-1",
];

export default function SettingsPanel({ isOpen, onClose }) {
  const ldClient = useLDClient();

  const [form, setForm] = useState({
    key: "solemate-demo-user",
    name: "Demo User",
    email: "demo@solemate.com",
    region: "us-east-1",
  });
  const [saved, setSaved] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [simDone, setSimDone] = useState(false);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSaved(false);
  }

  async function handleSave() {
    if (!ldClient) return;
    await ldClient.identify({
      kind: "user",
      key: form.key,
      name: form.name,
      email: form.email,
      region: form.region,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Avery", "Blake", "Drew"];
  const LAST_NAMES = ["Smith", "Lee", "Garcia", "Chen", "Patel", "Kim", "Nguyen", "Silva", "Ali", "Müller"];
  const TOTAL_USERS = 150;
  const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  function randomId() {
    let result = "";
    for (let i = 0; i < 7; i++) {
      result += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
    }
    return result;
  }

  async function handleSimulate() {
    if (!ldClient || simRunning) return;

    const originalContext = {
      kind: "user",
      key: form.key,
      name: form.name,
      email: form.email,
      region: form.region,
    };

    setSimRunning(true);
    setSimProgress(0);
    setSimDone(false);

    for (let i = 1; i <= TOTAL_USERS; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];

      const uid = randomId();
      const userContext = {
        kind: "user",
        key: `sim-user-${uid}`,
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}-${uid}@example.com`,
        region,
      };

      await ldClient.identify(userContext);

      const flagValue = ldClient.variation("show-chatbot", false);

      const randomPurchaseValue = () => {
        const product = products[Math.floor(Math.random() * products.length)];
        const qty = Math.random() < 0.7 ? 1 : 2;
        return +(product.price * qty).toFixed(2);
      };

      if (flagValue === true) {
        ldClient.track("SoleMate-Purchases", undefined, randomPurchaseValue());
      } else {
        if (Math.random() < 0.5) {
          ldClient.track("SoleMate-Purchases", undefined, randomPurchaseValue());
        }
      }

      await ldClient.flush();
      setSimProgress(i);
    }

    await ldClient.identify(originalContext);
    setSimRunning(false);
    setSimDone(true);
    setTimeout(() => setSimDone(false), 3000);
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 left-0 h-full w-full max-w-sm bg-white z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-5 border-b">
            <h2 className="font-display text-2xl tracking-wide">LD CONTEXT</h2>
            <button
              onClick={onClose}
              className="text-black hover:text-sole-red transition-colors"
              aria-label="Close settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">
              Configure the LaunchDarkly user context
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                Key
              </label>
              <input
                type="text"
                name="key"
                value={form.key}
                onChange={handleChange}
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                Name
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                Region
              </label>
              <select
                name="region"
                value={form.region}
                onChange={handleChange}
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors bg-white appearance-none"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Simulation Section */}
            <div className="border-t pt-5 mt-2">
              <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold mb-4">
                User Simulation
              </p>

              {simRunning && (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
                      Sending user {simProgress} of {TOTAL_USERS}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-widest">
                      {Math.round((simProgress / TOTAL_USERS) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 h-2">
                    <div
                      className="bg-black h-2"
                      style={{ width: `${Math.round((simProgress / TOTAL_USERS) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {simDone && !simRunning && (
                <p className="text-sm font-bold text-green-600 mb-4">
                  ✓ {TOTAL_USERS} users sent to LaunchDarkly
                </p>
              )}

              <button
                onClick={handleSimulate}
                disabled={simRunning}
                className={`w-full py-4 font-bold uppercase text-sm tracking-widest transition-colors ${
                  simRunning
                    ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                    : "bg-black text-white hover:bg-sole-red"
                }`}
              >
                {simRunning ? "Simulating..." : `Simulate ${TOTAL_USERS} Users`}
              </button>
            </div>
          </div>

          <div className="border-t px-6 py-5">
            <button
              onClick={handleSave}
              className={`w-full py-4 font-bold uppercase text-sm tracking-widest transition-colors ${
                saved
                  ? "bg-sole-red text-white"
                  : "bg-black text-white hover:bg-sole-red"
              }`}
            >
              {saved ? "Context Updated ✓" : "Save & Identify"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
