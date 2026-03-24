import { useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import ProductModal from "../components/ProductModal";
import products from "../data/products";

export default function Home() {
  const [selectedProduct, setSelectedProduct] = useState(null);

  return (
    <main>
      {/* Hero Banner */}
      <section className="relative bg-black text-white overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1556906781-9a412961c28c?w=1600&q=80"
            alt=""
            className="w-full h-full object-cover opacity-40"
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-32 md:py-48">
          <p className="text-sole-red font-bold uppercase text-sm tracking-[0.3em] mb-4">
            Just Dropped
          </p>
          <h1 className="font-display text-6xl md:text-8xl lg:text-9xl leading-none tracking-wide">
            MOVE FAST.
            <br />
            LOOK FASTER.
          </h1>
          <p className="mt-6 text-lg text-neutral-300 max-w-lg">
            Discover the latest in performance and style. Built for those who
            never stop.
          </p>
          <button
            onClick={() => document.getElementById("featured").scrollIntoView({ behavior: "smooth" })}
            className="inline-block mt-8 bg-white text-black px-10 py-4 font-bold uppercase text-sm tracking-widest hover:bg-sole-red hover:text-white transition-colors"
          >
            Shop Now
          </button>
        </div>
      </section>

      {/* Product Grid */}
      <section id="featured" className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="font-display text-4xl md:text-5xl tracking-wide mb-12">
          FEATURED SHOES
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={setSelectedProduct}
            />
          ))}
        </div>
      </section>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </main>
  );
}
