import { NextRequest, NextResponse } from 'next/server';
import { sendInitiateCheckoutEvent } from '@/lib/fbevents';
import type { UserData } from '@/lib/fbevents';

const rawAllowedOrigin = process.env.ALLOWED_ORIGIN || 'https://dozeroa100k.com.br';
const ALLOWED_ORIGIN = rawAllowedOrigin.endsWith('/') ? rawAllowedOrigin.slice(0, -1) : rawAllowedOrigin;

/**
 * E-COMMERCE InitiateCheckout Event Endpoint
 * 
 * Tracks when users start the checkout process in an e-commerce store.
 * This event is critical for funnel optimization and cart abandonment campaigns.
 * 
 * This endpoint handles shopping carts with multiple products and calculates
 * total values including shipping, taxes, and discounts.
 * 
 * Required fields for e-commerce checkout:
 * - contents: Array of products in the cart (required)
 * - value: Total checkout value (required)
 * - currency: Currency code (required)
 * - num_items: Total number of items (required)
 * 
 * Optional e-commerce checkout fields:
 * - content_ids: Array of all product SKUs in cart
 * - shipping_cost: Shipping cost if calculated
 * - tax_amount: Tax amount if calculated
 * - discount_amount: Discount applied to cart
 * - coupon_code: Coupon/promo code used
 * - delivery_category: Shipping method selected
 */

interface CartItem {
  id: string;                    // Product SKU/ID (required)
  quantity: number;              // Quantity in cart (required)
  item_price: number;            // Unit price (required)
  title?: string;                // Product name
  category?: string;             // Product category
  brand?: string;                // Product brand
  variant?: string;              // Product variant (size, color, etc.)
}

interface EcommerceInitiateCheckoutData {
  contents: CartItem[];          // Cart items (required)
  value: number;                 // Total cart value (required)
  currency: string;              // Currency code (required)
  num_items: number;             // Total quantity of items (required)
  content_ids?: string[];        // All product IDs in cart
  content_type: 'product';       // Always 'product' for e-commerce
  
  // E-commerce specific optional fields
  shipping_cost?: number;        // Shipping cost
  tax_amount?: number;           // Tax amount
  discount_amount?: number;      // Discount applied
  coupon_code?: string;          // Coupon code used
  delivery_category?: 'standard' | 'express' | 'overnight' | 'pickup' | 'digital';
  
