import { NextRequest, NextResponse } from 'next/server';
import { sendServerEvent } from '@/lib/fbevents';
import type { UserData } from '@/lib/fbevents';

const rawAllowedOrigin = process.env.ALLOWED_ORIGIN || 'https://dozeroa100k.com.br';
const ALLOWED_ORIGIN = rawAllowedOrigin.endsWith('/') ? rawAllowedOrigin.slice(0, -1) : rawAllowedOrigin;

/**
 * E-COMMERCE Purchase Event Endpoint
 * 
 * Tracks completed purchases in an e-commerce store. This is the most critical
 * conversion event for Facebook optimization algorithms and ROAS calculation.
 * 
 * This event drives Facebook's machine learning for:
 * - Campaign optimization (Purchase conversion goal)
 * - Bid optimization based on actual revenue
 * - Lookalike audience creation from high-value customers
 * - Dynamic product ads (DPA) performance
 * - Automated bidding strategies
 * 
 * Required fields for e-commerce purchase:
 * - order_id: Unique order identifier (required for deduplication)
 * - value: Total order value after discounts (required)
 * - currency: Currency code (required)
 * - contents: Array of purchased products with details (required)
 * - num_items: Total quantity of items purchased (required)
 * 
 * Important e-commerce fields:
 * - payment_method: How customer paid
 * - shipping_cost: Shipping fees
 * - tax_amount: Tax amount
 * - discount_amount: Total discounts applied
 * - coupon_code: Coupon/promo codes used
 * - delivery_category: Shipping method
 * - order_total: Gross total before discounts
 */

interface PurchasedProduct {
  id: string;                    // Product SKU/ID (required)
  quantity: number;              // Quantity purchased (required)
  item_price: number;            // Unit price after discounts (required)
  title?: string;                // Product name
  category?: string;             // Product category
  brand?: string;                // Product brand
  variant_id?: string;           // Product variant
  variant_name?: string;         // Variant display name
  sku?: string;                  // Product SKU (if different from id)
  original_price?: number;       // Original price before discounts
  discount_amount?: number;      // Discount applied to this item
  image_url?: string;            // Product image URL
}

interface EcommercePurchaseData {
  // Core purchase fields (required)
  order_id: string;              // Unique order ID (required)
  value: number;                 // Total purchase value after discounts (required)
  currency: string;              // Currency code (required)
  contents: PurchasedProduct[];  // Purchased products array (required)
  num_items: number;             // Total quantity purchased (required)
  content_type: 'product';       // Always 'product' for e-commerce
  
  // Auto-generated from contents
  content_ids?: string[];        // All product IDs in the order
  content_name?: string;         // Primary product name or order description
  
  // Financial breakdown
  order_total?: number;          // Gross total before discounts
  shipping_cost?: number;        // Shipping fees
  tax_amount?: number;           // Tax amount
  discount_amount?: number;      // Total discounts applied
  subtotal?: number;             // Subtotal before shipping/tax
  
  // Payment information
  payment_method?: 'credit_card' | 'debit_card' | 'paypal' | 'apple_pay' | 'google_pay' | 'bank_transfer' | 'boleto' | 'pix' | 'other';
  payment_status?: 'completed' | 'pending' | 'failed' | 'refunded' | 'partially_refunded';
  
  // Coupon/discount tracking
  coupon_code?: string;          // Primary coupon code used
  coupon_codes?: string[];       // All coupon codes applied
  discount_type?: 'percentage' | 'fixed_amount' | 'shipping' | 'bogo' | 'bulk';
  
  // Shipping information
  delivery_category?: 'standard' | 'express' | 'overnight' | 'pickup' | 'digital' | 'subscription';
  shipping_method?: string;      // Detailed shipping method name
  delivery_date?: string;        // Expected/actual delivery date (ISO format)
  
  // Business intelligence fields
  customer_type?: 'new' | 'returning' | 'vip' | 'wholesale';
  order_source?: 'website' | 'mobile_app' | 'social_media' | 'marketplace' | 'phone' | 'in_store';
  predicted_ltv?: number;        // Predicted customer lifetime value
  subscription_id?: string;      // If this is a subscription purchase
  
