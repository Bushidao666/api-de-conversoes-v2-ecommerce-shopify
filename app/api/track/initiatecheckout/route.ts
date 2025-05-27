import { NextRequest, NextResponse } from 'next/server';
import { sendInitiateCheckoutEvent } from '@/lib/fbevents'; // Assuming fbevents.ts is in src/lib
import type { UserData } from '@/lib/fbevents'; // Import UserData type

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  let eventId = 'N/A'; // Initialize eventId for logging

  try {
    console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] Received event from client`);
    const body = await request.json();
    eventId = body.eventId || eventId; // Update eventId if available in body
    console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] Payload:`, JSON.stringify(body, null, 2));

    const { userDataFromClient, customData, eventSourceUrl, urlParameters } = body;

    const clientIp = request.headers.get('x-forwarded-for') || request.ip;
    console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] Client IP: ${clientIp || 'Not found'}`);

    let geoData = null;
    if (clientIp) {
      console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] Sending IP to geolocation service`);
      // Simulate geolocation call - replace with actual call
      // const geoResponse = await fetch(`https://ipapi.co/${clientIp}/json/`);
      // geoData = await geoResponse.json();
      // console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] Geolocation response:`, JSON.stringify(geoData, null, 2));
      // For now, let's use a placeholder
      geoData = { city: 'Placeholder City', region: 'Placeholder Region', country_name: 'Placeholder Country', postal: '00000-000' };
      console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] Geolocation response (placeholder):`, JSON.stringify(geoData, null, 2));
    } else {
      console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] IP not found, skipping geolocation`);
    }

    const fbcFromCookieServer = request.cookies.get('_fbc')?.value;
    const fbpFromCookieServer = request.cookies.get('_fbp')?.value;

    const userData: Partial<UserData> = {
      ...userDataFromClient,
      client_ip_address: clientIp || undefined,
      fbc: fbcFromCookieServer && (!userDataFromClient?.fbc || userDataFromClient.fbc !== fbcFromCookieServer) 
           ? fbcFromCookieServer 
           : userDataFromClient?.fbc,
      fbp: fbpFromCookieServer && (!userDataFromClient?.fbp || userDataFromClient.fbp !== fbpFromCookieServer) 
           ? fbpFromCookieServer 
           : userDataFromClient?.fbp,
    };

    if (geoData) {
        (userData as UserData).ct = [geoData.city];
        (userData as UserData).st = [geoData.region];
        (userData as UserData).country = [geoData.country_name];
        (userData as UserData).zp = [geoData.postal];
        console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] Added geolocation data to UserData:`, JSON.stringify({ city: geoData.city, region: geoData.region, country: geoData.country_name, postal: geoData.postal }, null, 2));
    }

    // console.log('[API /initiatecheckout] Received request body:', JSON.stringify(body, null, 2)); // Commented out verbose log

    // Add specific checks for InitiateCheckout if needed, e.g., customData.value and customData.currency
    if (!customData || typeof customData.value === 'undefined' || !customData.currency) {
        console.warn(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] Missing required customData fields (value, currency). Request body:`, JSON.stringify(customData, null, 2));
        return NextResponse.json({ message: 'Missing required customData fields for InitiateCheckout (e.g., value, currency).' }, { status: 400 });
    }

    console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] UserData to be sent (before hashing by sendInitiateCheckoutEvent):`, JSON.stringify(userData, null, 2));
    console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] CustomData to be sent:`, JSON.stringify(customData, null, 2));
    console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] Sending event to Facebook Conversions API`);

    const result = await sendInitiateCheckoutEvent(
      request,
      userData as UserData,
      customData,
      eventSourceUrl,
      eventId,
      urlParameters
    );

    console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] Facebook Conversions API response:`, JSON.stringify(result, null, 2));
    // console.log(`[API /initiatecheckout] Result from sendInitiateCheckoutEvent for Event ID ${eventId}:`, result); // Commented out verbose log

    if (result && result.success) {
      console.log(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] Event processed successfully. fbtrace_id: ${result.fbtrace_id}`);
      return NextResponse.json({ 
        message: 'InitiateCheckout event processed successfully', 
        fbtrace_id: result.fbtrace_id, 
        event_id: eventId,
        success: true
      });
    } else {
      console.error(`[${timestamp}] [INITIATE_CHECKOUT_EVENT] [${eventId}] Error processing event:`, result?.error || result?.warning || 'Unknown error');
      return NextResponse.json({ 
        message: 'Error processing InitiateCheckout event', 
        error: result?.error || result?.warning || 'Unknown error', 
        event_id: eventId,
        success: false
      }, { status: 500 });
    }
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] [INITIATE_CHECKOUT_EVENT_ERROR] [${eventId}] API InitiateCheckout Error:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Error processing InitiateCheckout event', error: errorMessage, event_id: eventId, success: false }, { status: 500 });
  }
} 