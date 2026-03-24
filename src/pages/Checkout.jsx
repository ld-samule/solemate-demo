import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    address: "",
    city: "",
    zip: "",
  });
  const [orderPlaced, setOrderPlaced] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setOrderPlaced(true);
    clearCart();
  }

  if (orderPlaced) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="mb-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-16 h-16 mx-auto text-sole-red"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>
        <h1 className="font-display text-5xl tracking-wide mb-4">
          ORDER CONFIRMED
        </h1>
        <p className="text-neutral-600 text-lg mb-8">
          Thank you for your order. You'll receive a confirmation email shortly.
        </p>
        <Link
          to="/"
          className="inline-block bg-black text-white px-10 py-4 font-bold uppercase text-sm tracking-widest hover:bg-sole-red transition-colors"
        >
          Continue Shopping
        </Link>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-4xl tracking-wide mb-4">
          YOUR BAG IS EMPTY
        </h1>
        <Link
          to="/"
          className="text-sole-red font-bold uppercase text-sm tracking-widest"
        >
          Continue Shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-10">
        CHECKOUT
      </h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-5 gap-12"
      >
        {/* Form Fields */}
        <div className="lg:col-span-3">
          <h2 className="font-bold uppercase text-sm tracking-widest mb-6">
            Shipping Information
          </h2>
          <div className="grid gap-4 grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                required
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                required
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                Zip Code
              </label>
              <input
                type="text"
                name="zip"
                value={form.zip}
                onChange={handleChange}
                required
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-2">
          <div className="bg-neutral-50 p-6">
            <h2 className="font-bold uppercase text-sm tracking-widest mb-6">
              Order Summary
            </h2>
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={`${item.product.id}-${item.size}`}
                  className="flex justify-between items-start text-sm"
                >
                  <div>
                    <p className="font-semibold">{item.product.name}</p>
                    <p className="text-neutral-500 text-xs">
                      Size {item.size} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t mt-6 pt-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span>Shipping</span>
                <span className="font-semibold">FREE</span>
              </div>
              <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t">
                <span>Total</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <button
            type="submit"
            className="w-full mt-4 bg-black text-white py-4 font-bold uppercase text-sm tracking-widest hover:bg-sole-red transition-colors"
          >
            Place Order
          </button>
        </div>
      </form>
    </main>
  );
}
