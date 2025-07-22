import { NextRequest } from 'next/server';

export interface UserData {
  em?: string[]; // Email
  ph?: string[]; // Phone number
  fn?: string[]; // First name
  ln?: string[]; // Last name
  ge?: string[]; // Gender
  db?: string[]; // Date of birth (YYYYMMDD)
  ct?: string[]; // City (Hashed)
  st?: string[]; // State (2-letter ISO code, Hashed)
  zp?: string[]; // Zip code (Hashed)
  country?: string[]; // Country (2-letter ISO code, Hashed)
  external_id?: string[]; // External ID
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string; // Click ID
  fbp?: string; // Browser ID
}

export interface CustomData {
  [key: string]: unknown;
  // Basic Facebook CAPI fields
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
    [key: string]: unknown; // Allow additional properties
  }>;
  num_items?: number;
  order_id?: string;
  search_string?: string;
  status?: string;
  content_type?: string;
  
  // E-commerce specific fields
  brand?: string;
  availability?: string;
  condition?: string;
  payment_method?: string;
  payment_type?: string;
  installments?: number;
  shipping_cost?: number;
  tax_amount?: number;
  discount_amount?: number;
  subtotal?: number;
  order_total?: number;
  delivery_category?: string;
  shipping_method?: string;
  estimated_delivery_date?: string;
  checkout_step?: number;
  checkout_id?: string;
  cart_id?: string;
  coupon_code?: string;
  coupon_codes?: string[];
  customer_type?: string;
  predicted_ltv?: number;
  payment_source?: string;
  device_type?: string;
  risk_score?: number;
  fraud_check_passed?: boolean;
  wishlist_name?: string;
  wishlist_type?: string;
  wishlist_id?: string;
  recommendation_source?: string;
  user_intent?: string;
  payment_status?: string;
  discount_type?: string;
  subscription_id?: string;
  campaign_id?: string;
  affiliate_id?: string;
  referrer_source?: string;
  product_group_id?: string;
  custom_label_0?: string;
  variant_id?: string;
  variant_name?: string;
  sku?: string;
}

export interface ServerEvent {
  event_name: string;
  event_time: number;
  user_data: UserData;
  custom_data?: CustomData;
  event_source_url?: string;
  action_source: 'website';
  event_id?: string; // Optional: For deduplication
}

const DATASET_ID = process.env.FACEBOOK_DATASET_ID || '701320582382618';
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || 'EAAVZA2wID1AEBO0NupBzTMuPbn4GBZCInGDNw7Spd2a7DdKcmUgKcjhvbZC67ZCbEgBfZBdm2UiCnPrTiM0JJUdvWkPvNHyeXxOE8JpRi7I0OUlrCydePLGt7F4okAUJw0vxMJguom3yXHwLhahbZBcU2rnYC4dM74AQijN7m4jtQ6hHdTQpJWgxRTk0sOSghZBrwZDZD';
const TEST_EVENT_CODE = process.env.FACEBOOK_TEST_EVENT_CODE;

const IPDATA_API_KEY = process.env.IPDATA_API_KEY;

async function getHashedValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function getGeolocationData(ipAddress: string): Promise<Partial<UserData>> {
  if (!ipAddress || !IPDATA_API_KEY) {
    if (!IPDATA_API_KEY) {
      console.warn('[FBEVENTS_DEBUG] IPDATA_API_KEY is not set. Skipping geolocation lookup.');
    }
    return {};
  }
  try {
    console.log(`[FBEVENTS_DEBUG] Fetching geolocation for IP: ${ipAddress}`);
    const response = await fetch(`https://api.ipdata.co/${ipAddress}?api-key=${IPDATA_API_KEY}&fields=country_code,region_code,city,postal`);
    if (!response.ok) {
      console.warn(`[FBEVENTS_DEBUG] ipdata.co API request failed for IP ${ipAddress}: ${response.status} ${response.statusText}`);
      return {};
    }
    const data = await response.json();
    console.log(`[FBEVENTS_DEBUG] Raw geolocation data from ipdata.co for IP ${ipAddress}:`, JSON.stringify(data, null, 2));

    const geoResult: Partial<UserData> = {
      ct: data.city ? [data.city] : undefined,
      st: data.region_code ? [data.region_code] : undefined,
      zp: data.postal ? [data.postal] : undefined,
      country: data.country_code ? [data.country_code.toLowerCase()] : undefined,
    };
    console.log(`[FBEVENTS_DEBUG] Parsed geo data for IP ${ipAddress}:`, JSON.stringify(geoResult, null, 2));
    return geoResult;
  } catch (error) {
    console.error(`[FBEVENTS_DEBUG] Error fetching geolocation data from ipdata.co for IP ${ipAddress}:`, error);
    return {};
  }
}

