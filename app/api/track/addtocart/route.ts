import { NextRequest, NextResponse } from 'next/server';
import { sendServerEvent } from '@/lib/fbevents';
import type { UserData } from '@/lib/fbevents';

const rawAllowedOrigin = process.env.ALLOWED_ORIGIN || 'https://dozeroa100k.com.br';
const ALLOWED_ORIGIN = rawAllowedOrigin.endsWith('/') ? rawAllowedOrigin.slice(0, -1) : rawAllowedOrigin;

/**
 * E-COMMERCE AddToCart Event Endpoint
 * 
 * Tracks when users add products to their shopping cart in an e-commerce store.
 * This is a crucial micro-conversion event for optimizing product recommendations
 * and retargeting campaigns.
 * 
 * This event helps Facebook understand user preferences and creates better
 * product catalog ads and dynamic product ads (DPA).
 * 
 * Required fields for e-commerce add to cart:
 * - content_ids: Product SKU/ID being added (required)
 * - content_name: Product name (required)  
 * - value: Product price (required)
 * - currency: Currency code (required)
 * - quantity: Quantity being added (required)
 * 
 * Optional e-commerce fields:
 * - content_category: Product category
 * - brand: Product brand
 * - variant_id: Product variant (size, color, etc.)
 * - availability: Product availability status
 * - condition: Product condition
 * - contents: Detailed product information
 */

interface AddToCartProduct {
  id: string;                    // Product SKU/ID (required)
  quantity: number;              // Quantity being added (required)
  item_price: number;            // Unit price (required)
  title?: string;                // Product name
  category?: string;             // Product category
  brand?: string;                // Product brand
  variant_id?: string;           // Variant identifier (size, color, etc.)
  variant_name?: string;         // Variant display name
  image_url?: string;            // Product image URL
}

interface EcommerceAddToCartData {
  content_ids: string[];         // Product SKUs (required)
  content_name: string;          // Product name (required)
  content_type: 'product';       // Always 'product' for e-commerce
  value: number;                 // Total value being added (required)
  currency: string;              // Currency code (required)
  quantity: number;              // Total quantity being added (required)
  
  // Product details
  content_category?: string;     // Product category
  brand?: string;                // Product brand
  availability?: 'in stock' | 'out of stock' | 'preorder' | 'available for order' | 'discontinued';
  condition?: 'new' | 'refurbished' | 'used';
  
  // Detailed product info (for complex products or bundles)
  contents?: AddToCartProduct[];
  
  // E-commerce specific tracking
  cart_id?: string;              // Cart identifier
  product_group_id?: string;     // Product group/collection ID
  custom_label_0?: string;       // Custom product label
  predicted_ltv?: number;        // Predicted customer lifetime value
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function validateEcommerceAddToCartData(data: any): { 
  isValid: boolean; 
  errors: string[]; 
  sanitizedData?: EcommerceAddToCartData;
  productSummary?: {
    totalValue: number;
    totalQuantity: number;
    avgUnitPrice: number;
    productCount: number;
  };
} {
  const errors: string[] = [];
  
  // Required field validations
  if (!data) {
    errors.push('customData is required for add to cart tracking');
    return { isValid: false, errors };
  }

  // Validate content_ids
  if (!data.content_ids || !Array.isArray(data.content_ids) || data.content_ids.length === 0) {
    errors.push('content_ids is required and must be a non-empty array of product IDs');
  } else {
    // Ensure all IDs are valid strings
    data.content_ids.forEach((id: any, index: number) => {
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        errors.push(`content_ids[${index}] must be a non-empty string`);
      }
    });
  }

  // Validate content_name
  if (!data.content_name || typeof data.content_name !== 'string' || data.content_name.trim().length === 0) {
    errors.push('content_name is required and must be a non-empty string');
  }

  // Validate value
  if (typeof data.value !== 'number' || data.value <= 0) {
    errors.push('value is required and must be a positive number representing total value being added');
  }

  // Validate currency
  if (!data.currency || typeof data.currency !== 'string' || data.currency.length !== 3) {
    errors.push('currency is required and must be a valid 3-letter currency code (e.g., BRL, USD)');
  }

