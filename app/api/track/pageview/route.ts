import { NextRequest, NextResponse } from 'next/server';
import { sendPageViewEvent } from '@/lib/fbevents'; // Assuming fbevents.ts is in src/lib
import type { UserData } from '@/lib/fbevents'; // Import UserData type

const rawAllowedOrigin = process.env.ALLOWED_ORIGIN || 'https://dozeroa100k.com.br';
const ALLOWED_ORIGIN = rawAllowedOrigin.endsWith('/') ? rawAllowedOrigin.slice(0, -1) : rawAllowedOrigin;

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Add any other headers your client might send
  };
}

export async function OPTIONS(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] [PAGEVIEW_EVENT] [OPTIONS] Received preflight request from origin: ${request.headers.get('origin')}`);
  const headers = getCorsHeaders();
  return NextResponse.json({}, { status: 200, headers });
}

export async function POST(request: NextRequest) {
  console.log("!!!! PAGEVIEW POST HANDLER INVOKED !!!!"); // Log de diagnóstico inicial
  const timestamp = new Date().toISOString();
  let eventId = 'N/A'; // Initialize eventId for logging
  const corsHeaders = getCorsHeaders();

  try {
    console.log(`[${timestamp}] [PAGEVIEW_EVENT] Received event from client`);
    const body = await request.json();
    eventId = body.eventId || eventId; // Update eventId if available in body
    console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Payload:`, JSON.stringify(body, null, 2));

    const { userDataFromClient, eventSourceUrl, urlParameters } = body;

    const clientIp = request.headers.get('x-forwarded-for') || request.ip;
    // Log for IP is still useful here, as fbevents will use it.
    console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Client IP for fbevents: ${clientIp || 'Not found'}`);

    const fbcFromCookieServer = request.cookies.get('_fbc')?.value;
    const fbpFromCookieServer = request.cookies.get('_fbp')?.value;

    // UserData will be enhanced with IP, User-Agent, and actual geo data (if IPDATA_API_KEY is set) by sendServerEvent in lib/fbevents.ts
    const userData: Partial<UserData> = {
      ...userDataFromClient,
      // client_ip_address and client_user_agent are set by sendServerEvent
      // Geolocation fields (ct, st, zp, country) are also set by sendServerEvent via getGeolocationData
      fbc: fbcFromCookieServer && (!userDataFromClient?.fbc || userDataFromClient.fbc !== fbcFromCookieServer)
           ? fbcFromCookieServer
           : userDataFromClient?.fbc,
      fbp: fbpFromCookieServer && (!userDataFromClient?.fbp || userDataFromClient.fbp !== fbpFromCookieServer)
           ? fbpFromCookieServer
           : userDataFromClient?.fbp,
    };

    // console.log('[API /pageview_DEBUG] Received request body:', JSON.stringify(body, null, 2));

    if (fbcFromCookieServer && userData.fbc === fbcFromCookieServer) {
      console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Using _fbc from server cookie: ${fbcFromCookieServer}`);
    } else if (userData.fbc) {
      console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Using _fbc from client: ${userData.fbc}`);
    } else {
      console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] No _fbc found from client or server cookie.`);
    }

    if (fbpFromCookieServer && userData.fbp === fbpFromCookieServer) {
      console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Using _fbp from server cookie: ${fbpFromCookieServer}`);
    } else if (userData.fbp) {
      console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Using _fbp from client: ${userData.fbp}`);
    } else {
      console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] No _fbp found from client or server cookie.`);
    }

    const customData = {};

    console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] UserData being passed to sendPageViewEvent (will be enhanced by it):`, JSON.stringify(userData, null, 2));
    console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Sending event to Facebook Conversions API via sendPageViewEvent`);

    const result = await sendPageViewEvent(
      request,
      userData as UserData, // Cast to UserData; sendServerEvent handles missing fields.
      customData,
      eventSourceUrl,
      eventId,
      urlParameters
    );

    console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Facebook Conversions API response:`, JSON.stringify(result, null, 2));

    // console.log(`[API /pageview_DEBUG] Result from sendPageViewEvent for Event ID ${eventId}:`, result);

    if (result && result.success) {
      console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Event processed successfully. fbtrace_id: ${result.fbtrace_id}`);
      return NextResponse.json({
        message: 'PageView event processed successfully',
        fbtrace_id: result.fbtrace_id,
        event_id: eventId,
        success: true
      }, { status: 200, headers: corsHeaders });
    } else {
      console.error(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Error processing event:`, result?.error || result?.warning || 'Unknown error');
      return NextResponse.json({
        message: 'Error processing PageView event',
        error: result?.error || result?.warning || 'Unknown error',
        event_id: eventId,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  } catch (error) {
    const errorTimestamp = new Date().toISOString(); // Use a new timestamp for the error log
    console.error(`[${errorTimestamp}] [PAGEVIEW_EVENT_ERROR] [${eventId}] API PageView Error:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({
        message: 'Error processing PageView event',
        error: errorMessage,
        event_id: eventId,
        success: false
    }, { status: 500, headers: corsHeaders });
  }
} 