async function hashUserData(userData: UserData): Promise<UserData> {
  const hashedUserData: UserData = { ...userData }; 

  // Email
  if (userData.em && userData.em.length > 0) {
    hashedUserData.em = await Promise.all(
      userData.em.map(e => getHashedValue(e.trim().toLowerCase()))
    );
  }
  // Phone
  if (userData.ph && userData.ph.length > 0) {
    hashedUserData.ph = await Promise.all(
      userData.ph.map(p => getHashedValue(p.replace(/\D/g, ''))) // Remove non-digits
    );
  }
  // First Name
  if (userData.fn && userData.fn.length > 0) {
    hashedUserData.fn = await Promise.all(
      userData.fn.map(f => getHashedValue(f.trim().toLowerCase()))
    );
  }
  // Last Name
  if (userData.ln && userData.ln.length > 0) {
    hashedUserData.ln = await Promise.all(
      userData.ln.map(l => getHashedValue(l.trim().toLowerCase()))
    );
  }
  // Gender (m/f)
  if (userData.ge && userData.ge.length > 0) {
    hashedUserData.ge = await Promise.all(
      userData.ge.map(g => getHashedValue(g.trim().toLowerCase().charAt(0)))
    );
  }
  // Date of Birth (YYYYMMDD)
  if (userData.db && userData.db.length > 0) {
    hashedUserData.db = await Promise.all(
      userData.db.map(d => getHashedValue(d.replace(/\D/g, '')))
    );
  }
  // City
  if (userData.ct && userData.ct.length > 0) {
    hashedUserData.ct = await Promise.all(
      userData.ct.map(c => getHashedValue(c.trim().toLowerCase().replace(/\s+/g, '')))
    );
  }
  // State (2-letter code)
  if (userData.st && userData.st.length > 0) {
    hashedUserData.st = await Promise.all(
      // Normalize to lowercase and remove all non-alphanumeric for broader matching, then hash
      userData.st.map(s => getHashedValue(s.trim().toLowerCase().replace(/[^a-z0-9]/gi, '')))
    );
  }
  // Zip Code
  if (userData.zp && userData.zp.length > 0) {
    hashedUserData.zp = await Promise.all(
      userData.zp.map(z => getHashedValue(z.trim().replace(/\s+/g, '')))
    );
  }
  // Country (2-letter code)
  if (userData.country && userData.country.length > 0) {
    hashedUserData.country = await Promise.all(
      userData.country.map(c => getHashedValue(c.trim().toLowerCase()))
    );
  }
  
  // Note: external_id, fbc, fbp, client_ip_address, client_user_agent are NOT hashed here by design.
  return hashedUserData;
}

