import crypto from 'node:crypto'
import {
  OUT_OF_STOCK_RATE,
  PAYMENT_FAILURE_RATE,
  ORDER_PLACEMENT_FAILURE_RATE,
  RETURN_WINDOW_EXPIRED_RATE,
  REFUND_PROCESSING_FAILURE_RATE,
  LOW_STOCK_WARN_RATE,
  ORDER_STATUS_WEIGHTS,
  PRODUCT_CATALOG,
} from './constants.js'

function roll(rate) {
  return Math.random() < rate
}

function weightedPick(weights) {
  const entries = Object.entries(weights)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let r = Math.random() * total
  for (const [key, w] of entries) {
    r -= w
    if (r <= 0) return key
  }
  return entries[entries.length - 1][0]
}

export function simulateStockCheck(productName, quantity = 1) {
  const product = PRODUCT_CATALOG[productName]
  if (!product) {
    return { status: 'failed', detail: `Product "${productName}" not found in catalog.` }
  }
  if (roll(OUT_OF_STOCK_RATE)) {
    return { status: 'failed', detail: `${productName} is currently out of stock.` }
  }
  const unitsAvailable = Math.floor(Math.random() * 20) + quantity
  const warn = roll(LOW_STOCK_WARN_RATE)
  return {
    status: warn ? 'warning' : 'ok',
    detail: `${productName} — ${unitsAvailable} units available. Price: $${product.price}/ea.`,
    unitsAvailable,
    pricePerUnit: product.price,
    totalPrice: +(product.price * quantity).toFixed(2),
  }
}

export function simulatePaymentCheck() {
  if (roll(PAYMENT_FAILURE_RATE)) {
    return { status: 'failed', detail: 'Payment method on file was declined.' }
  }
  return { status: 'ok', detail: 'Payment method verified — Visa ending in 4242.' }
}

export function simulateOrderPlacement(productName, quantity, size) {
  if (roll(ORDER_PLACEMENT_FAILURE_RATE)) {
    return { status: 'failed', detail: 'Order placement failed due to a processing error. Please try again.' }
  }
  const orderId = 'SM-' + crypto.randomUUID().slice(0, 8).toUpperCase()
  const deliveryDays = Math.floor(Math.random() * 4) + 3
  return {
    status: 'ok',
    orderId,
    detail: `Order ${orderId} placed — ${quantity}x ${productName} (size ${size}). Estimated delivery: ${deliveryDays} business days.`,
    deliveryDays,
  }
}

export function simulateReturnEligibility(productName) {
  if (roll(RETURN_WINDOW_EXPIRED_RATE)) {
    return { status: 'failed', detail: `Return window for ${productName || 'this order'} has expired (30-day policy).` }
  }
  const orderRef = 'SM-' + crypto.randomUUID().slice(0, 8).toUpperCase()
  const product = PRODUCT_CATALOG[productName]
  return {
    status: 'ok',
    detail: `Order ${orderRef} is eligible for return. ${productName || 'Item'} purchased ${Math.floor(Math.random() * 25) + 1} days ago.`,
    orderRef,
    refundAmount: product?.price ?? 149.99,
  }
}

export function simulateRefundProcessing() {
  if (roll(REFUND_PROCESSING_FAILURE_RATE)) {
    return { status: 'failed', detail: 'Refund processing failed. Please contact support.' }
  }
  const refundDays = Math.floor(Math.random() * 5) + 3
  return { status: 'ok', detail: `Refund will be processed within ${refundDays} business days.`, refundDays }
}

export function simulateOrderStatus() {
  const status = weightedPick(ORDER_STATUS_WEIGHTS)
  const orderRef = 'SM-' + crypto.randomUUID().slice(0, 8).toUpperCase()
  const details = {
    processing: `Order ${orderRef} is being processed and will ship soon.`,
    shipped: `Order ${orderRef} shipped — tracking: TRK${Math.floor(Math.random() * 9000000) + 1000000}. Estimated arrival in 2-3 days.`,
    delivered: `Order ${orderRef} was delivered on ${new Date(Date.now() - Math.random() * 5 * 86400000).toLocaleDateString()}.`,
    delayed: `Order ${orderRef} is delayed due to high demand. New estimated arrival: ${Math.floor(Math.random() * 3) + 4} business days.`,
  }
  return { status: status === 'delayed' ? 'warning' : 'ok', orderStatus: status, detail: details[status], orderRef }
}

export function simulateInventoryStats() {
  const stats = Object.entries(PRODUCT_CATALOG).map(([name, info]) => {
    const units = Math.floor(Math.random() * 50) + 1
    const warn = roll(LOW_STOCK_WARN_RATE)
    return { product: name, price: info.price, units, status: warn || units < 5 ? 'low_stock' : 'in_stock' }
  })
  return {
    status: 'ok',
    detail: `Inventory snapshot: ${stats.length} products tracked.`,
    items: stats,
  }
}

export function gatherFacts(plan) {
  const facts = {}
  const tasks = plan.dispatch?.researcher?.tasks || []

  for (const task of tasks) {
    switch (task) {
      case 'stock_check':
        facts.stock = simulateStockCheck(plan.parameters?.product, plan.quantity || 1)
        break
      case 'payment_check':
        facts.payment = simulatePaymentCheck()
        break
      case 'return_eligibility':
        facts.returnEligibility = simulateReturnEligibility(plan.parameters?.product)
        break
      case 'order_status_lookup':
        facts.orderStatus = simulateOrderStatus()
        break
      case 'inventory_lookup':
        facts.inventory = simulateInventoryStats()
        break
    }
  }
  return facts
}
