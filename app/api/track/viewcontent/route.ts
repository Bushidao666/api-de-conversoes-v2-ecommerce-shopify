import { NextRequest, NextResponse } from 'next/server';
import { sendViewContentEvent } from '@/lib/fbevents'; // Assuming fbevents.ts is in src/lib
import type { UserData } from '@/lib/fbevents'; // Import UserData type

const rawAllowedOrigin = process.env.ALLOWED_ORIGIN || 'https://dozeroa100k.com.br';
const ALLOWED_ORIGIN = rawAllowedOrigin.endsWith('/') ? rawAllowedOrigin.slice(0, -1) : rawAllowedOrigin;

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] [VIEW_CONTENT_EVENT] [OPTIONS] Received preflight request from origin: ${request.headers.get('origin')}`);
  const headers = getCorsHeaders();
  return NextResponse.json({}, { status: 200, headers });
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  let eventId = 'N/A';
  const corsHeaders = getCorsHeaders();

  try {
    console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] Received event from client`);
    const body = await request.json();
    eventId = body.eventId || eventId;
    console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] Payload from client:`, JSON.stringify(body, null, 2));

    const { 
        userData: clientProvidedUserData, 
        customData: customDataFromClient,
        eventSourceUrl, 
        urlParameters: urlParametersFromClient
    } = body;

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
    
    if (fbcFromCookieServer && userDataForFbevents.fbc === fbcFromCookieServer) {
      console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] Using _fbc from server cookie: ${fbcFromCookieServer}`);
    } else if (userDataForFbevents.fbc) {
      console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] Using _fbc from client: ${userDataForFbevents.fbc}`);
    } else {
      console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] No _fbc found from client or server cookie for ViewContent event.`);
    }

    if (fbpFromCookieServer && userDataForFbevents.fbp === fbpFromCookieServer) {
      console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] Using _fbp from server cookie: ${fbpFromCookieServer}`);
    } else if (userDataForFbevents.fbp) {
      console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] Using _fbp from client: ${userDataForFbevents.fbp}`);
    } else {
      console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] No _fbp found from client or server cookie for ViewContent event.`);
    }

    if (!customDataFromClient || !customDataFromClient.content_name) {
      console.warn(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] Missing required customData fields (content_name). Request body:`, JSON.stringify(customDataFromClient, null, 2));
      return NextResponse.json({ message: 'Missing required customData fields for ViewContent.' }, { status: 400, headers: corsHeaders });
    }

    console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] UserData being passed to sendViewContentEvent (after server cookie check):`, JSON.stringify(userDataForFbevents, null, 2));
    console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] CustomData from client to be sent:`, JSON.stringify(customDataFromClient, null, 2));

    const result = await sendViewContentEvent(
      request,
      userDataForFbevents as UserData,
      customDataFromClient,
      eventSourceUrl,
      eventId,
      urlParametersFromClient
    );

    console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] Facebook Conversions API response:`, JSON.stringify(result, null, 2));

    if (result && result.success) {
      console.log(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] Event processed successfully. fbtrace_id: ${result.fbtrace_id}`);
      return NextResponse.json({ 
        message: 'ViewContent event processed successfully', 
        fbtrace_id: result.fbtrace_id, 
        event_id: eventId,
        success: true
      }, { status: 200, headers: corsHeaders });
    } else {
      console.error(`[${timestamp}] [VIEW_CONTENT_EVENT] [${eventId}] Error processing event:`, result?.error || result?.warning || 'Unknown error');
      return NextResponse.json({ 
        message: 'Error processing ViewContent event', 
        error: result?.error || result?.warning || 'Unknown error', 
        event_id: eventId,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] [VIEW_CONTENT_EVENT_ERROR] [${eventId}] API ViewContent Error:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ 
        message: 'Error processing ViewContent event', 
        error: errorMessage, 
        event_id: eventId, 
        success: false 
    }, { status: 500, headers: corsHeaders });
  }
} 