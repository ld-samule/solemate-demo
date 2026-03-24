import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import SettingsPanel from "./SettingsPanel";

export default function Navbar() {
  const { setIsOpen, totalItems } = useCart();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {/* Top utility bar */}
      <div className="bg-neutral-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-9">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 text-neutral-600 hover:text-black transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider">
              LD Context
            </span>
          </button>
          <div className="text-xs text-neutral-500 font-medium">
            Free Shipping on Orders $150+
          </div>
        </div>
      </div>

      {/* Main navbar */}
      <nav className="bg-black sticky top-9 z-40">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/" className="font-display text-white text-3xl tracking-wider">
            SOLEMATE
          </Link>

          <div className="flex items-center gap-8">
            <button
              onClick={() => {
                const el = document.getElementById("featured");
                if (el) el.scrollIntoView({ behavior: "smooth" });
                else window.location.href = "/";
              }}
              className="text-white text-sm font-semibold uppercase tracking-widest hover:text-sole-red transition-colors"
            >
              Shop
            </button>
            <button
              onClick={() => setIsOpen(true)}
              className="text-white relative"
              aria-label="Open cart"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-sole-red text-white text-xs font-bold w-5 h-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
