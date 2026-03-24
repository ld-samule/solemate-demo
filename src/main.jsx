import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { asyncWithLDProvider } from "launchdarkly-react-client-sdk";
import App from "./App";
import "./index.css";

const clientSideID = import.meta.env.VITE_LAUNCHDARKLY_CLIENT_ID;

(async () => {
  const LDProvider = await asyncWithLDProvider({
    clientSideID,
    context: {
      kind: "user",
      key: "solemate-demo-user",
      name: "Demo User",
      email: "demo@solemate.com",
    },
  });

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <LDProvider>
        <App />
      </LDProvider>
    </StrictMode>
  );
})();
