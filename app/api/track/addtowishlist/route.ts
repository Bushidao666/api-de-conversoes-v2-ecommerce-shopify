import { NextRequest, NextResponse } from 'next/server';
import { sendServerEvent } from '@/lib/fbevents';
import type { UserData } from '@/lib/fbevents';

const rawAllowedOrigin = process.env.ALLOWED_ORIGIN || 'https://dozeroa100k.com.br';
const ALLOWED_ORIGIN = rawAllowedOrigin.endsWith('/') ? rawAllowedOrigin.slice(0, -1) : rawAllowedOrigin;

/**
 * E-COMMERCE AddToWishlist Event Endpoint
 * 
 * Tracks when users add products to their wishlist/favorites in an e-commerce store.
 * This event is valuable for creating retargeting campaigns and understanding user
 * preferences for future product recommendations.
 * 
 * Wishlist events help Facebook create better lookalike audiences based on users
 * who show interest but haven't made a purchase yet.
 * 
 * Required fields for e-commerce add to wishlist:
 * - content_ids: Array of product SKUs being added (required)
 * - content_name: Primary product name or wishlist description (required)
 * - value: Total value of products being added (required)
 * - currency: Currency code (required)
 * - num_items: Total number of items being added (required)
 * 
 * Optional e-commerce fields:
 * - contents: Detailed product information array
 * - wishlist_name: Custom name for the wishlist
 * - wishlist_type: Type of wishlist (favorites, later, gift, etc.)
 * - content_category: Primary product category
 * - brand: Primary product brand
 */

interface WishlistProduct {
  [key: string]: unknown;       // Index signature for compatibility
  id: string;                    // Product SKU/ID (required)
  quantity: number;              // Quantity being added (default: 1)
  item_price: number;            // Unit price (required)
  title?: string;                // Product name
  category?: string;             // Product category
  brand?: string;                // Product brand
  image_url?: string;            // Product image URL
  availability?: 'in stock' | 'out of stock' | 'preorder' | 'available for order' | 'discontinued';
  condition?: 'new' | 'refurbished' | 'used';
  variant_id?: string;           // Product variant
  rating?: number;               // Product rating (1-5)
}

interface EcommerceAddToWishlistData {
  [key: string]: unknown;       // Index signature for compatibility
  content_ids: string[];         // Product SKUs (required)
  content_name: string;          // Primary product name or description (required)
  content_type: 'product';       // Always 'product' for e-commerce
  value: number;                 // Total value of products (required)
  currency: string;              // Currency code (required)
  num_items: number;             // Total number of items (required)
  
  // Detailed product information
  contents: WishlistProduct[];   // Array of products being added
  
  // Wishlist specific fields
  wishlist_name?: string;        // Custom wishlist name
  wishlist_type?: 'favorites' | 'later' | 'gift' | 'comparison' | 'custom';
  wishlist_id?: string;          // Wishlist identifier
  
  // Product aggregation fields
  content_category?: string;     // Primary product category
  brand?: string;                // Primary product brand (if single brand)
  
  // E-commerce tracking fields
  predicted_ltv?: number;        // Predicted customer lifetime value
  recommendation_source?: string; // Where the product was recommended from
  user_intent?: 'browse' | 'compare' | 'gift' | 'later_purchase';
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function validateEcommerceAddToWishlistData(data: any): { 
  isValid: boolean; 
  errors: string[]; 
  sanitizedData?: EcommerceAddToWishlistData;
  wishlistSummary?: {
    totalValue: number;
    totalItems: number;
    productCount: number;
    avgItemPrice: number;
    categories: string[];
    brands: string[];
  };
} {
  const errors: string[] = [];
  
  // Required field validations
  if (!data) {
    errors.push('customData is required for add to wishlist tracking');
    return { isValid: false, errors };
  }

  // Validate content_ids
  if (!data.content_ids || !Array.isArray(data.content_ids) || data.content_ids.length === 0) {
    errors.push('content_ids is required and must be a non-empty array of product IDs');
  } else {
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
  if (typeof data.value !== 'number' || data.value < 0) {
    errors.push('value is required and must be a positive number representing total value');
  }

  // Validate currency
  if (!data.currency || typeof data.currency !== 'string' || data.currency.length !== 3) {
    errors.push('currency is required and must be a valid 3-letter currency code (e.g., BRL, USD)');
  }

  // Validate num_items
  if (typeof data.num_items !== 'number' || data.num_items <= 0 || !Number.isInteger(data.num_items)) {
    errors.push('num_items is required and must be a positive integer');
  }

  // Validate contents array (required for wishlist)
  if (!data.contents || !Array.isArray(data.contents) || data.contents.length === 0) {
    errors.push('contents is required and must be a non-empty array of wishlist products');
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
      if (item.availability && !['in stock', 'out of stock', 'preorder', 'available for order', 'discontinued'].includes(item.availability)) {
        errors.push(`contents[${index}].availability must be one of: in stock, out of stock, preorder, available for order, discontinued`);
      }
      if (item.condition && !['new', 'refurbished', 'used'].includes(item.condition)) {
        errors.push(`contents[${index}].condition must be one of: new, refurbished, used`);
      }
      if (item.rating !== undefined && (typeof item.rating !== 'number' || item.rating < 1 || item.rating > 5)) {
        errors.push(`contents[${index}].rating must be a number between 1 and 5 if provided`);
      }
    });
  }

