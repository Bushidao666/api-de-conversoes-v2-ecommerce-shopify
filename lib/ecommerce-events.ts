/**
 * E-COMMERCE EVENTS LIBRARY
 * 
 * Specialized functions and utilities for Facebook Conversions API e-commerce events.
 * Provides high-level abstractions, validation helpers, and business logic functions
 * for e-commerce tracking scenarios.
 * 
 * @version 2.0.0
 * @author Facebook Conversions API E-commerce Team
 */

import { NextRequest } from 'next/server';
import { sendServerEvent } from './fbevents';
import type { UserData } from './fbevents';
import {
  EcommerceViewContentData,
  EcommerceAddToCartData,
  EcommerceInitiateCheckoutData,
  EcommerceAddToWishlistData,
  EcommercePurchaseData,
  BaseProduct,
  ProductSummary,
  CartSummary,
  WishlistSummary,
  OrderSummary,
  generateEventId,
  formatCurrency,
  calculateProductSummary,
  validateOrderTotals
} from './ecommerce-types';

// =============================================================================
// E-COMMERCE EVENT FUNCTIONS
// =============================================================================

/**
 * Sends ViewContent event for product page views
 */
export async function sendEcommerceViewContent(
  request: NextRequest,
  userData: UserData,
  productData: EcommerceViewContentData,
  eventSourceUrl?: string,
  eventId?: string,
  urlParameters?: { [key: string]: string }
) {
  return await sendServerEvent(
    'ViewContent',
    request,
    userData,
    productData,
    eventSourceUrl,
    eventId,
    urlParameters
  );
}

/**
 * Sends AddToCart event when products are added to cart
 */
export async function sendEcommerceAddToCart(
  request: NextRequest,
  userData: UserData,
  cartData: EcommerceAddToCartData,
  eventSourceUrl?: string,
  eventId?: string,
  urlParameters?: { [key: string]: string }
) {
  return await sendServerEvent(
    'AddToCart',
    request,
    userData,
    cartData,
    eventSourceUrl,
    eventId,
    urlParameters
  );
}

/**
 * Sends InitiateCheckout event when checkout process begins
 */
export async function sendEcommerceInitiateCheckout(
  request: NextRequest,
  userData: UserData,
  checkoutData: EcommerceInitiateCheckoutData,
  eventSourceUrl?: string,
  eventId?: string,
  urlParameters?: { [key: string]: string }
) {
  return await sendServerEvent(
    'InitiateCheckout',
    request,
    userData,
    checkoutData,
    eventSourceUrl,
    eventId,
    urlParameters
  );
}

/**
 * Sends AddToWishlist event when products are added to wishlist
 */
export async function sendEcommerceAddToWishlist(
  request: NextRequest,
  userData: UserData,
  wishlistData: EcommerceAddToWishlistData,
  eventSourceUrl?: string,
  eventId?: string,
  urlParameters?: { [key: string]: string }
) {
  return await sendServerEvent(
    'AddToWishlist',
    request,
    userData,
    wishlistData,
    eventSourceUrl,
    eventId,
    urlParameters
  );
}

/**
 * Sends Purchase event when orders are completed
 */
export async function sendEcommercePurchase(
  request: NextRequest,
  userData: UserData,
  purchaseData: EcommercePurchaseData,
  eventSourceUrl?: string,
  eventId?: string,
  urlParameters?: { [key: string]: string }
) {
  return await sendServerEvent(
    'Purchase',
    request,
    userData,
    purchaseData,
    eventSourceUrl,
    eventId,
    urlParameters
  );
}

// =============================================================================
// E-COMMERCE BUSINESS LOGIC HELPERS
// =============================================================================

/**
 * Calculates cart totals including shipping, tax, and discounts
 */
