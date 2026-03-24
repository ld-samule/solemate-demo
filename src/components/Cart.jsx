import { useState, useEffect } from "react";
import { useLDClient } from "launchdarkly-react-client-sdk";
import { useCart } from "../context/CartContext";

export default function Cart() {
  const { items, isOpen, setIsOpen, updateQuantity, removeItem, subtotal, clearCart } =
    useCart();
  const ldClient = useLDClient();
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        if (confirmation !== null) {
          setConfirmation(null);
          setIsOpen(false);
        } else if (isOpen) {
          setIsOpen(false);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, confirmation, setIsOpen]);

  function handleCheckout() {
    if (ldClient) {
      ldClient.track("SoleMate-Purchases", undefined, subtotal);
      ldClient.flush();
    }
    setConfirmation(subtotal);
    clearCart();
  }

  function closeConfirmation() {
    setConfirmation(null);
    setIsOpen(false);
  }

  return (
    <>
      {/* Confirmation Popup */}
      {confirmation !== null && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-10 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-14 h-14 mx-auto text-sole-red mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <h2 className="font-display text-3xl tracking-wide mb-2">THANK YOU!</h2>
            <p className="text-neutral-600 mb-1">Your total was</p>
            <p className="text-3xl font-bold">${confirmation.toFixed(2)}</p>
            <p className="text-neutral-500 text-sm mt-3">
              Thanks for purchasing with SoleMate.
            </p>
            <button
              onClick={closeConfirmation}
              className="mt-8 w-full bg-black text-white py-4 font-bold uppercase text-sm tracking-widest hover:bg-sole-red transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {isOpen && !confirmation && (
        <div
          className="fixed inset-0 bg-black/40 z-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-5 border-b">
            <h2 className="font-display text-2xl tracking-wide">YOUR BAG</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-black hover:text-sole-red transition-colors"
              aria-label="Close cart"
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

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <p className="text-neutral-500 text-sm mt-8 text-center">
                Your bag is empty.
              </p>
            ) : (
              <div className="space-y-6">
                {items.map((item) => (
                  <div
                    key={`${item.product.id}-${item.size}`}
                    className="flex gap-4"
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-24 h-24 object-cover bg-neutral-100"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm uppercase truncate">
                        {item.product.name}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Size: US {item.size}
                      </p>
                      <p className="text-sm font-semibold mt-1">
                        ${item.product.price.toFixed(2)}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              item.size,
                              item.quantity - 1
                            )
                          }
                          className="w-7 h-7 border border-black flex items-center justify-center text-sm font-bold hover:bg-black hover:text-white transition-colors"
                        >
                          −
                        </button>
                        <span className="text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              item.size,
                              item.quantity + 1
                            )
                          }
                          className="w-7 h-7 border border-black flex items-center justify-center text-sm font-bold hover:bg-black hover:text-white transition-colors"
                        >
                          +
                        </button>
                        <button
                          onClick={() =>
                            removeItem(item.product.id, item.size)
                          }
                          className="ml-auto text-xs text-neutral-400 hover:text-sole-red uppercase tracking-wider"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t px-6 py-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase text-sm">Subtotal</span>
                <span className="font-bold text-lg">
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              <button
                onClick={handleCheckout}
                className="block w-full bg-black text-white text-center py-4 font-bold uppercase text-sm tracking-widest hover:bg-sole-red transition-colors"
              >
                Proceed to Checkout
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