  // Optional field validations
  if (data.wishlist_type && !['favorites', 'later', 'gift', 'comparison', 'custom'].includes(data.wishlist_type)) {
    errors.push('wishlist_type must be one of: favorites, later, gift, comparison, custom');
  }

  if (data.user_intent && !['browse', 'compare', 'gift', 'later_purchase'].includes(data.user_intent)) {
    errors.push('user_intent must be one of: browse, compare, gift, later_purchase');
  }

  if (data.predicted_ltv !== undefined && (typeof data.predicted_ltv !== 'number' || data.predicted_ltv < 0)) {
    errors.push('predicted_ltv must be a positive number if provided');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Calculate and validate totals
  const calculatedTotalItems = data.contents.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const calculatedTotalValue = data.contents.reduce((sum: number, item: any) => sum + (item.item_price * item.quantity), 0);

  // Cross-validate calculated vs provided values
  if (calculatedTotalItems !== data.num_items) {
    errors.push(`num_items (${data.num_items}) doesn't match calculated total quantity (${calculatedTotalItems})`);
  }

  const valueTolerance = 0.01;
  if (Math.abs(calculatedTotalValue - data.value) > valueTolerance) {
    errors.push(`value (${data.value}) doesn't match calculated total value (${calculatedTotalValue.toFixed(2)})`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Extract categories and brands for summary with type-safe filtering
  const categories: string[] = Array.from(new Set(
    data.contents.map((item: any) => item.category).filter((category: any): category is string => Boolean(category) && typeof category === 'string')
  ));
  const brands: string[] = Array.from(new Set(
    data.contents.map((item: any) => item.brand).filter((brand: any): brand is string => Boolean(brand) && typeof brand === 'string')
  ));

  // Sanitize and structure data for Facebook CAPI
  const sanitizedData: EcommerceAddToWishlistData = {
    content_ids: data.content_ids.map((id: string) => String(id).trim()),
    content_name: data.content_name.trim(),
    content_type: 'product',
    value: Number(data.value),
    currency: data.currency.toUpperCase(),
    num_items: data.num_items,
    
    // Detailed product information
    contents: data.contents.map((item: any) => ({
      id: item.id.trim(),
      quantity: item.quantity,
      item_price: Number(item.item_price),
      ...(item.title && { title: item.title.trim() }),
      ...(item.category && { category: item.category.trim() }),
      ...(item.brand && { brand: item.brand.trim() }),
      ...(item.image_url && { image_url: item.image_url.trim() }),
      ...(item.availability && { availability: item.availability }),
      ...(item.condition && { condition: item.condition }),
      ...(item.variant_id && { variant_id: item.variant_id.trim() }),
      ...(item.rating !== undefined && { rating: Number(item.rating) })
    })),
    
    // Wishlist specific fields
    ...(data.wishlist_name && { wishlist_name: data.wishlist_name.trim() }),
    ...(data.wishlist_type && { wishlist_type: data.wishlist_type }),
    ...(data.wishlist_id && { wishlist_id: data.wishlist_id.trim() }),
    
    // Aggregation fields
    ...(data.content_category && { content_category: data.content_category.trim() }),
    ...(data.brand && { brand: data.brand.trim() }),
    
    // Tracking fields
    ...(data.predicted_ltv !== undefined && { predicted_ltv: Number(data.predicted_ltv) }),
    ...(data.recommendation_source && { recommendation_source: data.recommendation_source.trim() }),
    ...(data.user_intent && { user_intent: data.user_intent })
  };

  const wishlistSummary = {
    totalValue: calculatedTotalValue,
    totalItems: calculatedTotalItems,
    productCount: data.contents.length,
    avgItemPrice: calculatedTotalValue / calculatedTotalItems,
    categories,
    brands
  };

  return { isValid: true, errors: [], sanitizedData, wishlistSummary };
}

export async function OPTIONS(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] [ECOMMERCE_ADD_TO_WISHLIST] [OPTIONS] Received preflight request from origin: ${request.headers.get('origin')}`);
  const headers = getCorsHeaders();
  return NextResponse.json({}, { status: 200, headers });
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  let eventId = 'N/A';
  const corsHeaders = getCorsHeaders();

  try {
    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] ❤️ Received add to wishlist event from e-commerce client`);
    const body = await request.json();
    eventId = body.eventId || eventId;
    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] Raw wishlist payload from client:`, JSON.stringify(body, null, 2));

    const { 
      userData: clientProvidedUserData, 
      customData: customDataFromClient,
      eventSourceUrl, 
      urlParameters: urlParametersFromClient
    } = body;

    // Validate e-commerce add to wishlist data
    const validation = validateEcommerceAddToWishlistData(customDataFromClient);
    if (!validation.isValid) {
      console.warn(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] ❌ E-commerce wishlist data validation failed:`, validation.errors);
      return NextResponse.json({ 
        message: 'Invalid e-commerce data for AddToWishlist event',
        errors: validation.errors,
        event_id: eventId,
        success: false
      }, { status: 400, headers: corsHeaders });
    }

    const validatedCustomData = validation.sanitizedData!;
    const wishlistSummary = validation.wishlistSummary!;
    
    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] ✅ E-commerce wishlist data validated successfully`);
    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] ❤️ Wishlist Summary:`, {
      wishlist_name: validatedCustomData.wishlist_name || 'Default',
      wishlist_type: validatedCustomData.wishlist_type || 'favorites',
      total_products: wishlistSummary.productCount,
      total_items: wishlistSummary.totalItems,
      total_value: wishlistSummary.totalValue,
      avg_price: wishlistSummary.avgItemPrice.toFixed(2),
      currency: validatedCustomData.currency,
      categories: wishlistSummary.categories.length > 0 ? wishlistSummary.categories.join(', ') : 'Mixed',
      brands: wishlistSummary.brands.length > 0 ? wishlistSummary.brands.join(', ') : 'Mixed'
    });

    // Log detailed wishlist contents
    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] 🎁 Wishlist Products:`, 
      validatedCustomData.contents.map(item => ({
        product_id: item.id,
        name: item.title || 'Unknown',
        quantity: item.quantity,
        price: item.item_price,
        category: item.category || 'N/A',
        brand: item.brand || 'N/A',
        availability: item.availability || 'N/A'
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
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] 🍪 Using _fbc from server cookie: ${fbcFromCookieServer}`);
    } else if (userDataForFbevents.fbc) {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] 🍪 Using _fbc from client: ${userDataForFbevents.fbc}`);
    } else {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] ⚠️ No _fbc identifier found for wishlist tracking`);
    }

    if (fbpFromCookieServer && userDataForFbevents.fbp === fbpFromCookieServer) {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] 🍪 Using _fbp from server cookie: ${fbpFromCookieServer}`);
    } else if (userDataForFbevents.fbp) {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] 🍪 Using _fbp from client: ${userDataForFbevents.fbp}`);
    } else {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] ⚠️ No _fbp identifier found for wishlist tracking`);
    }

    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] 👤 UserData for Facebook CAPI:`, JSON.stringify(userDataForFbevents, null, 2));
    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] 🚀 Sending e-commerce AddToWishlist event to Facebook Conversions API`);

    // Send event to Facebook Conversions API using the generic sendServerEvent
    const result = await sendServerEvent(
      'AddToWishlist',
      request,
      userDataForFbevents as UserData,
      validatedCustomData,
      eventSourceUrl,
      eventId,
      urlParametersFromClient
    );

    console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] 📡 Facebook Conversions API response:`, JSON.stringify(result, null, 2));

    if (result && result.success) {
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] ✅ E-commerce AddToWishlist event processed successfully! fbtrace_id: ${result.fbtrace_id}`);
      console.log(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] 🎯 ${wishlistSummary.productCount} products added to wishlist "${validatedCustomData.wishlist_name || 'Default'}" - Total Value: ${validatedCustomData.currency} ${wishlistSummary.totalValue.toFixed(2)}`);
      
      return NextResponse.json({
        message: 'E-commerce AddToWishlist event processed successfully',
        fbtrace_id: result.fbtrace_id,
        event_id: eventId,
        wishlist_data: {
          product_count: wishlistSummary.productCount,
          total_items: wishlistSummary.totalItems,
          total_value: wishlistSummary.totalValue,
          currency: validatedCustomData.currency,
          wishlist_name: validatedCustomData.wishlist_name || 'Default',
          product_ids: validatedCustomData.content_ids
        },
        success: true
      }, { status: 200, headers: corsHeaders });
    } else {
      console.error(`[${timestamp}] [ECOMMERCE_ADD_TO_WISHLIST] [${eventId}] ❌ Error processing e-commerce AddToWishlist event:`, result?.error || result?.warning || 'Unknown error');
      return NextResponse.json({
        message: 'Error processing e-commerce AddToWishlist event',
        error: result?.error || result?.warning || 'Unknown error',
        event_id: eventId,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] [ECOMMERCE_ADD_TO_WISHLIST_ERROR] [${eventId}] 💥 Critical error in e-commerce AddToWishlist API:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({
        message: 'Critical error processing e-commerce AddToWishlist event',
        error: errorMessage,
        event_id: eventId,
        success: false
    }, { status: 500, headers: corsHeaders });
  }
} 