export function calculateCartTotals(
  products: BaseProduct[],
  shippingCost: number = 0,
  taxRate: number = 0,
  discountAmount: number = 0
): {
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  totalItems: number;
} {
  const subtotal = products.reduce((sum, item) => sum + (item.item_price * item.quantity), 0);
  const totalItems = products.reduce((sum, item) => sum + item.quantity, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + shippingCost + tax - discountAmount;

  return {
    subtotal,
    shipping: shippingCost,
    tax,
    discount: discountAmount,
    total,
    totalItems,
  };
}

/**
 * Calculates total savings from original prices
 */
export function calculateTotalSavings(products: any[]): number {
  return products.reduce((savings, item) => {
    if (item.original_price && item.original_price > item.item_price) {
      return savings + ((item.original_price - item.item_price) * item.quantity);
    }
    return savings + (item.discount_amount || 0);
  }, 0);
}

/**
 * Generates content_ids array from products
 */
export function extractContentIds(products: BaseProduct[]): string[] {
  return products.map(product => product.id);
}

/**
 * Generates content_name for multi-product events
 */
export function generateContentName(products: BaseProduct[]): string {
  if (products.length === 1) {
    return products[0].title || `Product ${products[0].id}`;
  }
  return `Order with ${products.length} products`;
}

/**
 * Validates cart consistency (quantities, prices, totals)
 */
export function validateCartConsistency(
  products: BaseProduct[],
  expectedValue: number,
  expectedItems: number,
  tolerance: number = 0.01
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const calculatedValue = products.reduce((sum, item) => sum + (item.item_price * item.quantity), 0);
  const calculatedItems = products.reduce((sum, item) => sum + item.quantity, 0);
  
  if (Math.abs(calculatedValue - expectedValue) > tolerance) {
    errors.push(`Value mismatch: calculated ${calculatedValue.toFixed(2)}, expected ${expectedValue.toFixed(2)}`);
  }
  
  if (calculatedItems !== expectedItems) {
    errors.push(`Items count mismatch: calculated ${calculatedItems}, expected ${expectedItems}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// E-COMMERCE ANALYTICS HELPERS
// =============================================================================

/**
 * Analyzes cart composition and provides insights
 */
export function analyzeCartComposition(products: BaseProduct[]): {
  productCount: number;
  totalValue: number;
  avgItemPrice: number;
  categories: string[];
  brands: string[];
  priceRange: { min: number; max: number };
  highestValueItem: BaseProduct;
  mostQuantityItem: BaseProduct;
} {
  const summary = calculateProductSummary(products);
  const prices = products.map(p => p.item_price);
  const quantities = products.map(p => p.quantity);
  
  return {
    productCount: summary.productCount,
    totalValue: summary.totalValue,
    avgItemPrice: summary.avgUnitPrice,
    categories: summary.categories,
    brands: summary.brands,
    priceRange: {
      min: Math.min(...prices),
      max: Math.max(...prices),
    },
    highestValueItem: products.reduce((highest, current) => 
      (current.item_price * current.quantity) > (highest.item_price * highest.quantity) ? current : highest
    ),
    mostQuantityItem: products.reduce((most, current) => 
      current.quantity > most.quantity ? current : most
    ),
  };
}

/**
 * Determines customer segment based on purchase behavior
 */
export function determineCustomerSegment(
  orderValue: number,
  orderCount: number = 1,
  avgOrderValue: number = 0
): {
  segment: 'new' | 'regular' | 'vip' | 'whale';
  confidence: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let segment: 'new' | 'regular' | 'vip' | 'whale' = 'new';
  let confidence = 0.8;

  if (orderCount === 1) {
    segment = 'new';
    reasons.push('First-time customer');
  } else if (orderCount >= 2 && orderCount <= 5) {
    segment = 'regular';
    reasons.push(`${orderCount} previous orders`);
    confidence = 0.9;
  } else if (orderCount > 5) {
    segment = 'vip';
    reasons.push(`Loyal customer with ${orderCount} orders`);
    confidence = 0.95;
  }

  // High-value override
  if (orderValue > 1000) {
    segment = 'whale';
    reasons.push(`High-value order: ${formatCurrency(orderValue, 'BRL')}`);
    confidence = 0.99;
  }

  // High AOV override
  if (avgOrderValue > 500 && orderCount > 2) {
    segment = segment === 'whale' ? 'whale' : 'vip';
    reasons.push(`High AOV: ${formatCurrency(avgOrderValue, 'BRL')}`);
  }

  return { segment, confidence, reasons };
}

/**
 * Calculates recommended Facebook bid adjustments based on cart composition
 */
export function calculateBidAdjustments(
  cartValue: number,
  profit_margin: number = 0.3,
  target_roas: number = 4.0
): {
  maxBid: number;
  recommendedBid: number;
  bidStrategy: 'conservative' | 'aggressive' | 'balanced';
  explanation: string;
} {
  const profit = cartValue * profit_margin;
  const maxBid = profit / target_roas;
  const recommendedBid = maxBid * 0.8; // Conservative 80% of max

  let bidStrategy: 'conservative' | 'aggressive' | 'balanced' = 'balanced';
  let explanation = '';

  if (cartValue < 100) {
    bidStrategy = 'conservative';
    explanation = 'Low cart value - use conservative bidding';
  } else if (cartValue > 500) {
    bidStrategy = 'aggressive';
    explanation = 'High cart value - consider aggressive bidding';
  } else {
    bidStrategy = 'balanced';
    explanation = 'Medium cart value - balanced bidding approach';
  }

  return {
    maxBid,
    recommendedBid,
    bidStrategy,
    explanation,
  };
}

// =============================================================================
// E-COMMERCE DATA TRANSFORMERS
// =============================================================================

/**
 * Transforms generic product data to Facebook CAPI format
 */
export function transformProductToFacebookFormat(product: any): BaseProduct {
  return {
    id: String(product.id || product.sku || product.product_id),
    quantity: Number(product.quantity || 1),
    item_price: Number(product.price || product.item_price || 0),
    title: product.name || product.title || undefined,
    category: product.category || product.category_name || undefined,
    brand: product.brand || product.manufacturer || undefined,
    image_url: product.image || product.image_url || undefined,
  };
}

/**
 * Transforms e-commerce platform cart to Facebook CAPI format
 */
export function transformCartToFacebookFormat(
  cart: any,
  platform: 'shopify' | 'woocommerce' | 'magento' | 'vtex' | 'custom' = 'custom'
): EcommerceInitiateCheckoutData {
  let products: BaseProduct[] = [];
  let totalValue = 0;
  let totalItems = 0;
  let currency = 'BRL';

  switch (platform) {
    case 'shopify':
      products = cart.line_items?.map(transformProductToFacebookFormat) || [];
      totalValue = Number(cart.total_price || 0) / 100; // Shopify uses cents
      currency = cart.currency || 'BRL';
      break;
    
    case 'woocommerce':
      products = cart.items?.map(transformProductToFacebookFormat) || [];
      totalValue = Number(cart.total || 0);
      currency = cart.currency || 'BRL';
      break;
    
    default:
      products = cart.products?.map(transformProductToFacebookFormat) || [];
      totalValue = Number(cart.total || cart.value || 0);
      currency = cart.currency || 'BRL';
  }

  totalItems = products.reduce((sum, item) => sum + item.quantity, 0);

  return {
    contents: products,
    value: totalValue,
    currency: currency.toUpperCase(),
    num_items: totalItems,
    content_ids: extractContentIds(products),
    content_type: 'product',
    // Add platform-specific fields
    ...(cart.shipping_cost && { shipping_cost: Number(cart.shipping_cost) }),
    ...(cart.tax_amount && { tax_amount: Number(cart.tax_amount) }),
    ...(cart.discount_amount && { discount_amount: Number(cart.discount_amount) }),
    ...(cart.coupon_code && { coupon_code: String(cart.coupon_code) }),
  };
}

// =============================================================================
// E-COMMERCE VALIDATION UTILITIES
// =============================================================================

/**
 * Validates required environment variables for e-commerce tracking
 */
export function validateEcommerceEnvironment(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  if (!process.env.FACEBOOK_DATASET_ID) {
    errors.push('FACEBOOK_DATASET_ID is required');
  }
  if (!process.env.FACEBOOK_ACCESS_TOKEN) {
    errors.push('FACEBOOK_ACCESS_TOKEN is required');
  }
  if (!process.env.ALLOWED_ORIGIN) {
    errors.push('ALLOWED_ORIGIN is required for CORS');
  }

  // Recommended variables
  if (!process.env.IPDATA_API_KEY) {
    warnings.push('IPDATA_API_KEY is recommended for geolocation enrichment');
  }
  if (!process.env.FACEBOOK_TEST_EVENT_CODE) {
    warnings.push('FACEBOOK_TEST_EVENT_CODE is recommended for testing');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates product data structure for Facebook CAPI compliance
 */
export function validateProductData(product: any): {
  isValid: boolean;
  errors: string[];
  sanitized: BaseProduct | null;
} {
  const errors: string[] = [];

  if (!product.id && !product.sku) {
    errors.push('Product must have an id or sku');
  }
  if (typeof product.quantity !== 'number' || product.quantity <= 0) {
    errors.push('Product quantity must be a positive number');
  }
  if (typeof product.item_price !== 'number' || product.item_price < 0) {
    errors.push('Product item_price must be a non-negative number');
  }

  if (errors.length > 0) {
    return { isValid: false, errors, sanitized: null };
  }

  return {
    isValid: true,
    errors: [],
    sanitized: transformProductToFacebookFormat(product),
  };
}

// =============================================================================
// E-COMMERCE DEBUGGING UTILITIES
// =============================================================================

/**
 * Creates detailed debug information for e-commerce events
 */
export function createEcommerceDebugInfo(
  eventType: string,
  eventData: any,
  userData: UserData,
  eventId: string
): {
  timestamp: string;
  eventType: string;
  eventId: string;
  summary: any;
  validation: any;
  environment: any;
} {
  const timestamp = new Date().toISOString();
  
  let summary = {};
  if (eventData.contents) {
    const analysis = analyzeCartComposition(eventData.contents);
    summary = {
      productCount: analysis.productCount,
      totalValue: analysis.totalValue,
      avgItemPrice: analysis.avgItemPrice,
      categories: analysis.categories,
      brands: analysis.brands,
    };
  }

  return {
    timestamp,
    eventType,
    eventId,
    summary,
    validation: validateEcommerceEnvironment(),
    environment: {
      hasIpDataKey: !!process.env.IPDATA_API_KEY,
      hasTestCode: !!process.env.FACEBOOK_TEST_EVENT_CODE,
      allowedOrigin: process.env.ALLOWED_ORIGIN,
    },
  };
}

/**
 * Logs comprehensive e-commerce event information
 */
export function logEcommerceEvent(
  eventType: string,
  eventData: any,
  userData: UserData,
  eventId: string,
  result: any
): void {
  const debugInfo = createEcommerceDebugInfo(eventType, eventData, userData, eventId);
  
  console.log(`🛍️ [ECOMMERCE_EVENT] ${eventType} - ${eventId}`);
  console.log('📊 Event Summary:', debugInfo.summary);
  console.log('📡 Facebook Response:', {
    success: result?.success,
    fbtrace_id: result?.fbtrace_id,
    error: result?.error,
  });
  
  if (!debugInfo.validation.isValid) {
    console.warn('⚠️ Environment Issues:', debugInfo.validation.errors);
  }
  
  if (debugInfo.validation.warnings.length > 0) {
    console.warn('💡 Recommendations:', debugInfo.validation.warnings);
  }
} 