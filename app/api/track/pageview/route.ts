import { NextRequest, NextResponse } from 'next/server';
import { sendPageViewEvent } from '@/lib/fbevents'; // Assuming fbevents.ts is in src/lib
import type { UserData } from '@/lib/fbevents'; // Import UserData type

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // console.log('[API /pageview_DEBUG] Received request body:', JSON.stringify(body, null, 2));

    const { userDataFromClient, eventSourceUrl, eventId, urlParameters } = body;

    // Tentativa de ler _fbc e _fbp diretamente dos cookies da requisição no servidor
    const fbcFromCookieServer = request.cookies.get('_fbc')?.value;
    const fbpFromCookieServer = request.cookies.get('_fbp')?.value;

    // Construir finalUserData de forma que possa ser const
    const userData: Partial<UserData> = {
      ...userDataFromClient,
      fbc: fbcFromCookieServer && (!userDataFromClient?.fbc || userDataFromClient.fbc !== fbcFromCookieServer) 
           ? fbcFromCookieServer 
           : userDataFromClient?.fbc,
      fbp: fbpFromCookieServer && (!userDataFromClient?.fbp || userDataFromClient.fbp !== fbpFromCookieServer) 
           ? fbpFromCookieServer 
           : userDataFromClient?.fbp,
    };

    if (fbcFromCookieServer && userData.fbc === fbcFromCookieServer) {
      console.log(`[API /pageview_DEBUG] Using _fbc from server cookie: ${fbcFromCookieServer}`);
    } else if (userData.fbc) {
      console.log(`[API /pageview_DEBUG] Using _fbc from client: ${userData.fbc}`);
    } else {
      console.log(`[API /pageview_DEBUG] No _fbc found from client or server cookie.`);
    }

    if (fbpFromCookieServer && userData.fbp === fbpFromCookieServer) {
      console.log(`[API /pageview_DEBUG] Using _fbp from server cookie: ${fbpFromCookieServer}`);
    } else if (userData.fbp) {
      console.log(`[API /pageview_DEBUG] Using _fbp from client: ${userData.fbp}`);
    } else {
      console.log(`[API /pageview_DEBUG] No _fbp found from client or server cookie.`);
    }

    const customData = {}; 

    const result = await sendPageViewEvent(
      request,      
      userData as UserData, // Cast para UserData completo após preenchimento   
      customData,   
      eventSourceUrl, 
      eventId,      
      urlParameters 
    );

    // console.log(`[API /pageview_DEBUG] Result from sendPageViewEvent for Event ID ${eventId}:`, result);

    if (result && result.success) {
      return NextResponse.json({ 
        message: 'PageView event processed successfully', 
        fbtrace_id: result.fbtrace_id, 
        event_id: eventId,
        success: true 
      });
    } else {
      return NextResponse.json({ 
        message: 'Error processing PageView event', 
        error: result?.error || result?.warning || 'Unknown error', 
        event_id: eventId,
        success: false 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('API PageView Error:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Error processing PageView event', error: errorMessage, success: false }, { status: 500 });
  }
} 