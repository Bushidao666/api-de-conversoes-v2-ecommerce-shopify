import { NextRequest, NextResponse } from 'next/server';
import { sendPageViewEvent } from '@/lib/fbevents'; // Assuming fbevents.ts is in src/lib
import type { UserData } from '@/lib/fbevents'; // Import UserData type

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  let eventId = 'N/A'; // Initialize eventId for logging

  try {
    console.log(`[${timestamp}] [PAGEVIEW_EVENT] Received event from client`);
    const body = await request.json();
    eventId = body.eventId || eventId; // Update eventId if available in body
    console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Payload:`, JSON.stringify(body, null, 2));

    const { userDataFromClient, eventSourceUrl, urlParameters } = body;

    const clientIp = request.headers.get('x-forwarded-for') || request.ip;
    console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Client IP: ${clientIp || 'Not found'}`);

    let geoData = null;
    if (clientIp) {
      console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Sending IP to geolocation service`);
      // Simulate geolocation call - replace with actual call
      // const geoResponse = await fetch(`https://ipapi.co/${clientIp}/json/`);
      // geoData = await geoResponse.json();
      // console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Geolocation response:`, JSON.stringify(geoData, null, 2));
      // For now, let's use a placeholder as the geolocation service is not yet implemented
      geoData = { city: 'Placeholder City', region: 'Placeholder Region', country_name: 'Placeholder Country', postal: '00000-000' };
      console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Geolocation response (placeholder):`, JSON.stringify(geoData, null, 2));
    } else {
      console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] IP not found, skipping geolocation`);
    }

    const fbcFromCookieServer = request.cookies.get('_fbc')?.value;
    const fbpFromCookieServer = request.cookies.get('_fbp')?.value;

    const userData: Partial<UserData> = {
      ...userDataFromClient,
      client_ip_address: clientIp || undefined, // Add IP address
      // ...(geoData && { // Add geolocation data if available - this will be uncommented when actual geo service is integrated
      //   client_user_agent: request.headers.get('user-agent') || undefined,
      //   ge: { // Assuming 'ge' is the correct field for geolocation in your UserData type
      //     ct: geoData.city,
      //     st: geoData.region,
      //     country: geoData.country_name,
      //   }
      // }),
      fbc: fbcFromCookieServer && (!userDataFromClient?.fbc || userDataFromClient.fbc !== fbcFromCookieServer) 
           ? fbcFromCookieServer 
           : userDataFromClient?.fbc,
      fbp: fbpFromCookieServer && (!userDataFromClient?.fbp || userDataFromClient.fbp !== fbpFromCookieServer) 
           ? fbpFromCookieServer 
           : userDataFromClient?.fbp,
    };
    
    // Add geolocation data if available and update userData - this part will be fully active with actual geo service
    if (geoData) {
        (userData as UserData).ct = [geoData.city]; // Hashed automatically later
        (userData as UserData).st = [geoData.region]; // Hashed automatically later
        (userData as UserData).country = [geoData.country_name]; // Hashed automatically later
        (userData as UserData).zp = [geoData.postal]; // Added postal/zip code
        console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Added geolocation data to UserData:`, JSON.stringify({ city: geoData.city, region: geoData.region, country: geoData.country_name, postal: geoData.postal }, null, 2));
    }


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

    console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] UserData to be sent (before hashing by sendPageViewEvent):`, JSON.stringify(userData, null, 2));
    console.log(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Sending event to Facebook Conversions API`);

    const result = await sendPageViewEvent(
      request,      
      userData as UserData, // Cast para UserData completo após preenchimento   
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
      });
    } else {
      console.error(`[${timestamp}] [PAGEVIEW_EVENT] [${eventId}] Error processing event:`, result?.error || result?.warning || 'Unknown error');
      return NextResponse.json({ 
        message: 'Error processing PageView event', 
        error: result?.error || result?.warning || 'Unknown error', 
        event_id: eventId,
        success: false 
      }, { status: 500 });
    }
  } catch (error) {
    const errorTimestamp = new Date().toISOString(); // Use a new timestamp for the error log
    console.error(`[${errorTimestamp}] [PAGEVIEW_EVENT_ERROR] [${eventId}] API PageView Error:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Error processing PageView event', error: errorMessage, event_id: eventId, success: false }, { status: 500 });
  }
} 