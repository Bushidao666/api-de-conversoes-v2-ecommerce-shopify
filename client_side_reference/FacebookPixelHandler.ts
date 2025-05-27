// This file is a client-side React component and is not part of the standalone API.
// It is kept here for reference purposes for potential client implementations.
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation'; // For getting current path and params
// import { getUserExternalId } from '@/utils/userIdentifier'; // Path would need adjustment based on client project structure

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const FacebookPixelHandler = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pageViewSentForPath, setPageViewSentForPath] = useState<string | null>(null);
  const [hasWindowLoaded, setHasWindowLoaded] = useState(false); // New state to track window load

  useEffect(() => {
    const handleLoad = () => {
      setHasWindowLoaded(true);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, []);

  useEffect(() => {
    // Only proceed if the window has loaded
    if (!hasWindowLoaded) {
      return;
    }

    console.log('[PixelHandler_DEBUG] useEffect triggered. Pathname:', pathname, 'SearchParams:', searchParams.toString(), 'Page view sent for:', pageViewSentForPath);
    const currentUrl = `${window.location.origin}${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

    if (typeof window !== 'undefined' && window.fbq && currentUrl !== pageViewSentForPath) {
      const eventId = typeof crypto !== 'undefined' && crypto.randomUUID 
                      ? crypto.randomUUID() 
                      : (() => 
                          'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                            return v.toString(16);
                          })
                        )();

      // 1. Client-side Pixel PageView event with event_id
      window.fbq('track', 'PageView', {}, { eventID: eventId });
      console.log(`[PixelHandler_DEBUG] Client-side fbq("track", "PageView") called. Event ID: ${eventId}`);

      // 2. Server-side CAPI PageView event
      const getCookie = (name: string): string | undefined => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return undefined;
      };
      const fbcCookie = getCookie('_fbc');
      const fbpCookie = getCookie('_fbp');
      // const externalId = getUserExternalId(); // This would be sourced from the client's context
      const externalId = "some_user_id_logic_on_client_side"; // Placeholder

      // Attempt to retrieve lead data from localStorage
      let storedLeadData: { em?: string; ph?: string; fn?: string; ln?: string } | null = null;
      try {
        const leadDataString = localStorage.getItem('linkMagico_leadData');
        if (leadDataString) {
          storedLeadData = JSON.parse(leadDataString);
        }
      } catch (e) {
        console.warn('[PixelHandler_DEBUG] Could not retrieve lead data from localStorage.', e);
      }

      const urlSearchParamsObj = new URLSearchParams(searchParams.toString());
      const capturedUrlParams: { [key: string]: string } = {};
      urlSearchParamsObj.forEach((value, key) => {
        capturedUrlParams[key] = value;
      });
      
      interface PageViewEventPayload {
        eventId: string;
        userData: {
          fbc?: string;
          fbp?: string;
          external_id?: string[];
          em?: string[];
          ph?: string[];
          fn?: string[];
          ln?: string[];
        };
        customData?: { [key: string]: string };
        eventSourceUrl: string;
        urlParameters?: { [key: string]: string };
      }

      const payload: PageViewEventPayload = {
        eventId: eventId,
        userData: { 
          fbc: fbcCookie || undefined,
          fbp: fbpCookie || undefined,
          external_id: externalId ? [externalId] : undefined,
          em: storedLeadData?.em ? [storedLeadData.em] : undefined,
          ph: storedLeadData?.ph ? [storedLeadData.ph] : undefined,
          fn: storedLeadData?.fn ? [storedLeadData.fn] : undefined,
          ln: storedLeadData?.ln ? [storedLeadData.ln] : undefined,
        },
        eventSourceUrl: currentUrl, 
        urlParameters: capturedUrlParams,
      };
      
      fetch('/api/track/pageview', { // This fetch call points to the API endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      .then(response => response.json())
      .then(data => {
        if(data.success) setPageViewSentForPath(currentUrl);
      })
      .catch(error => {
        console.error('[PixelHandler_DEBUG] Failed to send Server-side PageView event:', error);
      });
    }
  }, [pathname, searchParams, pageViewSentForPath, hasWindowLoaded]);

  return null;
};

export default FacebookPixelHandler; 