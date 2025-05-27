import { NextRequest, NextResponse } from 'next/server';
import { sendViewContentEvent } from '@/lib/fbevents'; // Assuming fbevents.ts is in src/lib

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // console.log('[API /viewcontent] Received request body:', JSON.stringify(body, null, 2)); // Commented out verbose log

    const { userData, customData, eventSourceUrl, eventId, urlParameters } = body;

    if (!customData || !customData.content_name) {
      return NextResponse.json({ message: 'Missing required customData fields for ViewContent.' }, { status: 400 });
    }

    const result = await sendViewContentEvent(
      request,
      userData,
      customData,
      eventSourceUrl,
      eventId,
      urlParameters
    );

    // console.log(`[API /viewcontent] Result from sendViewContentEvent for Event ID ${eventId}:`, result); // Commented out verbose log

    if (result && result.success) {
      return NextResponse.json({ message: 'ViewContent event processed successfully', fbtrace_id: result.fbtrace_id, event_id: eventId });
    } else {
      return NextResponse.json({ message: 'Error processing ViewContent event', error: result?.error || result?.warning || 'Unknown error', event_id: eventId }, { status: 500 });
    }
  } catch (error) {
    console.error('API ViewContent Error:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Error processing ViewContent event', error: errorMessage }, { status: 500 });
  }
} 