  // Validate quantity
  if (typeof data.quantity !== 'number' || data.quantity <= 0 || !Number.isInteger(data.quantity)) {
    errors.push('quantity is required and must be a positive integer');
  }

  // Optional field validations
  if (data.availability && !['in stock', 'out of stock', 'preorder', 'available for order', 'discontinued'].includes(data.availability)) {
    errors.push('availability must be one of: in stock, out of stock, preorder, available for order, discontinued');
  }

  if (data.condition && !['new', 'refurbished', 'used'].includes(data.condition)) {
    errors.push('condition must be one of: new, refurbished, used');
  }

  // Validate contents array if provided (for complex products)
  if (data.contents && Array.isArray(data.contents)) {
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
    });
  }

  // Additional business logic validations
  if (data.predicted_ltv !== undefined && (typeof data.predicted_ltv !== 'number' || data.predicted_ltv < 0)) {
    errors.push('predicted_ltv must be a positive number if provided');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Calculate product summary for validation and logging
  let totalValue = data.value;
  let totalQuantity = data.quantity;
  let productCount = 1;

  // If contents array is provided, validate against main values
  if (data.contents && Array.isArray(data.contents) && data.contents.length > 0) {
    const calculatedValue = data.contents.reduce((sum: number, item: any) => sum + (item.item_price * item.quantity), 0);
    const calculatedQuantity = data.contents.reduce((sum: number, item: any) => sum + item.quantity, 0);
    productCount = data.contents.length;

    // Cross-validate with tolerance for rounding
    const valueTolerance = 0.01;
    if (Math.abs(calculatedValue - data.value) > valueTolerance) {
      errors.push(`value (${data.value}) doesn't match calculated total from contents (${calculatedValue.toFixed(2)})`);
    }

    if (calculatedQuantity !== data.quantity) {
      errors.push(`quantity (${data.quantity}) doesn't match calculated total from contents (${calculatedQuantity})`);
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }
  }

  // Sanitize and structure data for Facebook CAPI
  const sanitizedData: EcommerceAddToCartData = {
    content_ids: data.content_ids.map((id: string) => String(id).trim()),
    content_name: data.content_name.trim(),
    content_type: 'product',
    value: Number(data.value),
    currency: data.currency.toUpperCase(),
    quantity: data.quantity,
    
    // Optional fields
    ...(data.content_category && { content_category: data.content_category.trim() }),
    ...(data.brand && { brand: data.brand.trim() }),
    ...(data.availability && { availability: data.availability }),
    ...(data.condition && { condition: data.condition }),
    
    // Detailed product info
    ...(data.contents && data.contents.length > 0 && { 
      contents: data.contents.map((item: any) => ({
        id: item.id.trim(),
        quantity: item.quantity,
        item_price: Number(item.item_price),
        ...(item.title && { title: item.title.trim() }),
        ...(item.category && { category: item.category.trim() }),
        ...(item.brand && { brand: item.brand.trim() }),
        ...(item.variant_id && { variant_id: item.variant_id.trim() }),
        ...(item.variant_name && { variant_name: item.variant_name.trim() }),
        ...(item.image_url && { image_url: item.image_url.trim() })
      }))
    }),
    
    // E-commerce tracking fields
    ...(data.cart_id && { cart_id: data.cart_id.trim() }),
    ...(data.product_group_id && { product_group_id: data.product_group_id.trim() }),
    ...(data.custom_label_0 && { custom_label_0: data.custom_label_0.trim() }),
    ...(data.predicted_ltv !== undefined && { predicted_ltv: Number(data.predicted_ltv) })
  };

  const productSummary = {
    totalValue,
    totalQuantity,
    avgUnitPrice: totalValue / totalQuantity,
    productCount
  };

  return { isValid: true, errors: [], sanitizedData, productSummary };
}

