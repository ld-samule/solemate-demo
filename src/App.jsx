import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useFlags } from "launchdarkly-react-client-sdk";
import { CartProvider } from "./context/CartContext";
import Navbar from "./components/Navbar";
import Cart from "./components/Cart";
import Chatbot from "./components/Chatbot";
import Home from "./pages/Home";
import Checkout from "./pages/Checkout";

export default function App() {
  const flags = useFlags();
  const showChatbot = flags.showChatbot ?? false;

  return (
    <BrowserRouter>
      <CartProvider>
        <Navbar />
        <Cart />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/checkout" element={<Checkout />} />
        </Routes>
        {showChatbot && <Chatbot />}
      </CartProvider>
    </BrowserRouter>
  );
}
