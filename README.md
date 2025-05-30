# Facebook Conversions API - Standalone Next.js Service

This project provides a standalone backend service built with Next.js (App Router) to handle Facebook Conversions API (CAPI) events. It allows you to send web events from your server to Facebook, providing more reliable tracking than client-side-only methods.

## Table of Contents

1.  [Project Structure](#project-structure)
2.  [Features](#features)
3.  [Prerequisites](#prerequisites)
4.  [Setup and Installation](#setup-and-installation)
    *   [Cloning the Repository (if applicable)](#cloning-the-repository)
    *   [Environment Variables](#environment-variables)
    *   [Installing Dependencies](#installing-dependencies)
5.  [Running the Application](#running-the-application)
    *   [Development Mode](#development-mode)
    *   [Building for Production](#building-for-production)
    *   [Starting in Production Mode](#starting-in-production-mode)
6.  [API Endpoints](#api-endpoints)
    *   [Event Tracking Endpoints](#event-tracking-endpoints)
        *   [POST /api/track/pageview](#post-apitrackpageview)
        *   [POST /api/track/viewcontent](#post-apitrackviewcontent)
        *   [POST /api/track/initiatecheckout](#post-apitrackinitiatecheckout)
        *   [POST /api/track/lead](#post-apitracklead)
    *   [Webhook Endpoints](#webhook-endpoints)
        *   [POST /api/webhooks/cakto](#post-apiwebhookscakto)
        *   [POST /api/webhooks/kiwify](#post-apiwebhookskiwify)
7.  [Frontend Integration Guide](#frontend-integration-guide)
    *   [Key Considerations](#key-considerations)
    *   [Example: Vanilla JavaScript for PageView](#example-vanilla-javascript-for-pageview)
    *   [Example: Sending Other Standard Events (e.g., ViewContent)](#example-sending-other-standard-events-eg-viewcontent)
8.  [Important Notes](#important-notes)
    *   [Data Hashing](#data-hashing)
    *   [Facebook Click ID (`fbclid` / `fbc`) Handling](#facebook-click-id-fbclid-fbc-handling)
    *   [User Consent](#user-consent)
    *   [Event Deduplication](#event-deduplication)
9.  [Further Development](#further-development)

## Project Structure

```
.
├── app/                      # Next.js App Router directory
│   ├── api/                  # API route handlers
│   │   ├── track/            # Endpoints for tracking standard Facebook events
│   │   │   ├── pageview/
│   │   │   │   └── route.ts
│   │   │   ├── viewcontent/
│   │   │   │   └── route.ts
│   │   │   ├── initiatecheckout/
│   │   │   │   └── route.ts
│   │   │   └── lead/
│   │   │       └── route.ts
│   │   └── webhooks/         # Endpoints for receiving webhooks from third-party services
│   │       ├── cakto/
│   │       │   └── route.ts
│   │       └── kiwify/
│   │           └── route.ts
│   ├── layout.tsx            # Root layout for the application
│   └── page.tsx              # Root page of the application (simple API status page)
├── client_side_reference/    # Example client-side code
│   └── FacebookPixelHandler.ts # Reference React component for client-side event handling
├── lib/                      # Core logic and utilities
│   ├── fbevents.ts           # Main logic for sending events to Facebook CAPI
│   └── utils.ts              # Utility functions (currently has a 'cn' function)
├── public/                   # Static assets (if any, typically not primary for a pure API)
├── .env.example              # Example environment variables file
├── .gitignore                # Specifies intentionally untracked files that Git should ignore
├── next.config.js            # Next.js configuration file
├── package.json              # Project metadata, dependencies, and scripts
├── tsconfig.json             # TypeScript configuration file
└── README.md                 # This file
```

## Features

*   Handles standard Facebook events: `PageView`, `ViewContent`, `InitiateCheckout`, `Lead`.
*   Webhook endpoints for `Cakto` and `Kiwify` (Kiwify is a placeholder).
*   Built with Next.js App Router for modern API routing.
*   Written in TypeScript.
*   Uses Facebook Conversions API for server-side event tracking.

## Prerequisites

*   Node.js (v18 or later recommended)
*   npm, yarn, or pnpm
*   A Facebook Pixel ID
*   A Facebook System User Access Token with `ads_management` permission for the associated Ad Account.

## Setup and Installation

### Cloning the Repository (if applicable)
If you have this project in a Git repository:
```bash
git clone <your-repository-url>
cd <project-directory>
```

### Environment Variables
This project requires environment variables for Facebook API credentials, CORS configuration, and potentially webhook secrets and geolocation services.

1.  **Create `.env.local` file:**
    Copy the `.env.example` file (if it doesn't exist, create one based on the template below) to a new file named `.env.local` in the project root.
    ```bash
    cp .env.example .env.local
    ```

2.  **Content for `.env.example` / `.env.local`:**
    ```env
    # Facebook Conversions API Credentials
    # Note: The application code in lib/fbevents.ts currently uses process.env.FACEBOOK_DATASET_ID.
    # If you set FACEBOOK_PIXEL_ID here, ensure lib/fbevents.ts is updated to use it,
    # or set FACEBOOK_DATASET_ID instead with your Pixel ID.
    FACEBOOK_PIXEL_ID=YOUR_PIXEL_ID_HERE
    # FACEBOOK_DATASET_ID=YOUR_PIXEL_ID_HERE_IF_NOT_CHANGING_FBEVENTS_TS
    FACEBOOK_ACCESS_TOKEN=YOUR_SYSTEM_USER_ACCESS_TOKEN_HERE

    # (Optional) Test Event Code for Facebook Events Manager
    # Use this if you want to send test events that appear only in the Facebook Events Manager testing tool.
    # FACEBOOK_TEST_EVENT_CODE=YOUR_TEST_EVENT_CODE_HERE

    # CORS Configuration
    # Specify the allowed origin for API requests (e.g., your website's domain)
    # IMPORTANT: Do NOT include a trailing slash. Example: https://www.yourdomain.com
    ALLOWED_ORIGIN=https://yourfrontenddomain.com

    # Geolocation API Key (Optional, but recommended for better event matching)
    # Used by lib/fbevents.ts to enrich user data with city, state, postal code, and country.
    # Create an account at ipdata.co (they have a free tier) and get your API key.
    IPDATA_API_KEY=YOUR_IPDATA_CO_API_KEY

    # Webhook Verification Tokens (if your webhooks use shared secrets for verification)
    # KIWIFY_WEBHOOK_SECRET=YOUR_KIWIFY_SECRET_IF_ANY
    # CAKTO_WEBHOOK_SECRET=YOUR_CAKTO_SECRET_IF_ANY

    # Add any other environment variables your application might need
    # NODE_ENV=development
    ```

3.  **Fill in your credentials and configurations** in `.env.local`.
    *   `FACEBOOK_PIXEL_ID` (or `FACEBOOK_DATASET_ID`): Your Facebook Pixel ID. (See note above).
    *   `FACEBOOK_ACCESS_TOKEN`: Your System User Access Token for the Conversions API.
    *   `ALLOWED_ORIGIN`: The domain of your frontend making requests to this API (e.g., `https://www.yourwebsite.com`). **Do not include a trailing slash.**
    *   `IPDATA_API_KEY`: Your API key from ipdata.co for geolocation.
    *   `FACEBOOK_TEST_EVENT_CODE` (Optional).
    *   Webhook secrets (Optional).

    **Important:** `.env.local` is listed in `.gitignore` and should NOT be committed to your repository.

### Installing Dependencies
Navigate to the project root directory in your terminal and run:
```bash
npm install
# or
yarn install
# or
pnpm install
```
This will install all the dependencies listed in `package.json`.

## Running the Application

### Development Mode
To run the application in development mode with hot-reloading:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```
The API will typically be available at `http://localhost:3000`. The root page will show a simple status message.

### Building for Production
To create an optimized production build:
```bash
npm run build
# or
yarn build
# or
pnpm build
```
This will create a `.next` directory with the production build.

### Starting in Production Mode
After building, to start the application in production mode:
```bash
npm run start
# or
yarn start
# or
pnpm start
```

## API Endpoints

All event tracking and webhook endpoints expect `POST` requests with a JSON body.

### Event Tracking Endpoints

These endpoints are designed to be called by your frontend or another backend service to record user interactions.

#### `POST /api/track/pageview`
Tracks a page view event.

**Request Body (JSON):**
```json
{
  "eventId": "EVENT_ID_UNIQUE_PER_EVENT",
  "userData": {
    "em": ["hashed_email@example.com"], // Hashed lowercase email
    "ph": ["hashed_phone_number"],      // Hashed phone number (E.164 format, then hashed)
    "fn": ["hashed_first_name"],        // Hashed lowercase first name
    "ln": ["hashed_last_name"],         // Hashed lowercase last name
    "client_ip_address": "USER_CLIENT_IP_ADDRESS", // e.g., from X-Forwarded-For header
    "client_user_agent": "USER_BROWSER_USER_AGENT",
    "fbc": "fb.1.1554763741205.AbCdEfGhIjKlMnOpQrStUvWxYz", // _fbc cookie value
    "fbp": "fb.1.1558571054389.1098115397",                 // _fbp cookie value
    "external_id": ["USER_UNIQUE_EXTERNAL_ID"]             // Your system's unique user ID
    // Other fields like ge, db, zp, ct, st as per Facebook documentation
  },
  "eventSourceUrl": "FULL_PAGE_URL_WHERE_EVENT_OCCURRED",
  "urlParameters": { // Optional: query parameters from the URL
    "utm_source": "facebook",
    "utm_medium": "cpc"
  },
  "actionSource": "website" // Typically "website" for web events
}
```
*   `eventId`: A unique ID for this specific event instance. Helps with deduplication.
*   `userData`: User data fields. **Hashing PII is crucial.**
*   `eventSourceUrl`: The browser URL where the event happened.
*   `actionSource`: Typically "website".

#### `POST /api/track/viewcontent`
Tracks when a user views key content (e.g., a product page).

**Request Body (JSON):**
```json
{
  "eventId": "EVENT_ID_UNIQUE_PER_EVENT",
  "userData": { /* ... same as PageView ... */ },
  "eventSourceUrl": "FULL_PAGE_URL_WHERE_EVENT_OCCURRED",
  "customData": {
    "content_name": "Specific Product Name",
    "content_category": "Product Category",
    "content_ids": ["SKU12345"], // Array of product SKUs or IDs
    "content_type": "product", // "product" or "product_group"
    "value": 199.99,           // Value of the content/product
    "currency": "USD"          // Currency (e.g., USD, BRL)
  },
  "urlParameters": { /* ... */ },
  "actionSource": "website"
}
```
*   `customData`: Contains event-specific parameters for `ViewContent`.

#### `POST /api/track/initiatecheckout`
Tracks when a user starts the checkout process.

**Request Body (JSON):**
```json
{
  "eventId": "EVENT_ID_UNIQUE_PER_EVENT",
  "userData": { /* ... same as PageView ... */ },
  "eventSourceUrl": "FULL_CHECKOUT_PAGE_URL",
  "customData": {
    "content_category": "Product Category",
    "content_ids": ["SKU123", "SKU456"],
    "content_type": "product",
    "num_items": 2,
    "value": 75.50,
    "currency": "USD"
  },
  "urlParameters": { /* ... */ },
  "actionSource": "website"
}
```
*   `customData`: Contains event-specific parameters for `InitiateCheckout`.

#### `POST /api/track/lead`
Tracks when a user becomes a lead (e.g., fills out a form).

**Request Body (JSON):**
```json
{
  "eventId": "EVENT_ID_UNIQUE_PER_EVENT",
  "userData": {
    "em": ["hashed_email@example.com"], // Hashed lowercase email
    "ph": ["hashed_phone_number"],      // Hashed phone number (E.164 format, then hashed)
    "fn": ["hashed_first_name"],        // Hashed lowercase first name
    "ln": ["hashed_last_name"],         // Hashed lowercase last name
    "client_ip_address": "USER_CLIENT_IP_ADDRESS", // e.g., from X-Forwarded-For header
    "client_user_agent": "USER_BROWSER_USER_AGENT",
    "fbc": "fb.1.1554763741205.AbCdEfGhIjKlMnOpQrStUvWxYz", // _fbc cookie value
    "fbp": "fb.1.1558571054389.1098115397",                 // _fbp cookie value
    "external_id": ["USER_UNIQUE_EXTERNAL_ID"]             // Your system's unique user ID
    // Other fields like ge, db, zp, ct, st as per Facebook documentation
  },
  "eventSourceUrl": "FULL_PAGE_URL_WHERE_EVENT_OCCURRED",
  "urlParameters": { // Optional: query parameters from the URL
    "utm_source": "facebook",
    "utm_medium": "cpc"
  },
  "actionSource": "website" // Typically "website" for web events
}
```
*   `eventId`: A unique ID for this specific event instance. Helps with deduplication.
*   `userData`: User data fields. **Hashing PII is crucial.**
*   `eventSourceUrl`: The browser URL where the event happened.
*   `actionSource`: Typically "website".

### Webhook Endpoints

These endpoints are designed to receive data from third-party services. The logic within these handlers should transform the incoming data into Facebook CAPI events and send them using `lib/fbevents.ts`.

#### `POST /api/webhooks/cakto`
Handles webhooks from Cakto. The current implementation in `app/api/webhooks/cakto/route.ts` should contain the logic to process Cakto events and map them to relevant Facebook CAPI events.

**Request Body (JSON):**
*(Depends on Cakto's webhook payload structure)*

#### `POST /api/webhooks/kiwify`
Placeholder for handling webhooks from Kiwify. You need to implement the logic in `app/api/webhooks/kiwify/route.ts` to process Kiwify events (e.g., purchases, subscriptions) and map them to Facebook CAPI events (e.g., `Purchase`).

**Request Body (JSON):**
*(Depends on Kiwify's webhook payload structure)*

## Frontend Integration Guide

Your frontend (website, single-page application) will be responsible for collecting event data and sending it to the API endpoints of this service.

### Key Considerations:

*   **User Consent:** Always obtain user consent before collecting and sending any data, especially PII.
*   **Data Hashing:** PII (email, phone, name, etc.) **must be hashed (SHA-256)** on the client-side before sending to your API if your API does not perform hashing. Facebook requires hashed data.
*   **`external_id`:** Implement a consistent way to assign a unique `external_id` to users.
*   **Cookies (`_fbc`, `_fbp`):** If you use the Facebook Pixel client-side, these cookies might be available. Reading them can improve event matching.
*   **`eventId`:** Generate a unique ID for every event sent. This is important for potential deduplication.
*   **`eventSourceUrl`:** Always capture the full URL where the event occurred (`window.location.href`).
*   **`client_ip_address` and `client_user_agent`:** These should be captured by the server-side API handler (`route.ts`) from the incoming request if possible, rather than trusted from the client. The `fbevents.ts` likely handles this.

### Example: Vanilla JavaScript for PageView

This script can be included in your website's HTML.

```html
<script>
// Helper function to get cookies
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return undefined;
}

// Helper function to generate a simple UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// --- Hashing function (Example: Implement actual SHA-256 hashing) ---
// It's strongly recommended to use a robust library for SHA-256 hashing.
// This is a placeholder and NOT a secure or correct hashing function.
async function sha256(message) {
  // In a real implementation, use something like:
  // const buffer = new TextEncoder().encode(message);
  // const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  // const hashArray = Array.from(new Uint8Array(hashBuffer));
  // return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  console.warn("SHA-256 hashing should be implemented properly on the client if not done by the backend.");
  return `hashed_${message.toLowerCase().trim()}`; // Placeholder
}
// --- End Hashing function ---

async function sendCapiPageView() {
  const eventId = generateUUID();
  
  // --- User Data Collection (Examples - Adapt to your application) ---
  // IMPORTANT: Obtain consent and handle PII responsibly.
  const userEmail = "test@example.com"; // Raw email from user input or your system
  const userExternalId = "user_abc_123"; // Your system's user ID

  const userDataPayload = {
    em: userEmail ? [await sha256(userEmail)] : undefined, // Hash email
    fbc: getCookie('_fbc') || undefined,
    fbp: getCookie('_fbp') || undefined,
    external_id: userExternalId ? [userExternalId] : undefined,
    // client_ip_address and client_user_agent will be handled by the server
  };
  // Remove undefined fields from userDataPayload to keep payload clean
  Object.keys(userDataPayload).forEach(key => userDataPayload[key] === undefined && delete userDataPayload[key]);


  const payload = {
    eventId: eventId,
    userData: userDataPayload,
    eventSourceUrl: window.location.href,
    urlParameters: Object.fromEntries(new URLSearchParams(window.location.search)),
    actionSource: "website"
  };

  try {
    const response = await fetch('/api/track/pageview', { // Your API endpoint
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const responseData = await response.json();
    if (responseData.success) {
      console.log('CAPI PageView event sent successfully:', eventId);
    } else {
      console.error('Failed to send CAPI PageView event:', responseData.error);
    }
  } catch (error) {
    console.error('Error sending CAPI PageView event:', error);
  }
}

// Call on page load, or for SPAs, on route changes.
window.addEventListener('load', sendCapiPageView);
</script>
```

### Example: Sending Other Standard Events (e.g., ViewContent)

To send other events like `ViewContent` or `InitiateCheckout`, you'll call the respective endpoint (e.g., `/api/track/viewcontent`) and include the `customData` object specific to that event.

```javascript
async function sendCapiViewContent(productDetails) {
  // productDetails = { name: "Cool T-Shirt", id: "SKU001", category: "Apparel", value: 25.99, currency: "USD" }
  const eventId = generateUUID();
  const userEmail = "test@example.com"; // Get from your app's state/auth
  const userExternalId = "user_abc_123";

  const userDataPayload = {
    em: userEmail ? [await sha256(userEmail)] : undefined,
    fbc: getCookie('_fbc') || undefined,
    fbp: getCookie('_fbp') || undefined,
    external_id: userExternalId ? [userExternalId] : undefined,
  };
  Object.keys(userDataPayload).forEach(key => userDataPayload[key] === undefined && delete userDataPayload[key]);

  const payload = {
    eventId: eventId,
    userData: userDataPayload,
    eventSourceUrl: window.location.href,
    customData: {
      content_name: productDetails.name,
      content_ids: [productDetails.id],
      content_type: "product",
      content_category: productDetails.category,
      value: productDetails.value,
      currency: productDetails.currency
    },
    actionSource: "website"
  };

  try {
    const response = await fetch('/api/track/viewcontent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    // ... handle response ...
    console.log('CAPI ViewContent event sent:', payload);
  } catch (error) {
    console.error('Error sending CAPI ViewContent:', error);
  }
}

// Example usage:
// sendCapiViewContent({ name: "My Product", id: "XYZ123", category: "Shoes", value: 99.99, currency: "USD" });
```
**Note on the `sha256` placeholder:** The provided JavaScript `sha256` function is a placeholder. For client-side hashing, use the `SubtleCrypto` API (`crypto.subtle.digest`) available in modern browsers for proper SHA-256 hashing. Ensure the data is normalized (e.g., email to lowercase) before hashing, as expected by Facebook.

## Important Notes

### Data Hashing
Facebook requires Personally Identifiable Information (PII) like email addresses, phone numbers, names, etc., to be hashed using SHA-256 before being sent to them.

**This API service (`lib/fbevents.ts`) automatically handles the SHA-256 hashing of the following PII fields if they are provided in the `userData` object:**
*   `em` (email)
*   `ph` (phone number)
*   `fn` (first name)
*   `ln` (last name)
*   `ge` (gender)
*   `db` (date of birth)
*   `ct` (city)
*   `st` (state/region)
*   `zp` (zip/postal code)
*   `country` (country code)

**Therefore, your client-side integration should send these PII fields raw (not pre-hashed) to this API.** The API will perform the necessary normalization (e.g., lowercase for emails and names, remove non-digits for phones) and hashing before forwarding the data to Facebook.

*Client-side considerations:*
*   Emails: Collect as is (e.g., `test@example.com`).
*   Phone Numbers: Collect in a common format; the server will attempt normalization.
*   Names: Collect as is.

This server-side hashing approach simplifies client-side logic and ensures consistent hashing methodology.

### Facebook Click ID (`fbclid` / `fbc`) Handling
To maximize event match quality, this API service implements robust handling for `fbclid`:
*   **Priority to URL `fbclid`:** The backend prioritizes the `fbclid` value if it's passed by the client in the `urlParameters` field of the request payload. This `fbclid` is used to populate `user_data.fbc`.
*   **Fallback to `customData` (Defensive):** If `fbclid` is not in `urlParameters` but is mistakenly sent by the client within the `customData` object, the backend will attempt to use it for `user_data.fbc` as a fallback.
*   **Cookie `_fbc` Value:** If no `fbclid` is found via URL or client-provided `customData`, the `fbc` value present in the `userData` object (which should originate from the `_fbc` cookie, potentially updated by server-side cookie reading in the API Route) is used.
*   **Cleaning `custom_data`:** In all scenarios, `fbclid` is removed from `urlParameters` and `customData` before any remaining URL parameters (like UTMs) are merged into the final `custom_data` object sent to Facebook. This ensures `fbclid` is not erroneously present in `custom_data`.
*   **No Hashing:** The `user_data.fbc` field is correctly sent广告 (not hashed).

Your client-side integration should send `urlParameters` (containing all current URL query parameters) separately in the payload. The `customData` object sent by the client should only contain data specific to the event itself, not URL parameters like `fbclid` or UTMs.

### User Consent
Always ensure you have explicit user consent before collecting or processing any user data, in compliance with GDPR, CCPA, LGPD, and other relevant privacy regulations.

### Event Deduplication
Facebook uses the `event_name`, `event_id`, and `fbp` (if present) to deduplicate events.
*   If you are sending the same event from both the client-side (Facebook Pixel `fbq.js`) and server-side (this CAPI service), ensure you use the **same `event_id`** for both instances of that specific event occurrence to allow Facebook to deduplicate them correctly.
*   The `client_side_reference/FacebookPixelHandler.ts` contains an example of how one might manage `eventId` for this purpose in a React/Next.js frontend.

## Further Development

*   **Implement Kiwify Webhook Logic:** Add the specific processing logic in `app/api/webhooks/kiwify/route.ts`.
*   **Add More Event Types:** Extend `/api/track/` with handlers for other standard Facebook events (e.g., `AddToCart`, `Purchase`, `CompleteRegistration`) or custom events as needed.
*   **Error Handling and Logging:** Enhance error handling and implement more robust logging (e.g., using a dedicated logging service).
*   **Input Validation:** Add strict input validation to all API endpoints (e.g., using Zod or Joi) to ensure data integrity.
*   **Security:** Review security best practices, especially for webhook signature verification if secrets are used.
*   **Testing:** Implement unit and integration tests for your API endpoints and core logic.

This README should provide a good starting point for understanding, setting up, and using this Facebook Conversions API service. 