export async function OPTIONS(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] [ECOMMERCE_ADD_TO_CART] [OPTIONS] Received preflight request from origin: ${request.headers.get('origin')}`);
  const headers = getCorsHeaders();
  return NextResponse.json({}, { status: 200, headers });
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  let eventId = 'N/A';
  const corsHeaders = getCorsHeaders();

  try {
    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] 🛒 Received add to cart event from e-commerce client`);
    const body = await request.json();
    eventId = body.eventId || eventId;
    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] Raw add to cart payload from client:`, JSON.stringify(body, null, 2));

    const { 
      userData: clientProvidedUserData, 
      customData: customDataFromClient,
      eventSourceUrl, 
      urlParameters: urlParametersFromClient
    } = body;

    // Validate e-commerce add to cart data
    const validation = validateEcommerceAddToCartData(customDataFromClient);
    if (!validation.isValid) {
      console.warn(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] ❌ E-commerce add to cart data validation failed:`, validation.errors);
      return NextResponse.json({ 
        message: 'Invalid e-commerce data for AddToCart event',
        errors: validation.errors,
        event_id: eventId,
        success: false
      }, { status: 400, headers: corsHeaders });
    }

    const validatedCustomData = validation.sanitizedData!;
    const productSummary = validation.productSummary!;
    
    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] ✅ E-commerce add to cart data validated successfully`);
    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] 🛍️ Product Added to Cart:`, {
      product_name: validatedCustomData.content_name,
      product_ids: validatedCustomData.content_ids,
      quantity_added: validatedCustomData.quantity,
      unit_price: productSummary.avgUnitPrice.toFixed(2),
      total_value: validatedCustomData.value,
      currency: validatedCustomData.currency,
      brand: validatedCustomData.brand || 'Not specified',
      category: validatedCustomData.content_category || 'Not specified',
      availability: validatedCustomData.availability || 'Not specified'
    });

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
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] 🍪 Using _fbc from server cookie: ${fbcFromCookieServer}`);
    } else if (userDataForFbevents.fbc) {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] 🍪 Using _fbc from client: ${userDataForFbevents.fbc}`);
    } else {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] ⚠️ No _fbc identifier found for add to cart tracking`);
    }

    if (fbpFromCookieServer && userDataForFbevents.fbp === fbpFromCookieServer) {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] 🍪 Using _fbp from server cookie: ${fbpFromCookieServer}`);
    } else if (userDataForFbevents.fbp) {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] 🍪 Using _fbp from client: ${userDataForFbevents.fbp}`);
    } else {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] ⚠️ No _fbp identifier found for add to cart tracking`);
    }

    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] 👤 UserData for Facebook CAPI:`, JSON.stringify(userDataForFbevents, null, 2));
    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] 🚀 Sending e-commerce AddToCart event to Facebook Conversions API`);

    // Send event to Facebook Conversions API using the generic sendServerEvent
    const result = await sendServerEvent(
      'AddToCart',
      request,
      userDataForFbevents as UserData,
      validatedCustomData,
      eventSourceUrl,
      eventId,
      urlParametersFromClient
    );

    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] 📡 Facebook Conversions API response:`, JSON.stringify(result, null, 2));

    if (result && result.success) {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] ✅ E-commerce AddToCart event processed successfully! fbtrace_id: ${result.fbtrace_id}`);
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] 🎯 Product "${validatedCustomData.content_name}" (${validatedCustomData.content_ids.join(', ')}) added to cart - Quantity: ${validatedCustomData.quantity}, Value: ${validatedCustomData.currency} ${validatedCustomData.value}`);
      
      return NextResponse.json({
        message: 'E-commerce AddToCart event processed successfully',
        fbtrace_id: result.fbtrace_id,
        event_id: eventId,
        product_data: {
          ids: validatedCustomData.content_ids,
          name: validatedCustomData.content_name,
          quantity: validatedCustomData.quantity,
          value: validatedCustomData.value,
          currency: validatedCustomData.currency
        },
        success: true
      }, { status: 200, headers: corsHeaders });
    } else {
      console.error(`[${timestamp}] [ECOMMERCE_ADD_TO_CART] [${eventId}] ❌ Error processing e-commerce AddToCart event:`, result?.error || result?.warning || 'Unknown error');
      return NextResponse.json({
        message: 'Error processing e-commerce AddToCart event',
        error: result?.error || result?.warning || 'Unknown error',
        event_id: eventId,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] [ECOMMERCE_ADD_TO_CART_ERROR] [${eventId}] 💥 Critical error in e-commerce AddToCart API:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({
        message: 'Critical error processing e-commerce AddToCart event',
        error: errorMessage,
        event_id: eventId,
        success: false
    }, { status: 500, headers: corsHeaders });
  }
} 