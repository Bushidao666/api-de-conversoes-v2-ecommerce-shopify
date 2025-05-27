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
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  num_items?: number;
  order_id?: string;
  search_string?: string;
  status?: string;
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
  request: NextRequest, // To get IP and User Agent
  userData: UserData = {},
  customData: CustomData = {},
  eventSourceUrl?: string,
  eventId?: string,
  urlParameters?: { [key: string]: string },
  event_time_override?: number
) {
  if (!ACCESS_TOKEN || !DATASET_ID) {
    console.error('[FBEVENTS_DEBUG] Facebook Dataset ID or Access Token is missing.');
    return;
  }

  const eventTime = event_time_override || Math.floor(Date.now() / 1000);
  const clientIpAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip');
  const clientUserAgent = request.headers.get('user-agent');
  
  console.log(`[FBEVENTS_DEBUG] Captured IP: ${clientIpAddress}, User-Agent: ${clientUserAgent}`);
  
  let fbcFromUrl: string | undefined = undefined;
  const processedUrlParameters = { ...urlParameters };

  if (urlParameters && urlParameters.fbclid) {
    fbcFromUrl = urlParameters.fbclid;
    console.log(`[FBEVENTS_DEBUG] fbclid found in URL parameters: ${fbcFromUrl}`);
    delete processedUrlParameters.fbclid;
  }

  let enhancedUserData: UserData = {
    ...userData, // This might already contain fbc/fbp from cookies via API route
    client_ip_address: clientIpAddress || undefined,
    client_user_agent: clientUserAgent || undefined,
  };

  if (fbcFromUrl) {
    enhancedUserData.fbc = fbcFromUrl; 
  }

  if (clientIpAddress) {
    console.log(`[FBEVENTS_DEBUG] Attempting geolocation for IP: ${clientIpAddress}`);
    const geoData = await getGeolocationData(clientIpAddress);
    console.log(`[FBEVENTS_DEBUG] Geolocation data received:`, JSON.stringify(geoData, null, 2));
    enhancedUserData = { ...enhancedUserData, ...geoData };
  }
  console.log(`[FBEVENTS_DEBUG] Enhanced user data (pre-hash):`, JSON.stringify(enhancedUserData, null, 2));

  // Hash PII data before sending
  const hashedUserData = await hashUserData(enhancedUserData);
  console.log(`[FBEVENTS_DEBUG] Hashed user data (to be sent):`, JSON.stringify(hashedUserData, null, 2));

  // Merge processedUrlParameters (without fbclid) into customData if provided
  let finalCustomData = { ...customData };
  if (Object.keys(processedUrlParameters).length > 0) {
    finalCustomData = { ...finalCustomData, ...processedUrlParameters };
  }

  const payload: ServerEvent = {
    event_name: eventName,
    event_time: eventTime,
    user_data: hashedUserData,
    custom_data: finalCustomData,
    action_source: 'website',
    event_source_url: eventSourceUrl || request.nextUrl.href, // Default to current URL
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
        body: JSON.stringify({ data: [payload] }),
      }
    );

    const responseData = await response.json();

    console.log(`[FBEVENTS_DEBUG] Response from Facebook for ${eventName} (ID: ${payload.event_id}):`, JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error(`[FBEVENTS_DEBUG] Error sending Facebook server event ${eventName} (ID: ${payload.event_id}):`, responseData);
      return { success: false, error: responseData };
    } 

    if (responseData.events_received === 1) {
        // Check for specific error messages from Facebook if needed
        if (responseData.fbtrace_id) {
            console.log(`[FBEVENTS_DEBUG] Facebook event ${eventName} (ID: ${payload.event_id}) sent successfully. Trace ID: ${responseData.fbtrace_id}`);
        }
        return { success: true, fbtrace_id: responseData.fbtrace_id, event_id: payload.event_id };
    } else {
        console.warn(`[FBEVENTS_DEBUG] Facebook event API did not confirm event ${eventName} (ID: ${payload.event_id}) received:`, responseData);
        return { success: false, warning: responseData, event_id: payload.event_id };
    }

  } catch (error) {
    console.error(`[FBEVENTS_DEBUG] Failed to send Facebook server event ${eventName} (ID: ${payload.event_id}):`, error);
    return { success: false, error, event_id: payload.event_id };
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