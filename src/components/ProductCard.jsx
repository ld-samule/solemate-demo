export default function ProductCard({ product, onClick }) {
  return (
    <button onClick={() => onClick(product)} className="group block text-left w-full">
      <div className="aspect-square overflow-hidden bg-neutral-100 border border-transparent group-hover:border-black transition-colors">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">
          {product.category}
        </p>
        <h3 className="text-base font-bold uppercase">{product.name}</h3>
        <p className="text-base font-semibold">${product.price.toFixed(2)}</p>
      </div>
    </button>
  );
}
