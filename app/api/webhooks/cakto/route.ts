import { NextRequest, NextResponse } from 'next/server';
import { sendServerEvent, getGeolocationData, UserData, CustomData } from '@/lib/fbevents'; 

// const CAKTO_WEBHOOK_SECRET = process.env.CAKTO_WEBHOOK_SECRET;
// const CAKTO_SECRET_HEADER_NAME = 'x-cakto-secret'; // !!! VERIFIQUE ESTE NOME NA DOCUMENTAÇÃO DA CAKTO !!!

// TODO: Implementar verificação de assinatura do webhook para segurança usando CAKTO_WEBHOOK_SECRET
// const CAKTO_WEBHOOK_SECRET = process.env.CAKTO_WEBHOOK_SECRET;
// const CAKTO_PROVIDED_SECRET = request.headers.get('cakto-secret'); // Exemplo, verifique o header correto

export async function POST(request: NextRequest) {
  try {
    // !!! A VERIFICAÇÃO DE SEGURANÇA DO WEBHOOK FOI TEMPORARIAMENTE REMOVIDA PARA TESTES !!!
    // !!! É ALTAMENTE RECOMENDADO REATIVAR UMA FORMA DE VERIFICAÇÃO EM PRODUÇÃO !!!
    // const providedSecret = request.headers.get(CAKTO_SECRET_HEADER_NAME);
    // if (!CAKTO_WEBHOOK_SECRET) {
    //   console.error('[CaktoWebhook_ERROR] CAKTO_WEBHOOK_SECRET is not configured in environment variables.');
    //   return NextResponse.json({ message: 'Webhook secret not configured on server.' }, { status: 500 });
    // }
    // if (providedSecret !== CAKTO_WEBHOOK_SECRET) {
    //   console.warn(`[CaktoWebhook_WARN] Invalid webhook secret received. Header: ${CAKTO_SECRET_HEADER_NAME}, Expected: ${CAKTO_WEBHOOK_SECRET}, Got: ${providedSecret}`);
    //   return NextResponse.json({ message: 'Invalid webhook signature' }, { status: 403 });
    // }

    const caktoPayload = await request.json();
    console.log('[CaktoWebhook_DEBUG] Received webhook payload:', JSON.stringify(caktoPayload, null, 2));

    // Verificar o 'secret' enviado pela Cakto (exemplo básico, implementar verificação de assinatura HMAC se disponível)
    // if (caktoPayload.secret !== CAKTO_WEBHOOK_SECRET) {
    //   console.warn('[CaktoWebhook_WARN] Invalid secret received.');
    //   return NextResponse.json({ message: 'Invalid secret' }, { status: 403 });
    // }

    if (caktoPayload.event !== 'purchase_approved') {
      console.log(`[CaktoWebhook_DEBUG] Received event type ${caktoPayload.event}, skipping.`);
      return NextResponse.json({ message: 'Event type not processed' }, { status: 200 });
    }

    const eventData = caktoPayload.data;
    const customer = eventData.customer;
    
    let firstName = customer.name; // Cakto envia 'name' como nome completo
    let lastName = '';
    if (customer.name) {
        const nameParts = customer.name.trim().split(/\s+/);
        firstName = nameParts.shift() || '';
        lastName = nameParts.join(' ');
    }

    // Parse checkoutUrl para extrair parâmetros de rastreamento
    let externalIdFromUrl: string | undefined = undefined;
    let fbpFromUrl: string | undefined = undefined;
    let fbcFromUrl: string | undefined = undefined;
    const utmsAndOtherParamsFromUrl: { [key: string]: string } = {};

    if (eventData.checkoutUrl) {
      try {
        const checkoutUrlObj = new URL(eventData.checkoutUrl);
        checkoutUrlObj.searchParams.forEach((value, key) => {
          if (key === 's1_extid') externalIdFromUrl = value;
          else if (key === 's2_fbp') fbpFromUrl = value;
          else if (key === 's3_fbc') fbcFromUrl = value;
          else utmsAndOtherParamsFromUrl[key] = value;
        });
        console.log(`[CaktoWebhook_DEBUG] Parsed from checkoutUrl - extId: ${externalIdFromUrl}, fbp: ${fbpFromUrl}, fbc: ${fbcFromUrl}, UTMs & Other:`, utmsAndOtherParamsFromUrl);
      } catch (e) {
        console.warn('[CaktoWebhook_DEBUG] Could not parse checkoutUrl:', eventData.checkoutUrl, e);
      }
    }
    
    // Fallback para fbp e fbc dos campos diretos da Cakto se não vierem na URL parseada
    const finalFbp = fbpFromUrl || eventData.fbp;
    const finalFbc = fbcFromUrl || eventData.fbc; // Cakto também pode ter um campo fbc direto

    const fbcFromWebhook = eventData.s3_fbc;

    console.log(`[CaktoWebhook_DEBUG] Custom tracking: extId=${externalIdFromUrl}, fbp=${fbpFromUrl}, fbc=${fbcFromWebhook}`);

    // Obter dados de geolocalização usando o IP do cliente do payload da Cakto
    let geoData: Partial<UserData> = {};
    if (customer.ip) {
        console.log(`[CaktoWebhook_DEBUG] Fetching geo for customer IP: ${customer.ip}`);
        geoData = await getGeolocationData(customer.ip);
        console.log(`[CaktoWebhook_DEBUG] Geo data for customer IP ${customer.ip}:`, JSON.stringify(geoData, null, 2));
    }

    const userData: Partial<UserData> = {
      em: customer.email ? [customer.email.trim().toLowerCase()] : undefined,
      ph: customer.phone ? [customer.phone.replace(/\D/g, '')] : undefined,
      fn: firstName ? [firstName.trim().toLowerCase()] : undefined,
      ln: lastName ? [lastName.trim().toLowerCase()] : undefined,
      db: customer.birthDate ? [customer.birthDate.replace(/-/g, '')] : undefined, 
      client_ip_address: customer.ip || undefined,
      // client_user_agent: NÃO DISPONÍVEL NO WEBHOOK DA CAKTO
      ct: geoData.ct || (customer.address?.city ? [customer.address.city.trim()] : (customer.city ? [customer.city.trim()] : undefined)),
      st: geoData.st || (customer.address?.state ? [customer.address.state.trim().toUpperCase()] : (customer.state ? [customer.state.trim().toUpperCase()] : undefined)),
      zp: geoData.zp || (customer.address?.zipcode ? [customer.address.zipcode.replace(/\D/g, '')] : (customer.zipcode ? [customer.zipcode.replace(/\D/g, '')] : undefined)),
      country: geoData.country || (customer.address?.country_code ? [customer.address.country_code.toLowerCase()] : (customer.country_code ? [customer.country_code.toLowerCase()] : undefined)),
      external_id: externalIdFromUrl ? [externalIdFromUrl] : undefined,
      fbp: finalFbp || undefined,
      fbc: finalFbc || undefined,
    };

    const product = eventData.product;
    const offer = eventData.offer;

    const customData: CustomData = {
      value: parseFloat(eventData.amount.toString()), // Cakto envia como número
      currency: 'BRL', // Assumindo BRL, Cakto não especifica no payload de exemplo
      order_id: eventData.id,
      content_name: product.name,
      content_ids: [product.id],
      contents: [{
        id: product.id,
        quantity: 1, 
        item_price: parseFloat(offer.price.toString())
      }],
      num_items: 1,
      payment_method: eventData.paymentMethod, // Novo campo customizado
      ...utmsAndOtherParamsFromUrl, // Adiciona UTMs parseados da checkoutUrl
      // Adicionar outros UTMs ou tracking params que a Cakto possa fornecer diretamente em eventData, se diferente dos da URL
      ...(eventData.utm_source && !utmsAndOtherParamsFromUrl.utm_source && { utm_source: eventData.utm_source }),
      ...(eventData.utm_medium && !utmsAndOtherParamsFromUrl.utm_medium && { utm_medium: eventData.utm_medium }),
      ...(eventData.utm_campaign && !utmsAndOtherParamsFromUrl.utm_campaign && { utm_campaign: eventData.utm_campaign }),
      ...(eventData.utm_content && !utmsAndOtherParamsFromUrl.utm_content && { utm_content: eventData.utm_content }),
      ...(eventData.utm_term && !utmsAndOtherParamsFromUrl.utm_term && { utm_term: eventData.utm_term }),
    };
    
    // Limpar customData de quaisquer chaves com valor null ou string vazia que possam ter vindo de utmsAndOtherParamsFromUrl ou eventData
    Object.keys(customData).forEach(key => {
      const k = key as keyof CustomData;
      if (customData[k] === null || customData[k] === '') {
        delete customData[k];
      }
    });

    const eventTime = Math.floor(new Date(eventData.paidAt).getTime() / 1000);
    const eventId = eventData.id;

    console.log('[CaktoWebhook_DEBUG] Final UserData for Purchase (pre-hash):', JSON.stringify(userData, null, 2));
    console.log('[CaktoWebhook_DEBUG] Final CustomData for Purchase:', JSON.stringify(customData, null, 2));

    // A request NextRequest aqui é a requisição do webhook da Cakto para seu servidor.
    // sendServerEvent usará o IP desta requisição (IP do servidor da Cakto) se userData.client_ip_address não for setado.
    // Como estamos setando userData.client_ip_address com customer.ip (IP do cliente no checkout da Cakto), isso será usado.
    const result = await sendServerEvent(
      'Purchase',
      request, 
      userData as UserData, 
      customData,
      eventData.checkoutUrl, 
      eventId,
      undefined, // urlParameters não são necessários aqui, pois os UTMs etc. já foram adicionados a customData
      eventTime
    );

    if (result && result.success) {
      return NextResponse.json({ message: 'Cakto Purchase event processed successfully', fbtrace_id: result.fbtrace_id, event_id: eventId, success: true });
    } else {
      return NextResponse.json({ message: 'Error processing Cakto Purchase event', error: result?.error || result?.warning || 'Unknown error', event_id: eventId, success: false }, { status: 500 });
    }

  } catch (error) {
    console.error('[CaktoWebhook_ERROR] Error processing Cakto webhook:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Error processing Cakto webhook', error: errorMessage, success: false }, { status: 500 });
  }
} 