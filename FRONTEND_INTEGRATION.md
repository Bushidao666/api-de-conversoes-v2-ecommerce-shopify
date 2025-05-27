# Frontend Integration Guide - Facebook Conversions API

Este documento fornece exemplos práticos e completos de como integrar qualquer site HTML/CSS/JavaScript com a API de Conversões do Facebook standalone.

## Índice

1. [Visão Geral](#visão-geral)
2. [Scripts Base Necessários](#scripts-base-necessários)
3. [Configuração Inicial](#configuração-inicial)
4. [Implementação do Evento PageView](#implementação-do-evento-pageview)
5. [Implementação do Evento ViewContent](#implementação-do-evento-viewcontent)
6. [Implementação do Evento InitiateCheckout](#implementação-do-evento-initiatecheckout)
7. [Captura de Dados do Usuário (Lead Form)](#captura-de-dados-do-usuário-lead-form)
8. [Script Completo de Exemplo](#script-completo-de-exemplo)
9. [Integração com Facebook Pixel](#integração-com-facebook-pixel)
10. [Debugging e Monitoramento](#debugging-e-monitoramento)
11. [Considerações de Performance](#considerações-de-performance)

## Visão Geral

A sua API de Conversões do Facebook foi projetada para capturar o máximo de parâmetros possível, incluindo:

- **Identificadores únicos**: `external_id`, `fbp`, `fbc`
- **Dados PII hasheados**: Email, telefone, nome, sobrenome
- **Geolocalização**: Automática via IP (cidade, estado, CEP, país)
- **Parâmetros de rastreamento**: UTMs, fbclid, parâmetros customizados
- **Dados do evento**: Valores, moedas, produtos, etc.

## Scripts Base Necessários

### 1. Utilitários Básicos

Adicione este script no `<head>` do seu HTML:

```html
<script>
// ==============================================
// UTILITÁRIOS BASE PARA FACEBOOK CONVERSIONS API
// ==============================================

// Função para obter cookies
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return undefined;
}

// Função para definir cookies
function setCookie(name, value, days = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

// Função para gerar UUID
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Função para hash SHA-256
async function sha256Hash(message) {
  if (!message) return undefined;
  
  try {
    const msgBuffer = new TextEncoder().encode(message.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Erro no hash SHA-256:', error);
    return undefined;
  }
}

// Função para normalizar telefone (formato brasileiro)
function normalizePhone(phone) {
  if (!phone) return undefined;
  // Remove todos os caracteres não numéricos
  const digits = phone.replace(/\D/g, '');
  // Adiciona +55 se não tiver código do país
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+55${digits}`;
  } else if (digits.length === 10) {
    return `+55${digits}`;
  } else if (digits.length === 13 && digits.startsWith('55')) {
    return `+${digits}`;
  }
  return `+55${digits}`;
}

// Função para obter/gerar external_id
function getExternalId() {
  let externalId = getCookie('fb_external_id');
  if (!externalId) {
    externalId = generateUUID();
    setCookie('fb_external_id', externalId, 365); // Cookie válido por 1 ano
  }
  return externalId;
}

// Função para obter parâmetros da URL
function getUrlParameters() {
  const params = {};
  const urlParams = new URLSearchParams(window.location.search);
  for (const [key, value] of urlParams) {
    params[key] = value;
  }
  return params;
}

// Função para obter e processar fbclid
function getFbclid() {
  const urlParams = getUrlParameters();
  return urlParams.fbclid || undefined;
}
</script>
```

## Configuração Inicial

### 2. Inicialização ao Carregar a Página

```html
<script>
// ==============================================
// INICIALIZAÇÃO E CONFIGURAÇÃO
// ==============================================

// Configurações da API
const API_BASE_URL = ''; // Deixe vazio se a API estiver no mesmo domínio, ou coloque a URL completa
const FACEBOOK_CONVERSIONS_CONFIG = {
  currency: 'BRL', // Moeda padrão
  debugMode: false, // Ative para logs detalhados
};

// Dados do usuário global (será preenchido conforme o usuário interage)
let globalUserData = {
  external_id: getExternalId(),
  fbp: getCookie('_fbp'),
  fbc: getCookie('_fbc') || getFbclid(),
  em: undefined, // Email hasheado
  ph: undefined, // Telefone hasheado
  fn: undefined, // Nome hasheado
  ln: undefined, // Sobrenome hasheado
};

// Função para atualizar dados do usuário
function updateUserData(newData) {
  Object.assign(globalUserData, newData);
  // Salva no localStorage para persistir entre páginas
  localStorage.setItem('fb_user_data', JSON.stringify(globalUserData));
}

// Função para carregar dados do usuário do localStorage
function loadUserData() {
  try {
    const stored = localStorage.getItem('fb_user_data');
    if (stored) {
      const data = JSON.parse(stored);
      Object.assign(globalUserData, data);
    }
  } catch (error) {
    console.error('Erro ao carregar dados do usuário:', error);
  }
}

// Função para log de debug
function debugLog(message, data) {
  if (FACEBOOK_CONVERSIONS_CONFIG.debugMode) {
    console.log(`[FB CONVERSIONS] ${message}`, data);
  }
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  loadUserData();
  debugLog('Sistema inicializado', globalUserData);
});
</script>
```

## Implementação do Evento PageView

### 3. Evento PageView Automático

```html
<script>
// ==============================================
// EVENTO PAGEVIEW
// ==============================================

async function sendPageViewEvent() {
  const eventId = generateUUID();
  const urlParameters = getUrlParameters();
  
  // Se há fbclid na URL, atualiza o fbc
  const fbclid = getFbclid();
  if (fbclid) {
    globalUserData.fbc = fbclid;
    updateUserData({ fbc: fbclid });
  }

  const payload = {
    eventId: eventId,
    userData: {
      external_id: globalUserData.external_id ? [globalUserData.external_id] : undefined,
      em: globalUserData.em ? [globalUserData.em] : undefined,
      ph: globalUserData.ph ? [globalUserData.ph] : undefined,
      fn: globalUserData.fn ? [globalUserData.fn] : undefined,
      ln: globalUserData.ln ? [globalUserData.ln] : undefined,
      fbc: globalUserData.fbc || undefined,
      fbp: globalUserData.fbp || undefined,
    },
    eventSourceUrl: window.location.href,
    urlParameters: urlParameters,
    actionSource: 'website'
  };

  // Remove campos undefined
  Object.keys(payload.userData).forEach(key => {
    if (payload.userData[key] === undefined) {
      delete payload.userData[key];
    }
  });

  try {
    debugLog('Enviando PageView', payload);
    
    const response = await fetch(`${API_BASE_URL}/api/track/pageview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (result.message && result.message.includes('successfully')) {
      debugLog('PageView enviado com sucesso', { eventId, fbtrace_id: result.fbtrace_id });
    } else {
      console.error('Erro no PageView:', result);
    }
  } catch (error) {
    console.error('Erro ao enviar PageView:', error);
  }
}

// Enviar PageView quando a página carregar
window.addEventListener('load', function() {
  // Pequeno delay para garantir que tudo foi inicializado
  setTimeout(sendPageViewEvent, 100);
});
</script>
```

## Implementação do Evento ViewContent

### 4. Evento ViewContent para Páginas de Produto

```html
<script>
// ==============================================
// EVENTO VIEWCONTENT
// ==============================================

async function sendViewContentEvent(productData) {
  const eventId = generateUUID();
  const urlParameters = getUrlParameters();

  const customData = {
    content_name: productData.name,
    content_category: productData.category || 'Produto',
    content_ids: [productData.id || productData.sku || 'produto'],
    content_type: 'product',
    contents: [{
      id: productData.id || productData.sku || 'produto',
      quantity: 1,
      item_price: productData.price || 0
    }],
    value: productData.price || 0,
    currency: FACEBOOK_CONVERSIONS_CONFIG.currency,
    num_items: 1
  };

  const payload = {
    eventId: eventId,
    userData: {
      external_id: globalUserData.external_id ? [globalUserData.external_id] : undefined,
      em: globalUserData.em ? [globalUserData.em] : undefined,
      ph: globalUserData.ph ? [globalUserData.ph] : undefined,
      fn: globalUserData.fn ? [globalUserData.fn] : undefined,
      ln: globalUserData.ln ? [globalUserData.ln] : undefined,
      fbc: globalUserData.fbc || undefined,
      fbp: globalUserData.fbp || undefined,
    },
    customData: customData,
    eventSourceUrl: window.location.href,
    urlParameters: urlParameters,
    actionSource: 'website'
  };

  // Remove campos undefined
  Object.keys(payload.userData).forEach(key => {
    if (payload.userData[key] === undefined) {
      delete payload.userData[key];
    }
  });

  try {
    debugLog('Enviando ViewContent', payload);
    
    const response = await fetch(`${API_BASE_URL}/api/track/viewcontent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (result.message && result.message.includes('successfully')) {
      debugLog('ViewContent enviado com sucesso', { eventId, fbtrace_id: result.fbtrace_id });
    } else {
      console.error('Erro no ViewContent:', result);
    }
  } catch (error) {
    console.error('Erro ao enviar ViewContent:', error);
  }
}

// Exemplo de uso para uma página de produto
// Chame esta função quando o usuário visualizar um produto específico
function trackProductView() {
  const productData = {
    name: 'Nome do Produto', // Substitua pelos dados reais
    category: 'Categoria do Produto',
    id: 'SKU_001',
    price: 197.00
  };
  
  sendViewContentEvent(productData);
}

// Auto-track se estiver em uma página de produto
// Adapte esta lógica conforme sua estrutura de página
document.addEventListener('DOMContentLoaded', function() {
  // Exemplo: se a URL contém '/produto/' ou há um elemento específico
  if (window.location.pathname.includes('/produto/') || document.querySelector('.produto-detalhes')) {
    setTimeout(trackProductView, 500);
  }
});
</script>
```

## Implementação do Evento InitiateCheckout

### 5. Evento InitiateCheckout

```html
<script>
// ==============================================
// EVENTO INITIATECHECKOUT
// ==============================================

async function sendInitiateCheckoutEvent(checkoutData) {
  const eventId = generateUUID();
  const urlParameters = getUrlParameters();

  const customData = {
    content_name: checkoutData.productName || 'Checkout',
    content_category: checkoutData.category || 'Produto',
    content_ids: checkoutData.productIds || ['checkout'],
    content_type: 'product',
    contents: checkoutData.contents || [{
      id: 'checkout',
      quantity: 1,
      item_price: checkoutData.value || 0
    }],
    value: checkoutData.value || 0,
    currency: checkoutData.currency || FACEBOOK_CONVERSIONS_CONFIG.currency,
    num_items: checkoutData.numItems || 1
  };

  const payload = {
    eventId: eventId,
    userData: {
      external_id: globalUserData.external_id ? [globalUserData.external_id] : undefined,
      em: globalUserData.em ? [globalUserData.em] : undefined,
      ph: globalUserData.ph ? [globalUserData.ph] : undefined,
      fn: globalUserData.fn ? [globalUserData.fn] : undefined,
      ln: globalUserData.ln ? [globalUserData.ln] : undefined,
      fbc: globalUserData.fbc || undefined,
      fbp: globalUserData.fbp || undefined,
    },
    customData: customData,
    eventSourceUrl: window.location.href,
    urlParameters: urlParameters,
    actionSource: 'website'
  };

  // Remove campos undefined
  Object.keys(payload.userData).forEach(key => {
    if (payload.userData[key] === undefined) {
      delete payload.userData[key];
    }
  });

  try {
    debugLog('Enviando InitiateCheckout', payload);
    
    const response = await fetch(`${API_BASE_URL}/api/track/initiatecheckout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (result.message && result.message.includes('successfully')) {
      debugLog('InitiateCheckout enviado com sucesso', { eventId, fbtrace_id: result.fbtrace_id });
      return eventId; // Retorna o eventId para possível uso posterior
    } else {
      console.error('Erro no InitiateCheckout:', result);
    }
  } catch (error) {
    console.error('Erro ao enviar InitiateCheckout:', error);
  }
}

// Função para rastrear início de checkout
function trackCheckoutStart(checkoutData = {}) {
  const defaultCheckoutData = {
    productName: 'Produto Principal',
    category: 'Digital',
    productIds: ['produto-principal'],
    value: 197.00,
    currency: 'BRL',
    numItems: 1,
    contents: [{
      id: 'produto-principal',
      quantity: 1,
      item_price: 197.00
    }]
  };
  
  const finalCheckoutData = { ...defaultCheckoutData, ...checkoutData };
  return sendInitiateCheckoutEvent(finalCheckoutData);
}
</script>
```

## Captura de Dados do Usuário (Lead Form)

### 6. Formulário de Captura de Leads

```html
<!-- HTML do formulário -->
<form id="leadForm" class="lead-form">
  <div class="form-group">
    <label for="fullName">Nome Completo:</label>
    <input type="text" id="fullName" name="fullName" required>
  </div>
  
  <div class="form-group">
    <label for="email">Email:</label>
    <input type="email" id="email" name="email" required>
  </div>
  
  <div class="form-group">
    <label for="phone">Telefone:</label>
    <input type="tel" id="phone" name="phone" required>
  </div>
  
  <button type="submit">Continuar para Checkout</button>
</form>

<script>
// ==============================================
// CAPTURA DE DADOS DO USUÁRIO
// ==============================================

async function processLeadForm(formData) {
  // Normalizar e hashear os dados
  const fullName = formData.fullName.trim();
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || firstName;
  
  const normalizedPhone = normalizePhone(formData.phone);
  
  // Hashear os dados PII
  const hashedData = {
    em: await sha256Hash(formData.email),
    ph: await sha256Hash(normalizedPhone),
    fn: await sha256Hash(firstName),
    ln: await sha256Hash(lastName)
  };

  // Atualizar dados globais do usuário
  updateUserData(hashedData);
  
  debugLog('Dados do usuário atualizados', hashedData);
  
  return hashedData;
}

// Handler do formulário
document.getElementById('leadForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const formData = {
    fullName: document.getElementById('fullName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value
  };
  
  try {
    // Processar dados do formulário
    await processLeadForm(formData);
    
    // Enviar evento InitiateCheckout com os dados atualizados
    const eventId = await trackCheckoutStart();
    
    // Redirecionar para checkout ou próxima etapa
    // Exemplo: construir URL da Cakto com parâmetros de rastreamento
    const checkoutUrl = buildCheckoutUrl(formData, eventId);
    
    debugLog('Redirecionando para checkout', checkoutUrl);
    window.location.href = checkoutUrl;
    
  } catch (error) {
    console.error('Erro ao processar formulário:', error);
    alert('Erro ao processar dados. Tente novamente.');
  }
});

// Função para construir URL de checkout (exemplo para Cakto)
function buildCheckoutUrl(formData, eventId) {
  const baseUrl = 'https://checkout.cakto.com.br/seu-produto';
  const params = new URLSearchParams();
  
  // Dados do cliente
  params.append('name', formData.fullName);
  params.append('email', formData.email);
  params.append('confirmEmail', formData.email);
  params.append('phone', formData.phone);
  
  // Parâmetros de rastreamento
  params.append('s1_extid', globalUserData.external_id);
  if (globalUserData.fbp) params.append('s2_fbp', globalUserData.fbp);
  if (globalUserData.fbc) params.append('s3_fbc', globalUserData.fbc);
  
  // UTMs (se existirem)
  const urlParams = getUrlParameters();
  if (urlParams.utm_source) params.append('utm_source', urlParams.utm_source);
  if (urlParams.utm_medium) params.append('utm_medium', urlParams.utm_medium);
  if (urlParams.utm_campaign) params.append('utm_campaign', urlParams.utm_campaign);
  if (urlParams.utm_content) params.append('utm_content', urlParams.utm_content);
  if (urlParams.utm_term) params.append('utm_term', urlParams.utm_term);
  
  return `${baseUrl}?${params.toString()}`;
}
</script>
```

## Script Completo de Exemplo

### 7. Implementação Completa em Uma Página

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exemplo - Facebook Conversions API</title>
  
  <!-- Facebook Pixel (Opcional - para deduplicação) -->
  <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', 'SEU_PIXEL_ID'); // Substitua pelo seu Pixel ID
    fbq('track', 'PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=SEU_PIXEL_ID&ev=PageView&noscript=1"
  /></noscript>
  
  <!-- Utilitários Base -->
  <script>
    // Cole aqui todos os scripts utilitários dos exemplos anteriores
    // (getCookie, setCookie, generateUUID, sha256Hash, etc.)
  </script>
</head>
<body>
  <h1>Página de Vendas - Exemplo</h1>
  
  <!-- Seção do produto -->
  <div class="produto-detalhes">
    <h2>Produto Incrível</h2>
    <p>Preço: R$ 197,00</p>
    <button onclick="trackProductView()">Ver Detalhes</button>
  </div>
  
  <!-- Formulário de captura -->
  <form id="leadForm">
    <!-- HTML do formulário do exemplo anterior -->
  </form>

  <!-- Scripts de eventos -->
  <script>
    // ==============================================
    // CONFIGURAÇÃO E INICIALIZAÇÃO
    // ==============================================
    
    const API_BASE_URL = ''; // Sua URL da API
    const FACEBOOK_CONVERSIONS_CONFIG = {
      currency: 'BRL',
      debugMode: true, // Ative para desenvolvimento
    };

    let globalUserData = {
      external_id: getExternalId(),
      fbp: getCookie('_fbp'),
      fbc: getCookie('_fbc') || getFbclid(),
      em: undefined,
      ph: undefined,
      fn: undefined,
      ln: undefined,
    };

    // Cole aqui todas as funções dos exemplos anteriores:
    // - sendPageViewEvent()
    // - sendViewContentEvent()
    // - sendInitiateCheckoutEvent()
    // - processLeadForm()
    // - Handlers de eventos

    // ==============================================
    // INICIALIZAÇÃO AUTOMÁTICA
    // ==============================================
    
    document.addEventListener('DOMContentLoaded', function() {
      loadUserData();
      debugLog('Sistema inicializado', globalUserData);
      
      // Configurar handlers de eventos
      setupEventHandlers();
    });

    window.addEventListener('load', function() {
      setTimeout(sendPageViewEvent, 100);
      
      // Se estiver em página de produto, enviar ViewContent
      if (document.querySelector('.produto-detalhes')) {
        setTimeout(trackProductView, 500);
      }
    });

    function setupEventHandlers() {
      // Handler do formulário
      const leadForm = document.getElementById('leadForm');
      if (leadForm) {
        leadForm.addEventListener('submit', async function(e) {
          e.preventDefault();
          // Lógica do formulário aqui
        });
      }
      
      // Outros handlers conforme necessário
    }
  </script>
</body>
</html>
```

## Integração com Facebook Pixel

### 8. Deduplicação com Pixel Client-Side

```html
<script>
// ==============================================
// INTEGRAÇÃO COM FACEBOOK PIXEL
// ==============================================

// Função para enviar evento tanto para Pixel quanto para CAPI
async function sendDualEvent(eventName, pixelParams, capiPayload) {
  const eventId = generateUUID();
  
  // 1. Enviar para Facebook Pixel (client-side)
  if (typeof fbq !== 'undefined') {
    fbq('track', eventName, pixelParams, { eventID: eventId });
    debugLog(`Pixel ${eventName} enviado`, { eventId, pixelParams });
  }
  
  // 2. Enviar para CAPI (server-side)
  capiPayload.eventId = eventId; // Usar o mesmo eventId para deduplicação
  
  let endpoint;
  switch(eventName) {
    case 'PageView':
      return await sendPageViewEvent();
    case 'ViewContent':
      endpoint = 'viewcontent';
      break;
    case 'InitiateCheckout':
      endpoint = 'initiatecheckout';
      break;
    default:
      console.warn(`Evento ${eventName} não suportado na CAPI`);
      return;
  }
  
  if (endpoint) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/track/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capiPayload)
      });
      
      const result = await response.json();
      debugLog(`CAPI ${eventName} enviado`, { eventId, result });
      
    } catch (error) {
      console.error(`Erro no CAPI ${eventName}:`, error);
    }
  }
}

// Exemplo de uso para ViewContent com deduplicação
function trackProductViewWithPixel() {
  const productData = {
    content_name: 'Produto Incrível',
    content_ids: ['prod_001'],
    value: 197.00,
    currency: 'BRL'
  };
  
  // Parâmetros para o Pixel
  const pixelParams = {
    content_name: productData.content_name,
    content_ids: productData.content_ids,
    value: productData.value,
    currency: productData.currency
  };
  
  // Payload para CAPI
  const capiPayload = {
    userData: {
      external_id: globalUserData.external_id ? [globalUserData.external_id] : undefined,
      em: globalUserData.em ? [globalUserData.em] : undefined,
      ph: globalUserData.ph ? [globalUserData.ph] : undefined,
      fn: globalUserData.fn ? [globalUserData.fn] : undefined,
      ln: globalUserData.ln ? [globalUserData.ln] : undefined,
      fbc: globalUserData.fbc || undefined,
      fbp: globalUserData.fbp || undefined,
    },
    customData: {
      ...productData,
      content_type: 'product',
      contents: [{
        id: 'prod_001',
        quantity: 1,
        item_price: 197.00
      }],
      num_items: 1
    },
    eventSourceUrl: window.location.href,
    urlParameters: getUrlParameters(),
    actionSource: 'website'
  };
  
  // Remove campos undefined
  Object.keys(capiPayload.userData).forEach(key => {
    if (capiPayload.userData[key] === undefined) {
      delete capiPayload.userData[key];
    }
  });
  
  sendDualEvent('ViewContent', pixelParams, capiPayload);
}
</script>
```

## Debugging e Monitoramento

### 9. Ferramentas de Debug

```html
<script>
// ==============================================
// DEBUGGING E MONITORAMENTO
// ==============================================

// Console de debug avançado
const FBConversionsDebug = {
  enabled: FACEBOOK_CONVERSIONS_CONFIG.debugMode,
  
  log: function(level, message, data) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[FB CONVERSIONS ${level.toUpperCase()}] ${timestamp}`;
    
    switch(level) {
      case 'info':
        console.log(prefix, message, data);
        break;
      case 'warn':
        console.warn(prefix, message, data);
        break;
      case 'error':
        console.error(prefix, message, data);
        break;
    }
  },
  
  info: function(message, data) { this.log('info', message, data); },
  warn: function(message, data) { this.log('warn', message, data); },
  error: function(message, data) { this.log('error', message, data); },
  
  // Função para mostrar dados atuais do usuário
  showUserData: function() {
    console.table(globalUserData);
  },
  
  // Função para testar conectividade com a API
  testAPI: async function() {
    try {
      const response = await fetch(`${API_BASE_URL}/`, {
        method: 'GET'
      });
      
      if (response.ok) {
        this.info('API conectada com sucesso');
        return true;
      } else {
        this.error('API retornou erro', { status: response.status });
        return false;
      }
    } catch (error) {
      this.error('Erro ao conectar com a API', error);
      return false;
    }
  }
};

// Adicionar ao objeto global para acesso no console
window.FBConversionsDebug = FBConversionsDebug;

// Logs automáticos em desenvolvimento
if (FACEBOOK_CONVERSIONS_CONFIG.debugMode) {
  console.log('%c🚀 Facebook Conversions API Debug Mode Ativo', 
    'background: #4267B2; color: white; padding: 10px; border-radius: 5px; font-weight: bold;');
  console.log('Use FBConversionsDebug.showUserData() para ver dados do usuário');
  console.log('Use FBConversionsDebug.testAPI() para testar conectividade');
}

// Validação de configuração
function validateConfiguration() {
  const issues = [];
  
  if (!globalUserData.external_id) {
    issues.push('external_id não foi gerado');
  }
  
  if (!globalUserData.fbp && !globalUserData.fbc) {
    issues.push('Nenhum identificador do Facebook encontrado (fbp/fbc)');
  }
  
  if (issues.length > 0) {
    FBConversionsDebug.warn('Problemas de configuração encontrados', issues);
  } else {
    FBConversionsDebug.info('Configuração validada com sucesso');
  }
}

// Executar validação após inicialização
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(validateConfiguration, 1000);
});
</script>
```

## Considerações de Performance

### 10. Otimizações e Boas Práticas

```html
<script>
// ==============================================
// OTIMIZAÇÕES DE PERFORMANCE
// ==============================================

// Cache para evitar múltiplas chamadas
const EventCache = {
  sentEvents: new Set(),
  
  // Evitar envio duplicado do mesmo evento na mesma sessão
  shouldSendEvent: function(eventType, identifier) {
    const key = `${eventType}_${identifier}`;
    if (this.sentEvents.has(key)) {
      FBConversionsDebug.warn('Evento já enviado nesta sessão', { eventType, identifier });
      return false;
    }
    this.sentEvents.add(key);
    return true;
  },
  
  // Marcar PageView como enviado para a URL atual
  markPageViewSent: function() {
    const url = window.location.href;
    this.sentEvents.add(`PageView_${url}`);
  }
};

// Debounce para eventos que podem ser disparados múltiplas vezes
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Versões debounced dos eventos
const debouncedViewContent = debounce(sendViewContentEvent, 300);
const debouncedInitiateCheckout = debounce(sendInitiateCheckoutEvent, 500);

// Lazy loading de scripts pesados
function loadScriptAsync(src, callback) {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  script.onload = callback;
  document.head.appendChild(script);
}

// Queue para eventos offline
const EventQueue = {
  queue: [],
  isOnline: navigator.onLine,
  
  add: function(eventData) {
    if (this.isOnline) {
      this.sendImmediate(eventData);
    } else {
      this.queue.push(eventData);
      FBConversionsDebug.info('Evento adicionado à queue (offline)', eventData);
    }
  },
  
  sendImmediate: async function(eventData) {
    // Implementar envio imediato
  },
  
  processQueue: async function() {
    while (this.queue.length > 0) {
      const eventData = this.queue.shift();
      try {
        await this.sendImmediate(eventData);
        FBConversionsDebug.info('Evento da queue enviado', eventData);
      } catch (error) {
        // Recolocar na queue se falhar
        this.queue.unshift(eventData);
        break;
      }
    }
  }
};

// Listeners para status de conectividade
window.addEventListener('online', function() {
  EventQueue.isOnline = true;
  EventQueue.processQueue();
});

window.addEventListener('offline', function() {
  EventQueue.isOnline = false;
});

// Envio de PageView otimizado
function sendOptimizedPageView() {
  const currentUrl = window.location.href;
  
  if (!EventCache.shouldSendEvent('PageView', currentUrl)) {
    return;
  }
  
  sendPageViewEvent().then(() => {
    EventCache.markPageViewSent();
  });
}

// Substituir a função padrão pela otimizada
window.addEventListener('load', function() {
  setTimeout(sendOptimizedPageView, 100);
});
</script>
```

## Checklist de Implementação

### ✅ Verificações Finais

Antes de colocar em produção, verifique:

1. **Configuração Básica:**
   - [ ] API_BASE_URL está correto
   - [ ] FACEBOOK_PIXEL_ID está configurado (se usar Pixel)
   - [ ] Moeda padrão está correta

2. **Eventos Implementados:**
   - [ ] PageView enviado automaticamente ao carregar
   - [ ] ViewContent para páginas de produto
   - [ ] InitiateCheckout no formulário de leads
   - [ ] Deduplicação configurada (se usar Pixel)

3. **Dados do Usuário:**
   - [ ] external_id sendo gerado e persistido
   - [ ] Cookies _fbp e _fbc sendo capturados
   - [ ] Hash SHA-256 funcionando corretamente
   - [ ] localStorage persistindo dados entre páginas

4. **Rastreamento:**
   - [ ] UTMs sendo capturados
   - [ ] fbclid sendo processado
   - [ ] Parâmetros de URL sendo enviados

5. **Debugging:**
   - [ ] Debug mode ativo em desenvolvimento
   - [ ] Logs aparecendo no console
   - [ ] Validação de configuração passando

6. **Performance:**
   - [ ] Eventos não sendo duplicados
   - [ ] Cache funcionando
   - [ ] Queue offline configurada (se necessário)

---

**⚠️ Importante:** Sempre teste em um ambiente de desenvolvimento primeiro e use o `FACEBOOK_TEST_EVENT_CODE` durante os testes para não afetar seus dados de produção.

**📞 Suporte:** Se encontrar problemas, verifique os logs no console do navegador e na API de Conversões do Facebook no Events Manager. 