  // Campaign attribution
  campaign_id?: string;          // Internal campaign ID
  affiliate_id?: string;         // Affiliate/partner ID
  referrer_source?: string;      // Traffic source
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function validateEcommercePurchaseData(data: any): { 
  isValid: boolean; 
  errors: string[]; 
  sanitizedData?: EcommercePurchaseData;
  orderSummary?: {
    totalValue: number;
    totalItems: number;
    productCount: number;
    avgItemPrice: number;
    categories: string[];
    brands: string[];
    grossTotal: number;
    netTotal: number;
    totalSavings: number;
  };
} {
  const errors: string[] = [];
  
  // Required field validations
  if (!data) {
    errors.push('customData is required for purchase tracking');
    return { isValid: false, errors };
  }

  // Validate order_id (critical for deduplication)
  if (!data.order_id || typeof data.order_id !== 'string' || data.order_id.trim().length === 0) {
    errors.push('order_id is required and must be a non-empty string for purchase deduplication');
  }

  // Validate value (total purchase amount)
  if (typeof data.value !== 'number' || data.value <= 0) {
    errors.push('value is required and must be a positive number representing total purchase value');
  }

  // Validate currency
  if (!data.currency || typeof data.currency !== 'string' || data.currency.length !== 3) {
    errors.push('currency is required and must be a valid 3-letter currency code (e.g., BRL, USD)');
  }

  // Validate num_items
  if (typeof data.num_items !== 'number' || data.num_items <= 0 || !Number.isInteger(data.num_items)) {
    errors.push('num_items is required and must be a positive integer representing total quantity purchased');
  }

  // Validate contents array (purchased products)
  if (!data.contents || !Array.isArray(data.contents) || data.contents.length === 0) {
    errors.push('contents is required and must be a non-empty array of purchased products');
  } else {
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
      
      // Optional field validations
      if (item.original_price !== undefined && (typeof item.original_price !== 'number' || item.original_price < item.item_price)) {
        errors.push(`contents[${index}].original_price must be a number >= item_price if provided`);
      }
      if (item.discount_amount !== undefined && (typeof item.discount_amount !== 'number' || item.discount_amount < 0)) {
        errors.push(`contents[${index}].discount_amount must be a positive number if provided`);
      }
    });
  }

  // Financial field validations
  if (data.shipping_cost !== undefined && (typeof data.shipping_cost !== 'number' || data.shipping_cost < 0)) {
    errors.push('shipping_cost must be a positive number if provided');
  }

  if (data.tax_amount !== undefined && (typeof data.tax_amount !== 'number' || data.tax_amount < 0)) {
    errors.push('tax_amount must be a positive number if provided');
  }

  if (data.discount_amount !== undefined && (typeof data.discount_amount !== 'number' || data.discount_amount < 0)) {
    errors.push('discount_amount must be a positive number if provided');
  }

  if (data.order_total !== undefined && (typeof data.order_total !== 'number' || data.order_total < data.value)) {
    errors.push('order_total must be a number >= value (final total) if provided');
  }

  // Enum validations
  if (data.payment_method && !['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer', 'boleto', 'pix', 'other'].includes(data.payment_method)) {
    errors.push('payment_method must be one of: credit_card, debit_card, paypal, apple_pay, google_pay, bank_transfer, boleto, pix, other');
  }

  if (data.payment_status && !['completed', 'pending', 'failed', 'refunded', 'partially_refunded'].includes(data.payment_status)) {
    errors.push('payment_status must be one of: completed, pending, failed, refunded, partially_refunded');
  }

  if (data.delivery_category && !['standard', 'express', 'overnight', 'pickup', 'digital', 'subscription'].includes(data.delivery_category)) {
    errors.push('delivery_category must be one of: standard, express, overnight, pickup, digital, subscription');
  }

  if (data.customer_type && !['new', 'returning', 'vip', 'wholesale'].includes(data.customer_type)) {
    errors.push('customer_type must be one of: new, returning, vip, wholesale');
  }

  if (data.order_source && !['website', 'mobile_app', 'social_media', 'marketplace', 'phone', 'in_store'].includes(data.order_source)) {
    errors.push('order_source must be one of: website, mobile_app, social_media, marketplace, phone, in_store');
  }

  if (data.discount_type && !['percentage', 'fixed_amount', 'shipping', 'bogo', 'bulk'].includes(data.discount_type)) {
    errors.push('discount_type must be one of: percentage, fixed_amount, shipping, bogo, bulk');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Calculate and validate order totals
  const calculatedTotalItems = data.contents.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const calculatedSubtotal = data.contents.reduce((sum: number, item: any) => sum + (item.item_price * item.quantity), 0);
  
  // Calculate total savings from original prices
  const totalSavings = data.contents.reduce((sum: number, item: any) => {
    if (item.original_price && item.original_price > item.item_price) {
      return sum + ((item.original_price - item.item_price) * item.quantity);
    }
    return sum + (item.discount_amount || 0);
  }, 0);

  // Cross-validate calculated vs provided values
  if (calculatedTotalItems !== data.num_items) {
    errors.push(`num_items (${data.num_items}) doesn't match calculated total quantity (${calculatedTotalItems})`);
  }

  // Validate order value calculation
  const expectedTotal = calculatedSubtotal + (data.shipping_cost || 0) + (data.tax_amount || 0) - (data.discount_amount || 0);
  const valueTolerance = 0.01;
  if (Math.abs(expectedTotal - data.value) > valueTolerance) {
    console.warn(`Order total calculation: subtotal=${calculatedSubtotal}, shipping=${data.shipping_cost || 0}, tax=${data.tax_amount || 0}, discount=${data.discount_amount || 0}, expected=${expectedTotal.toFixed(2)}, provided=${data.value}`);
    // This is a warning, not an error, as business logic can vary
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Extract categories and brands for summary
  const categories = Array.from(new Set(data.contents.map((item: any) => item.category).filter(Boolean)));
  const brands = Array.from(new Set(data.contents.map((item: any) => item.brand).filter(Boolean)));

  // Generate content_ids and content_name if not provided
  const contentIds = data.content_ids || data.contents.map((item: any) => item.id);
  const contentName = data.content_name || (data.contents.length === 1 ? 
    data.contents[0].title || `Product ${data.contents[0].id}` : 
    `Order with ${data.contents.length} products`);

  // Sanitize and structure data for Facebook CAPI
  const sanitizedData: EcommercePurchaseData = {
    // Core required fields
    order_id: data.order_id.trim(),
    value: Number(data.value),
    currency: data.currency.toUpperCase(),
    contents: data.contents.map((item: any) => ({
      id: item.id.trim(),
      quantity: item.quantity,
      item_price: Number(item.item_price),
      ...(item.title && { title: item.title.trim() }),
      ...(item.category && { category: item.category.trim() }),
      ...(item.brand && { brand: item.brand.trim() }),
      ...(item.variant_id && { variant_id: item.variant_id.trim() }),
      ...(item.variant_name && { variant_name: item.variant_name.trim() }),
      ...(item.sku && { sku: item.sku.trim() }),
      ...(item.original_price !== undefined && { original_price: Number(item.original_price) }),
      ...(item.discount_amount !== undefined && { discount_amount: Number(item.discount_amount) }),
      ...(item.image_url && { image_url: item.image_url.trim() })
    })),
    num_items: data.num_items,
    content_type: 'product',
    
    // Auto-generated fields
    content_ids: contentIds.map((id: string) => String(id).trim()),
    content_name: contentName.trim(),
    
    // Financial fields
    ...(data.order_total !== undefined && { order_total: Number(data.order_total) }),
    ...(data.shipping_cost !== undefined && { shipping_cost: Number(data.shipping_cost) }),
    ...(data.tax_amount !== undefined && { tax_amount: Number(data.tax_amount) }),
    ...(data.discount_amount !== undefined && { discount_amount: Number(data.discount_amount) }),
    ...(data.subtotal !== undefined && { subtotal: Number(data.subtotal) }),
    
    // Payment fields
    ...(data.payment_method && { payment_method: data.payment_method }),
    ...(data.payment_status && { payment_status: data.payment_status }),
    
    // Discount/coupon fields
    ...(data.coupon_code && { coupon_code: data.coupon_code.trim() }),
    ...(data.coupon_codes && Array.isArray(data.coupon_codes) && { coupon_codes: data.coupon_codes.map((code: string) => code.trim()) }),
    ...(data.discount_type && { discount_type: data.discount_type }),
    
    // Shipping fields
    ...(data.delivery_category && { delivery_category: data.delivery_category }),
    ...(data.shipping_method && { shipping_method: data.shipping_method.trim() }),
    ...(data.delivery_date && { delivery_date: data.delivery_date.trim() }),
    
    // Business intelligence fields
    ...(data.customer_type && { customer_type: data.customer_type }),
    ...(data.order_source && { order_source: data.order_source }),
    ...(data.predicted_ltv !== undefined && { predicted_ltv: Number(data.predicted_ltv) }),
    ...(data.subscription_id && { subscription_id: data.subscription_id.trim() }),
    
    // Attribution fields
    ...(data.campaign_id && { campaign_id: data.campaign_id.trim() }),
    ...(data.affiliate_id && { affiliate_id: data.affiliate_id.trim() }),
    ...(data.referrer_source && { referrer_source: data.referrer_source.trim() })
  };

  const orderSummary = {
    totalValue: data.value,
    totalItems: calculatedTotalItems,
    productCount: data.contents.length,
    avgItemPrice: calculatedSubtotal / calculatedTotalItems,
    categories,
    brands,
    grossTotal: data.order_total || data.value,
    netTotal: data.value,
    totalSavings
  };

  return { isValid: true, errors: [], sanitizedData, orderSummary };
}

export async function OPTIONS(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] [ECOMMERCE_PURCHASE] [OPTIONS] Received preflight request from origin: ${request.headers.get('origin')}`);
  const headers = getCorsHeaders();
  return NextResponse.json({}, { status: 200, headers });
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  let eventId = 'N/A';
  const corsHeaders = getCorsHeaders();

  try {
    console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] 💰 Received purchase completion event from e-commerce client`);
    const body = await request.json();
    eventId = body.eventId || eventId;
    console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] Raw purchase payload from client:`, JSON.stringify(body, null, 2));

    const { 
      userData: clientProvidedUserData, 
      customData: customDataFromClient,
      eventSourceUrl, 
      urlParameters: urlParametersFromClient
    } = body;

    // Validate e-commerce purchase data
    const validation = validateEcommercePurchaseData(customDataFromClient);
    if (!validation.isValid) {
      console.warn(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] ❌ E-commerce purchase data validation failed:`, validation.errors);
      return NextResponse.json({ 
        message: 'Invalid e-commerce data for Purchase event',
        errors: validation.errors,
        event_id: eventId,
        success: false
      }, { status: 400, headers: corsHeaders });
    }

    const validatedCustomData = validation.sanitizedData!;
    const orderSummary = validation.orderSummary!;
    
    console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] ✅ E-commerce purchase data validated successfully`);
    console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] 💰 ORDER SUMMARY:`, {
      order_id: validatedCustomData.order_id,
      total_value: orderSummary.totalValue,
      currency: validatedCustomData.currency,
      items_count: orderSummary.totalItems,
      products_count: orderSummary.productCount,
      avg_item_price: orderSummary.avgItemPrice.toFixed(2),
      payment_method: validatedCustomData.payment_method || 'Not specified',
      shipping_cost: validatedCustomData.shipping_cost || 0,
      tax_amount: validatedCustomData.tax_amount || 0,
      discount_amount: validatedCustomData.discount_amount || 0,
      total_savings: orderSummary.totalSavings.toFixed(2),
      customer_type: validatedCustomData.customer_type || 'Not specified'
    });

    // Log detailed purchase breakdown
    console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] 🛍️ PURCHASED PRODUCTS:`, 
      validatedCustomData.contents.map(item => ({
        product_id: item.id,
        name: item.title || 'Unknown',
        quantity: item.quantity,
        unit_price: item.item_price,
        line_total: (item.item_price * item.quantity).toFixed(2),
        category: item.category || 'N/A',
        brand: item.brand || 'N/A',
        savings: item.original_price ? ((item.original_price - item.item_price) * item.quantity).toFixed(2) : '0.00'
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
      console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] 🍪 Using _fbc from server cookie: ${fbcFromCookieServer}`);
    } else if (userDataForFbevents.fbc) {
      console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] 🍪 Using _fbc from client: ${userDataForFbevents.fbc}`);
    } else {
      console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] ⚠️ No _fbc identifier found for purchase tracking - CRITICAL for attribution!`);
    }

    if (fbpFromCookieServer && userDataForFbevents.fbp === fbpFromCookieServer) {
      console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] 🍪 Using _fbp from server cookie: ${fbpFromCookieServer}`);
    } else if (userDataForFbevents.fbp) {
      console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] 🍪 Using _fbp from client: ${userDataForFbevents.fbp}`);
    } else {
      console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] ⚠️ No _fbp identifier found for purchase tracking - CRITICAL for attribution!`);
    }

    console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] 👤 UserData for Facebook CAPI:`, JSON.stringify(userDataForFbevents, null, 2));
    console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] 🚀 Sending CRITICAL e-commerce Purchase event to Facebook Conversions API`);

    // Send event to Facebook Conversions API using the generic sendServerEvent
    const result = await sendServerEvent(
      'Purchase',
      request,
      userDataForFbevents as UserData,
      validatedCustomData,
      eventSourceUrl,
      eventId,
      urlParametersFromClient
    );

    console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] 📡 Facebook Conversions API response:`, JSON.stringify(result, null, 2));

    if (result && result.success) {
      console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] ✅ 🎉 E-commerce Purchase event processed successfully! fbtrace_id: ${result.fbtrace_id}`);
      console.log(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] 💎 CONVERSION COMPLETED: Order #${validatedCustomData.order_id} - ${orderSummary.productCount} products, ${orderSummary.totalItems} items, ${validatedCustomData.currency} ${orderSummary.totalValue.toFixed(2)} REVENUE!`);
      
      return NextResponse.json({
        message: 'E-commerce Purchase event processed successfully',
        fbtrace_id: result.fbtrace_id,
        event_id: eventId,
        order_data: {
          order_id: validatedCustomData.order_id,
          product_count: orderSummary.productCount,
          total_items: orderSummary.totalItems,
          total_value: orderSummary.totalValue,
          currency: validatedCustomData.currency,
          total_savings: orderSummary.totalSavings,
          payment_method: validatedCustomData.payment_method,
          product_ids: validatedCustomData.content_ids,
          categories: orderSummary.categories,
          brands: orderSummary.brands
        },
        success: true
      }, { status: 200, headers: corsHeaders });
    } else {
      console.error(`[${timestamp}] [ECOMMERCE_PURCHASE] [${eventId}] ❌ 💔 CRITICAL ERROR processing e-commerce Purchase event:`, result?.error || result?.warning || 'Unknown error');
      return NextResponse.json({
        message: 'CRITICAL ERROR processing e-commerce Purchase event',
        error: result?.error || result?.warning || 'Unknown error',
        event_id: eventId,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] [ECOMMERCE_PURCHASE_ERROR] [${eventId}] 💥 💔 CRITICAL SYSTEM ERROR in e-commerce Purchase API:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({
        message: 'CRITICAL SYSTEM ERROR processing e-commerce Purchase event',
        error: errorMessage,
        event_id: eventId,
        success: false
    }, { status: 500, headers: corsHeaders });
  }
} 