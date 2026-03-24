import { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";

const SIZES = [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13];

export default function ProductModal({ product, onClose }) {
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!product) return null;

  function handleAddToCart() {
    if (!selectedSize) return;
    addItem(product, selectedSize);
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      onClose();
    }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-white hover:bg-neutral-100 transition-colors"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Product Image */}
          <div className="aspect-square bg-neutral-100 overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Product Info */}
          <div className="p-8 flex flex-col justify-center">
            <p className="text-xs text-neutral-500 uppercase tracking-[0.3em] font-semibold">
              {product.category}
            </p>
            <h2 className="font-display text-4xl tracking-wide mt-2">
              {product.name.toUpperCase()}
            </h2>
            <p className="text-2xl font-bold mt-3">
              ${product.price.toFixed(2)}
            </p>
            <p className="text-neutral-600 mt-4 leading-relaxed text-sm">
              {product.description}
            </p>

            {/* Size Selector */}
            <div className="mt-6">
              <h3 className="font-bold text-sm uppercase tracking-widest mb-3">
                Select Size
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`py-2.5 text-sm font-semibold border transition-colors ${
                      selectedSize === size
                        ? "bg-black text-white border-black"
                        : "border-neutral-300 hover:border-black"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {!selectedSize && (
                <p className="text-xs text-neutral-400 mt-2">
                  Please select a size
                </p>
              )}
            </div>

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              disabled={!selectedSize}
              className={`mt-6 w-full py-4 font-bold uppercase text-sm tracking-widest transition-colors ${
                !selectedSize
                  ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                  : added
                    ? "bg-sole-red text-white"
                    : "bg-black text-white hover:bg-sole-red"
              }`}
            >
              {added ? "Added to Bag ✓" : "Add to Bag"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