export async function sendServerEvent(
  eventName: string,
  request: NextRequest,
  userData: UserData = {},
  customData: CustomData = {},
  eventSourceUrl?: string,
  eventId?: string,
  urlParameters?: { [key: string]: string },
  event_time_override?: number
) {
  if (!ACCESS_TOKEN || !DATASET_ID) {
    console.error('[FBEVENTS_DEBUG] Facebook Dataset ID or Access Token is missing.');
    return { success: false, error: 'Missing Facebook API credentials on server.' };
  }

  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [FBEVENTS] sendServerEvent called for ${eventName}. Event ID: ${eventId}`);

  const eventTime = event_time_override || Math.floor(Date.now() / 1000);
  const clientIpAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip');
  const clientUserAgent = request.headers.get('user-agent');
  console.log(`[FBEVENTS_DEBUG] Base UserData from API Route:`, JSON.stringify(userData, null, 2));
  console.log(`[FBEVENTS_DEBUG] Base CustomData from API Route:`, JSON.stringify(customData, null, 2));
  console.log(`[FBEVENTS_DEBUG] URL Parameters from API Route:`, JSON.stringify(urlParameters, null, 2));
  console.log(`[FBEVENTS_DEBUG] Captured IP: ${clientIpAddress}, User-Agent: ${clientUserAgent}`);
  
  // --- Robust fbclid handling --- 
  let fbcValueForUserData: string | undefined = userData?.fbc; // Start with fbc from cookie (passed in userData)
  console.log(`[FBEVENTS_DEBUG] Initial fbc from userData (cookie): ${fbcValueForUserData}`);

  let tempUrlParams = urlParameters ? { ...urlParameters } : {};
  let tempCustomData = customData ? { ...customData } : {};

  // Priority 1: fbclid from urlParameters
  if (tempUrlParams.fbclid) {
    fbcValueForUserData = tempUrlParams.fbclid;
    console.log(`[FBEVENTS_DEBUG] fbclid found in urlParameters. Set as fbc: ${fbcValueForUserData}. Removing from tempUrlParams.`);
    delete tempUrlParams.fbclid;
  } else {
    console.log(`[FBEVENTS_DEBUG] fbclid NOT found in urlParameters.`);
  }

  // Priority 2 (Fallback): fbclid from customData (if frontend sent it there mistakenly)
  if (!fbcValueForUserData && tempCustomData.fbclid) {
    fbcValueForUserData = tempCustomData.fbclid as string; // Assuming it would be a string if present
    console.log(`[FBEVENTS_DEBUG] fbclid found in customData (fallback). Set as fbc: ${fbcValueForUserData}. Removing from tempCustomData.`);
    delete tempCustomData.fbclid;
  } else if (tempCustomData.hasOwnProperty('fbclid')) {
    // If fbcValueForUserData was already set (e.g. from urlParameters), still remove fbclid from tempCustomData
    console.log(`[FBEVENTS_DEBUG] fbclid also found in customData, but fbc already set. Removing from tempCustomData.`);
    delete tempCustomData.fbclid;
  }
  console.log(`[FBEVENTS_DEBUG] Final fbc value for user_data: ${fbcValueForUserData}`);
  // --- End of fbclid handling ---

  let enhancedUserData: UserData = {
    ...userData, // Includes original fbc (cookie), em, ph, fn, ln etc.
    client_ip_address: clientIpAddress || undefined,
    client_user_agent: clientUserAgent || undefined,
  };

  if (fbcValueForUserData) {
    enhancedUserData.fbc = fbcValueForUserData; // Override with the determined fbc value
  }
  console.log(`[FBEVENTS_DEBUG] UserData before geo-enrichment (fbc processed):`, JSON.stringify(enhancedUserData, null, 2));

  if (clientIpAddress && IPDATA_API_KEY) { // Ensure API key is present for geolocation
    console.log(`[FBEVENTS_DEBUG] Attempting geolocation for IP: ${clientIpAddress}`);
    const geoData = await getGeolocationData(clientIpAddress);
    console.log(`[FBEVENTS_DEBUG] Geolocation data received:`, JSON.stringify(geoData, null, 2));
    enhancedUserData = { ...enhancedUserData, ...geoData };
  } else if (clientIpAddress && !IPDATA_API_KEY) {
    console.warn('[FBEVENTS_DEBUG] IPDATA_API_KEY is not set. Skipping geolocation lookup.');
  }
  console.log(`[FBEVENTS_DEBUG] Enhanced user data (pre-hash, fbc and geo processed):`, JSON.stringify(enhancedUserData, null, 2));

  const hashedUserData = await hashUserData(enhancedUserData);
  console.log(`[FBEVENTS_DEBUG] Hashed user data (to be sent):`, JSON.stringify(hashedUserData, null, 2));

  // tempCustomData is now the customData from API route, potentially cleaned of fbclid.
  // tempUrlParams is now urlParameters from API route, cleaned of fbclid.
  let finalCustomData = { ...tempCustomData };
  if (Object.keys(tempUrlParams).length > 0) {
    console.log(`[FBEVENTS_DEBUG] Merging cleaned tempUrlParams into finalCustomData. Cleaned tempUrlParams:`, JSON.stringify(tempUrlParams), "Cleaned Initial CustomData:", JSON.stringify(tempCustomData));
    finalCustomData = { ...finalCustomData, ...tempUrlParams }; // Merge remaining (UTMs etc.)
  }
  console.log(`[FBEVENTS_DEBUG] Final custom_data for payload:`, JSON.stringify(finalCustomData));

  const payload: ServerEvent = {
    event_name: eventName,
    event_time: eventTime,
    user_data: hashedUserData,
    custom_data: finalCustomData, // This should NOT contain fbclid
    action_source: 'website',
    event_source_url: eventSourceUrl || (request.nextUrl ? request.nextUrl.href : undefined),
  };

  if (eventId) {
    payload.event_id = eventId;
  }

  console.log(`[FBEVENTS_DEBUG] Sending ${eventName} event to Facebook. Event ID: ${payload.event_id}. Full Payload (with hashed data):`, JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${DATASET_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: [payload], ...(TEST_EVENT_CODE && { test_event_code: TEST_EVENT_CODE }) }),
      }
    );

    const responseData = await response.json();
    console.log(`[FBEVENTS_DEBUG] Response from Facebook for ${eventName} (ID: ${payload.event_id}):`, JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error(`[FBEVENTS_DEBUG] Error sending Facebook server event ${eventName} (ID: ${payload.event_id}):`, responseData);
      return { success: false, error: responseData, event_id: payload.event_id };
    } 

    if (responseData.events_received === 1 || responseData.fbtrace_id) { // Check fbtrace_id as well for success
        if (responseData.fbtrace_id) {
            console.log(`[FBEVENTS_DEBUG] Facebook event ${eventName} (ID: ${payload.event_id}) sent successfully. Trace ID: ${responseData.fbtrace_id}`);
        }
        return { success: true, fbtrace_id: responseData.fbtrace_id, event_id: payload.event_id };
    } else {
        console.warn(`[FBEVENTS_DEBUG] Facebook event API did not confirm event ${eventName} (ID: ${payload.event_id}) received as expected:`, responseData);
        return { success: false, warning: responseData, event_id: payload.event_id };
    }

  } catch (error) {
    const err = error as Error;
    console.error(`[FBEVENTS_DEBUG] Failed to send Facebook server event ${eventName} (ID: ${payload?.event_id || 'N/A'}):`, err.message, err.stack);
    return { success: false, error: err.message, event_id: payload?.event_id || 'N/A' };
  }
}

// Specific event functions (examples)
export async function sendPageViewEvent(
  request: NextRequest, 
  userData: UserData = {}, 
  customData: CustomData = {},
  eventSourceUrl?: string, 
  eventId?: string, 
  urlParameters?: { [key: string]: string },
  event_time_override?: number
) {
  return sendServerEvent('PageView', request, userData, customData, eventSourceUrl, eventId, urlParameters, event_time_override);
}

export async function sendViewContentEvent(
  request: NextRequest,
  userData: UserData = {},
  customData: CustomData,
  eventSourceUrl?: string,
  eventId?: string,
  urlParameters?: { [key: string]: string }
) {
  return sendServerEvent('ViewContent', request, userData, customData, eventSourceUrl, eventId, urlParameters);
}

export async function sendInitiateCheckoutEvent(
  request: NextRequest,
  userData: UserData = {},
  customData: CustomData, 
  eventSourceUrl?: string,
  eventId?: string,
  urlParameters?: { [key: string]: string }
) {
  return sendServerEvent('InitiateCheckout', request, userData, customData, eventSourceUrl, eventId, urlParameters);
}

// New function for Lead event
export async function sendLeadEvent(
  request: NextRequest,
  userData: UserData = {},
  customData: CustomData = {}, // Lead events typically don't require customData, but good to include for flexibility
  eventSourceUrl?: string,
  eventId?: string,
  urlParameters?: { [key: string]: string },
  event_time_override?: number
) {
  return sendServerEvent('Lead', request, userData, customData, eventSourceUrl, eventId, urlParameters, event_time_override);
}

// Nova função específica para Purchase que pode receber o event_time do webhook
export async function sendPurchaseEventViaWebhook(
  request: NextRequest, // Ainda necessário para IP/UA se não vierem no payload da Kiwify de forma confiável
  userData: UserData,
  customData: CustomData,
  eventSourceUrl: string,
  eventId: string,
  eventTime: number, // event_time específico da compra
  trackingParametersFromWebhook?: { [key: string]: string } // UTMs e outros do webhook
) {
  return sendServerEvent(
    'Purchase',
    request,
    userData,
    customData,
    eventSourceUrl,
    eventId,
    trackingParametersFromWebhook, // Passa os trackingParameters como urlParameters para sendServerEvent
    eventTime // Passa o event_time_override
  );
} 