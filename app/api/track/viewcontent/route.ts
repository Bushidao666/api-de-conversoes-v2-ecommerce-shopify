import { NextRequest, NextResponse } from 'next/server';
import { sendViewContentEvent } from '@/lib/fbevents';
import type { UserData } from '@/lib/fbevents';

const rawAllowedOrigin = process.env.ALLOWED_ORIGIN || 'https://dozeroa100k.com.br';
const ALLOWED_ORIGIN = rawAllowedOrigin.endsWith('/') ? rawAllowedOrigin.slice(0, -1) : rawAllowedOrigin;

/**
 * E-COMMERCE ViewContent Event Endpoint
 * 
 * Tracks when users view specific products in an e-commerce store.
 * This event is crucial for creating lookalike audiences and optimizing
 * product catalog campaigns on Facebook.
 * 
 * Required fields for e-commerce:
 * - content_ids: Array of product SKUs/IDs
 * - content_name: Product name
 * - value: Product price
 * - currency: Currency code (ISO 4217)
 * 
 * Optional e-commerce fields:
 * - brand: Product brand
 * - content_category: Product category
 * - availability: 'in stock', 'out of stock', 'preorder', etc.
 * - condition: 'new', 'refurbished', 'used'
 * - contents: Detailed product information array
 */

interface EcommerceViewContentData {
  content_ids: string[];           // Product SKUs/IDs (required)
  content_name: string;            // Product name (required)
  content_type: 'product';         // Always 'product' for e-commerce
  value: number;                   // Product price (required)
  currency: string;                // Currency code (required)
  content_category?: string;       // Product category
  brand?: string;                  // Product brand
  availability?: 'in stock' | 'out of stock' | 'preorder' | 'available for order' | 'discontinued';
  condition?: 'new' | 'refurbished' | 'used';
  contents?: Array<{              // Detailed product info
    id: string;
    quantity: number;
    item_price: number;
    title?: string;
    category?: string;
    brand?: string;
  }>;
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function validateEcommerceViewContentData(data: any): { 
  isValid: boolean; 
  errors: string[]; 
  sanitizedData?: EcommerceViewContentData 
} {
  const errors: string[] = [];
  
  // Required field validations
  if (!data) {
    errors.push('customData is required');
    return { isValid: false, errors };
  }

  if (!data.content_ids || !Array.isArray(data.content_ids) || data.content_ids.length === 0) {
    errors.push('content_ids is required and must be a non-empty array of product IDs');
  }

  if (!data.content_name || typeof data.content_name !== 'string' || data.content_name.trim().length === 0) {
    errors.push('content_name is required and must be a non-empty string');
  }

  if (typeof data.value !== 'number' || data.value < 0) {
    errors.push('value is required and must be a positive number');
  }

  if (!data.currency || typeof data.currency !== 'string') {
    errors.push('currency is required and must be a valid currency code (e.g., BRL, USD)');
  }

  // Optional field validations
  if (data.availability && !['in stock', 'out of stock', 'preorder', 'available for order', 'discontinued'].includes(data.availability)) {
    errors.push('availability must be one of: in stock, out of stock, preorder, available for order, discontinued');
  }

  if (data.condition && !['new', 'refurbished', 'used'].includes(data.condition)) {
    errors.push('condition must be one of: new, refurbished, used');
  }

  // Validate contents array structure if provided
  if (data.contents && Array.isArray(data.contents)) {
    data.contents.forEach((item: any, index: number) => {
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`contents[${index}].id is required and must be a string`);
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        errors.push(`contents[${index}].quantity must be a positive number`);
      }
      if (typeof item.item_price !== 'number' || item.item_price < 0) {
        errors.push(`contents[${index}].item_price must be a positive number`);
      }
    });
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Sanitize and structure data for Facebook CAPI
  const sanitizedData: EcommerceViewContentData = {
    content_ids: data.content_ids.map((id: string) => String(id).trim()),
    content_name: data.content_name.trim(),
    content_type: 'product',
    value: Number(data.value),
    currency: data.currency.toUpperCase(),
    ...(data.content_category && { content_category: data.content_category.trim() }),
    ...(data.brand && { brand: data.brand.trim() }),
    ...(data.availability && { availability: data.availability }),
    ...(data.condition && { condition: data.condition }),
    ...(data.contents && { contents: data.contents })
  };