  // Additional tracking fields
  cart_id?: string;              // Cart identifier
  checkout_step?: number;        // Step in checkout process (1, 2, 3, etc.)
  payment_available?: string[];  // Available payment methods
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function validateEcommerceCheckoutData(data: any): { 
  isValid: boolean; 
  errors: string[]; 
  sanitizedData?: EcommerceInitiateCheckoutData;
  cartSummary?: {
    totalItems: number;
    totalValue: number;
    productCount: number;
    avgItemPrice: number;
  };
} {
  const errors: string[] = [];
  
  // Required field validations
  if (!data) {
    errors.push('customData is required for checkout tracking');
    return { isValid: false, errors };
  }

  // Validate contents array (cart items)
  if (!data.contents || !Array.isArray(data.contents) || data.contents.length === 0) {
    errors.push('contents is required and must be a non-empty array of cart items');
  } else {
    // Validate each cart item
    data.contents.forEach((item: any, index: number) => {
      if (!item.id || typeof item.id !== 'string' || item.id.trim().length === 0) {
        errors.push(`contents[${index}].id is required and must be a non-empty string`);
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        errors.push(`contents[${index}].quantity must be a positive integer`);
      }
      if (typeof item.item_price !== 'number' || item.item_price < 0) {
        errors.push(`contents[${index}].item_price must be a positive number`);
      }
      // Optional fields validation
      if (item.title && (typeof item.title !== 'string' || item.title.trim().length === 0)) {
        errors.push(`contents[${index}].title must be a non-empty string if provided`);
      }
    });
  }

  // Validate total value
  if (typeof data.value !== 'number' || data.value <= 0) {
    errors.push('value is required and must be a positive number representing total cart value');
  }

  // Validate currency
  if (!data.currency || typeof data.currency !== 'string' || data.currency.length !== 3) {
    errors.push('currency is required and must be a valid 3-letter currency code (e.g., BRL, USD)');
  }

  // Validate num_items
  if (typeof data.num_items !== 'number' || data.num_items <= 0 || !Number.isInteger(data.num_items)) {
    errors.push('num_items is required and must be a positive integer representing total quantity');
  }

  // Optional field validations
  if (data.shipping_cost !== undefined && (typeof data.shipping_cost !== 'number' || data.shipping_cost < 0)) {
    errors.push('shipping_cost must be a positive number if provided');
  }

  if (data.tax_amount !== undefined && (typeof data.tax_amount !== 'number' || data.tax_amount < 0)) {
    errors.push('tax_amount must be a positive number if provided');
  }

  if (data.discount_amount !== undefined && (typeof data.discount_amount !== 'number' || data.discount_amount < 0)) {
    errors.push('discount_amount must be a positive number if provided');
  }

  if (data.delivery_category && !['standard', 'express', 'overnight', 'pickup', 'digital'].includes(data.delivery_category)) {
    errors.push('delivery_category must be one of: standard, express, overnight, pickup, digital');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Calculate cart summary for validation and logging
  const cartItems = data.contents as CartItem[];
  const calculatedTotalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const calculatedTotalValue = cartItems.reduce((sum, item) => sum + (item.item_price * item.quantity), 0);
  
  // Cross-validate calculated vs provided values
  if (Math.abs(calculatedTotalItems - data.num_items) > 0) {
    errors.push(`num_items (${data.num_items}) doesn't match calculated total quantity (${calculatedTotalItems})`);
  }

  // Allow some tolerance for rounding in value calculation
  const valueTolerance = 0.01;
  if (Math.abs(calculatedTotalValue - data.value) > valueTolerance) {
    errors.push(`value (${data.value}) doesn't match calculated cart total (${calculatedTotalValue.toFixed(2)})`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Generate content_ids from cart items if not provided
  const contentIds = data.content_ids || cartItems.map(item => item.id);

  // Sanitize and structure data for Facebook CAPI
  const sanitizedData: EcommerceInitiateCheckoutData = {
    contents: cartItems.map(item => ({
      id: item.id.trim(),
      quantity: item.quantity,
      item_price: Number(item.item_price),
      ...(item.title && { title: item.title.trim() }),
      ...(item.category && { category: item.category.trim() }),
      ...(item.brand && { brand: item.brand.trim() }),
      ...(item.variant && { variant: item.variant.trim() })
    })),
    value: Number(data.value),
    currency: data.currency.toUpperCase(),
    num_items: data.num_items,
    content_ids: contentIds.map((id: string) => String(id).trim()),
    content_type: 'product',
    
    // Optional e-commerce fields
    ...(data.shipping_cost !== undefined && { shipping_cost: Number(data.shipping_cost) }),
    ...(data.tax_amount !== undefined && { tax_amount: Number(data.tax_amount) }),
    ...(data.discount_amount !== undefined && { discount_amount: Number(data.discount_amount) }),
    ...(data.coupon_code && { coupon_code: data.coupon_code.trim() }),
    ...(data.delivery_category && { delivery_category: data.delivery_category }),
    ...(data.cart_id && { cart_id: data.cart_id.trim() }),
    ...(data.checkout_step !== undefined && { checkout_step: Number(data.checkout_step) }),
    ...(data.payment_available && Array.isArray(data.payment_available) && { payment_available: data.payment_available })
  };

  const cartSummary = {
    totalItems: calculatedTotalItems,
    totalValue: calculatedTotalValue,
    productCount: cartItems.length,
    avgItemPrice: calculatedTotalValue / calculatedTotalItems
  };

  return { isValid: true, errors: [], sanitizedData, cartSummary };
}

export async function OPTIONS(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] [ECOMMERCE_CHECKOUT] [OPTIONS] Received preflight request from origin: ${request.headers.get('origin')}`);
  const headers = getCorsHeaders();
  return NextResponse.json({}, { status: 200, headers });
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  let eventId = 'N/A';
  const corsHeaders = getCorsHeaders();

  try {
    console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] 🛒 Received checkout initiation event from e-commerce client`);
    const body = await request.json();
    eventId = body.eventId || eventId;
    console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] Raw checkout payload from client:`, JSON.stringify(body, null, 2));

    const { 
      userData: clientProvidedUserData, 
      customData: customDataFromClient,
      eventSourceUrl, 
      urlParameters: urlParametersFromClient
    } = body;

    // Validate e-commerce checkout data
    const validation = validateEcommerceCheckoutData(customDataFromClient);
    if (!validation.isValid) {
      console.warn(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] ❌ E-commerce checkout data validation failed:`, validation.errors);
      return NextResponse.json({ 
        message: 'Invalid e-commerce checkout data for InitiateCheckout event',
        errors: validation.errors,
        event_id: eventId,
        success: false
      }, { status: 400, headers: corsHeaders });
    }

    const validatedCustomData = validation.sanitizedData!;
    const cartSummary = validation.cartSummary!;
    
    console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] ✅ E-commerce checkout data validated successfully`);
    console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] 🛒 Cart Summary:`, {
      unique_products: cartSummary.productCount,
      total_items: cartSummary.totalItems,
      cart_value: cartSummary.totalValue,
      avg_item_price: cartSummary.avgItemPrice.toFixed(2),
      currency: validatedCustomData.currency,
      has_shipping: !!validatedCustomData.shipping_cost,
      has_discount: !!validatedCustomData.discount_amount,
      coupon_used: validatedCustomData.coupon_code || 'None'
    });

    // Log detailed cart contents
    console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] 📦 Cart Contents:`, 
      validatedCustomData.contents.map(item => ({
        product_id: item.id,
        name: item.title || 'Unknown',
        quantity: item.quantity,
        unit_price: item.item_price,
        line_total: (item.item_price * item.quantity).toFixed(2)
      }))
    );

    // Process Facebook cookies with priority system
    const fbcFromCookieServer = request.cookies.get('_fbc')?.value;
    const fbpFromCookieServer = request.cookies.get('_fbp')?.value;

    let userDataForFbevents: Partial<UserData> = {
      ...clientProvidedUserData,
      fbc: fbcFromCookieServer && (!clientProvidedUserData?.fbc || clientProvidedUserData.fbc !== fbcFromCookieServer) 
           ? fbcFromCookieServer 
           : clientProvidedUserData?.fbc,
      fbp: fbpFromCookieServer && (!clientProvidedUserData?.fbp || clientProvidedUserData.fbp !== fbpFromCookieServer) 
           ? fbpFromCookieServer 
           : clientProvidedUserData?.fbp,
    };

    // Log Facebook tracking identifiers
    if (fbcFromCookieServer && userDataForFbevents.fbc === fbcFromCookieServer) {
      console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] 🍪 Using _fbc from server cookie: ${fbcFromCookieServer}`);
    } else if (userDataForFbevents.fbc) {
      console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] 🍪 Using _fbc from client: ${userDataForFbevents.fbc}`);
    } else {
      console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] ⚠️ No _fbc identifier found for checkout tracking - may impact attribution`);
    }

    if (fbpFromCookieServer && userDataForFbevents.fbp === fbpFromCookieServer) {
      console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] 🍪 Using _fbp from server cookie: ${fbpFromCookieServer}`);
    } else if (userDataForFbevents.fbp) {
      console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] 🍪 Using _fbp from client: ${userDataForFbevents.fbp}`);
    } else {
      console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] ⚠️ No _fbp identifier found for checkout tracking - may impact attribution`);
    }

    console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] 👤 UserData for Facebook CAPI:`, JSON.stringify(userDataForFbevents, null, 2));
    console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] 🚀 Sending e-commerce InitiateCheckout event to Facebook Conversions API`);

    // Send event to Facebook Conversions API
    const result = await sendInitiateCheckoutEvent(
      request,
      userDataForFbevents as UserData,
      validatedCustomData,
      eventSourceUrl,
      eventId,
      urlParametersFromClient
    );

    console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] 📡 Facebook Conversions API response:`, JSON.stringify(result, null, 2));

    if (result && result.success) {
      console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] ✅ E-commerce InitiateCheckout event processed successfully! fbtrace_id: ${result.fbtrace_id}`);
      console.log(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] 🎯 Checkout initiated: ${cartSummary.productCount} products, ${cartSummary.totalItems} items, ${validatedCustomData.currency} ${cartSummary.totalValue.toFixed(2)}`);
      
      return NextResponse.json({ 
        message: 'E-commerce InitiateCheckout event processed successfully', 
        fbtrace_id: result.fbtrace_id, 
        event_id: eventId,
        cart_summary: {
          product_count: cartSummary.productCount,
          total_items: cartSummary.totalItems,
          total_value: cartSummary.totalValue,
          currency: validatedCustomData.currency,
          product_ids: validatedCustomData.content_ids
        },
        success: true
      }, { status: 200, headers: corsHeaders });
    } else {
      console.error(`[${timestamp}] [ECOMMERCE_CHECKOUT] [${eventId}] ❌ Error processing e-commerce InitiateCheckout event:`, result?.error || result?.warning || 'Unknown error');
      return NextResponse.json({ 
        message: 'Error processing e-commerce InitiateCheckout event', 
        error: result?.error || result?.warning || 'Unknown error', 
        event_id: eventId,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] [ECOMMERCE_CHECKOUT_ERROR] [${eventId}] 💥 Critical error in e-commerce InitiateCheckout API:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ 
        message: 'Critical error processing e-commerce InitiateCheckout event', 
        error: errorMessage, 
        event_id: eventId, 
        success: false 
    }, { status: 500, headers: corsHeaders });
  }
} 