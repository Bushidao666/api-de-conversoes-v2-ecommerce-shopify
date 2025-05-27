import { NextRequest, NextResponse } from 'next/server';
import { sendInitiateCheckoutEvent } from '@/lib/fbevents'; // Assuming fbevents.ts is in src/lib

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // console.log('[API /initiatecheckout] Received request body:', JSON.stringify(body, null, 2)); // Commented out verbose log

    const { userData, customData, eventSourceUrl, eventId, urlParameters } = body;

    // Add specific checks for InitiateCheckout if needed, e.g., customData.value and customData.currency
    if (!customData || typeof customData.value === 'undefined' || !customData.currency) {
        return NextResponse.json({ message: 'Missing required customData fields for InitiateCheckout (e.g., value, currency).' }, { status: 400 });
    }

    const result = await sendInitiateCheckoutEvent(
      request,
      userData,
      customData,
      eventSourceUrl,
      eventId,
      urlParameters
    );

    // console.log(`[API /initiatecheckout] Result from sendInitiateCheckoutEvent for Event ID ${eventId}:`, result); // Commented out verbose log

    if (result && result.success) {
      return NextResponse.json({ message: 'InitiateCheckout event processed successfully', fbtrace_id: result.fbtrace_id, event_id: eventId });
    } else {
      return NextResponse.json({ message: 'Error processing InitiateCheckout event', error: result?.error || result?.warning || 'Unknown error', event_id: eventId }, { status: 500 });
    }
  } catch (error) {
    console.error('API InitiateCheckout Error:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Error processing InitiateCheckout event', error: errorMessage }, { status: 500 });
  }
} 