  return { isValid: true, errors: [], sanitizedData };
}

export async function OPTIONS(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] [ECOMMERCE_VIEW_CONTENT] [OPTIONS] Received preflight request from origin: ${request.headers.get('origin')}`);
  const headers = getCorsHeaders();
  return NextResponse.json({}, { status: 200, headers });
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  let eventId = 'N/A';
  const corsHeaders = getCorsHeaders();

  try {
    console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] 🛍️ Received product view event from e-commerce client`);
    const body = await request.json();
    eventId = body.eventId || eventId;
    console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] Raw payload from client:`, JSON.stringify(body, null, 2));

    const { 
      userData: clientProvidedUserData, 
      customData: customDataFromClient,
      eventSourceUrl, 
      urlParameters: urlParametersFromClient
    } = body;

    // Validate e-commerce specific data
    const validation = validateEcommerceViewContentData(customDataFromClient);
    if (!validation.isValid) {
      console.warn(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] ❌ E-commerce data validation failed:`, validation.errors);
      return NextResponse.json({ 
        message: 'Invalid e-commerce data for ViewContent event',
        errors: validation.errors,
        event_id: eventId,
        success: false
      }, { status: 400, headers: corsHeaders });
    }

    const validatedCustomData = validation.sanitizedData!;
    console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] ✅ E-commerce data validated successfully`);
    console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] 📦 Product Details:`, {
      product_ids: validatedCustomData.content_ids,
      product_name: validatedCustomData.content_name,
      price: validatedCustomData.value,
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
      console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] 🍪 Using _fbc from server cookie: ${fbcFromCookieServer}`);
    } else if (userDataForFbevents.fbc) {
      console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] 🍪 Using _fbc from client: ${userDataForFbevents.fbc}`);
    } else {
      console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] ⚠️ No _fbc identifier found for product view tracking`);
    }

    if (fbpFromCookieServer && userDataForFbevents.fbp === fbpFromCookieServer) {
      console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] 🍪 Using _fbp from server cookie: ${fbpFromCookieServer}`);
    } else if (userDataForFbevents.fbp) {
      console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] 🍪 Using _fbp from client: ${userDataForFbevents.fbp}`);
    } else {
      console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] ⚠️ No _fbp identifier found for product view tracking`);
    }

    console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] 👤 UserData for Facebook CAPI:`, JSON.stringify(userDataForFbevents, null, 2));
    console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] 🚀 Sending e-commerce ViewContent event to Facebook Conversions API`);

    // Send event to Facebook Conversions API
    const result = await sendViewContentEvent(
      request,
      userDataForFbevents as UserData,
      validatedCustomData,
      eventSourceUrl,
      eventId,
      urlParametersFromClient
    );

    console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] 📡 Facebook Conversions API response:`, JSON.stringify(result, null, 2));

    if (result && result.success) {
      console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] ✅ E-commerce ViewContent event processed successfully! fbtrace_id: ${result.fbtrace_id}`);
      console.log(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] 🎯 Product "${validatedCustomData.content_name}" (${validatedCustomData.content_ids.join(', ')}) tracked for user optimization`);
      
      return NextResponse.json({ 
        message: 'E-commerce ViewContent event processed successfully', 
        fbtrace_id: result.fbtrace_id, 
        event_id: eventId,
        product_data: {
          ids: validatedCustomData.content_ids,
          name: validatedCustomData.content_name,
          value: validatedCustomData.value,
          currency: validatedCustomData.currency
        },
        success: true
      }, { status: 200, headers: corsHeaders });
    } else {
      console.error(`[${timestamp}] [ECOMMERCE_VIEW_CONTENT] [${eventId}] ❌ Error processing e-commerce ViewContent event:`, result?.error || result?.warning || 'Unknown error');
      return NextResponse.json({ 
        message: 'Error processing e-commerce ViewContent event', 
        error: result?.error || result?.warning || 'Unknown error', 
        event_id: eventId,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] [ECOMMERCE_VIEW_CONTENT_ERROR] [${eventId}] 💥 Critical error in e-commerce ViewContent API:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ 
        message: 'Critical error processing e-commerce ViewContent event', 
        error: errorMessage, 
        event_id: eventId, 
        success: false 
    }, { status: 500, headers: corsHeaders });
  }
} 