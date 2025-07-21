# 🛍️ Shopify Integration Guide - Facebook Conversions API E-commerce

**Guia completo para integração da API de Conversões do Facebook com temas da Shopify**

---

## 📋 **ÍNDICE**

1. [Pré-requisitos](#pré-requisitos)
2. [Configuração Inicial](#configuração-inicial)
3. [Implementação por Evento](#implementação-por-evento)
4. [Códigos para Tema Shopify](#códigos-para-tema-shopify)
5. [Configuração Avançada](#configuração-avançada)
6. [Troubleshooting](#troubleshooting)
7. [Exemplos Completos](#exemplos-completos)

---

## 🚀 **PRÉ-REQUISITOS**

### **✅ Checklist Técnico:**
- [ ] API Backend configurada e rodando
- [ ] URL da API definida (ex: `https://sua-api.com`)
- [ ] Acesso ao código do tema Shopify
- [ ] Permissões de administrador na loja
- [ ] Facebook Pixel já instalado (opcional, mas recomendado)

### **📍 Variáveis de Ambiente Necessárias:**
```bash
# Na sua API Backend
FACEBOOK_DATASET_ID=seu_dataset_id
FACEBOOK_ACCESS_TOKEN=seu_access_token
ALLOWED_ORIGIN=https://sua-loja.myshopify.com
IPDATA_API_KEY=sua_chave_ipdata (opcional)
```

---

## ⚙️ **CONFIGURAÇÃO INICIAL**

### **1. Configurar Script Base no Tema**

Adicione no `theme.liquid`, antes de `</head>`:

```liquid
<!-- Facebook Conversions API E-commerce -->
<script>
  window.FBCAPI_CONFIG = {
    apiUrl: 'https://sua-api.com/api/track',
    shopUrl: '{{ shop.permanent_domain }}',
    currency: '{{ cart.currency.iso_code }}',
    debug: {{ settings.fbcapi_debug | default: false }}
  };

  // Utility functions para capturar dados
  window.FBCAPI = {
    // Captura dados do usuário (quando disponível)
    getUserData: function() {
      return {
        {% if customer %}
        em: ['{{ customer.email | escape }}'],
        fn: ['{{ customer.first_name | escape }}'],
        ln: ['{{ customer.last_name | escape }}'],
        ph: ['{{ customer.phone | escape }}'],
        {% endif %}
        external_id: ['{{ customer.id | default: '' }}']
      };
    },

    // Gera ID único para o evento
    generateEventId: function() {
      return 'fbcapi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Função principal para enviar eventos
    sendEvent: function(eventType, customData, userData) {
      const eventId = this.generateEventId();
      const payload = {
        userData: userData || this.getUserData(),
        customData: customData,
        event_id: eventId,
        event_source_url: window.location.href,
        urlParameters: this.getUrlParameters()
      };

      if (window.FBCAPI_CONFIG.debug) {
        console.log(`[FBCAPI] Sending ${eventType}:`, payload);
      }

      fetch(window.FBCAPI_CONFIG.apiUrl + '/' + eventType.toLowerCase(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      .then(response => response.json())
      .then(data => {
        if (window.FBCAPI_CONFIG.debug) {
          console.log(`[FBCAPI] ${eventType} Response:`, data);
        }
      })
      .catch(error => {
        console.error(`[FBCAPI] ${eventType} Error:`, error);
      });
    },

    // Captura parâmetros da URL (UTMs, fbclid, etc.)
    getUrlParameters: function() {
      const urlParams = new URLSearchParams(window.location.search);
      const params = {};
      
      // Lista de parâmetros importantes para tracking
      const importantParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'fbclid', 'gclid', 'ttclid', 'ref', 'source'
      ];
      
      importantParams.forEach(param => {
        if (urlParams.has(param)) {
          params[param] = urlParams.get(param);
        }
      });
      
      return params;
    }
  };
</script>
```

---

## 🎯 **IMPLEMENTAÇÃO POR EVENTO**

### **1. 👁️ ViewContent - Página de Produto**

**Arquivo:** `sections/product-form.liquid` ou `templates/product.liquid`

```liquid
<!-- No final da página de produto -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  {% assign product = product %}
  {% assign variant = product.selected_or_first_available_variant %}
  
  const productData = {
    content_ids: ['{{ variant.id }}'],
    content_name: '{{ product.title | escape }}',
    content_type: 'product',
    value: {{ variant.price | money_without_currency | remove: ',' | times: 0.01 }},
    currency: '{{ cart.currency.iso_code }}',
    content_category: '{{ product.type | escape }}',
    brand: '{{ product.vendor | escape }}',
    availability: '{{ variant.available | ternary: "in stock", "out of stock" }}',
    condition: 'new',
    contents: [{
      id: '{{ variant.id }}',
      quantity: 1,
      item_price: {{ variant.price | money_without_currency | remove: ',' | times: 0.01 }},
      title: '{{ product.title | escape }}',
      category: '{{ product.type | escape }}',
      brand: '{{ product.vendor | escape }}'
    }]
  };

  // Enviar evento ViewContent
  window.FBCAPI.sendEvent('ViewContent', productData);
});
</script>
```

### **2. 🛒 AddToCart - Adicionar ao Carrinho**

**Arquivo:** `sections/product-form.liquid`

```liquid
<!-- Interceptar cliques no botão Add to Cart -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  const addToCartForm = document.querySelector('form[action*="/cart/add"]');
  
  if (addToCartForm) {
    addToCartForm.addEventListener('submit', function(e) {
      {% assign product = product %}
      
      // Capturar dados do formulário
      const formData = new FormData(this);
      const variantId = formData.get('id');
      const quantity = parseInt(formData.get('quantity') || 1);
      
      // Encontrar variante específica
      const variants = {{ product.variants | json }};
      const selectedVariant = variants.find(v => v.id == variantId);
      
      if (selectedVariant) {
        const addToCartData = {
          content_ids: [variantId.toString()],
          content_name: '{{ product.title | escape }}',
          content_type: 'product',
          value: selectedVariant.price * quantity / 100, // Shopify usa centavos
          currency: '{{ cart.currency.iso_code }}',
          quantity: quantity,
          content_category: '{{ product.type | escape }}',
          brand: '{{ product.vendor | escape }}',
          availability: selectedVariant.available ? 'in stock' : 'out of stock',
          condition: 'new',
          contents: [{
            id: variantId.toString(),
            quantity: quantity,
            item_price: selectedVariant.price / 100,
            title: '{{ product.title | escape }}',
            category: '{{ product.type | escape }}',
            brand: '{{ product.vendor | escape }}'
          }]
        };

        // Enviar evento AddToCart
        window.FBCAPI.sendEvent('AddToCart', addToCartData);
      }
    });
  }
});
</script>
```

### **3. ❤️ AddToWishlist - Lista de Desejos**

**Arquivo:** `snippets/wishlist-button.liquid` ou onde está o botão de wishlist

```liquid
<!-- Para botões de wishlist/favoritos -->
<script>
function addToWishlist(variantId, productData) {
  const wishlistData = {
    content_ids: [variantId.toString()],
    content_name: productData.title,
    content_type: 'product',
    value: productData.price / 100, // Shopify usa centavos
    currency: '{{ cart.currency.iso_code }}',
    num_items: 1,
    contents: [{
      id: variantId.toString(),
      quantity: 1,
      item_price: productData.price / 100,
      title: productData.title,
      category: productData.type,
      brand: productData.vendor,
      availability: productData.available ? 'in stock' : 'out of stock',
      condition: 'new'
    }],
    wishlist_name: 'favorites',
    wishlist_type: 'favorites',
    user_intent: 'later_purchase'
  };

  // Enviar evento AddToWishlist
  window.FBCAPI.sendEvent('AddToWishlist', wishlistData);
}

// Exemplo de uso:
document.querySelectorAll('.wishlist-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const variantId = this.dataset.variantId;
    const productData = JSON.parse(this.dataset.product);
    addToWishlist(variantId, productData);
  });
});
</script>
```

### **4. 💳 InitiateCheckout - Iniciar Checkout**

**Arquivo:** `templates/cart.liquid` ou `sections/cart-drawer.liquid`

```liquid
<!-- No botão de checkout do carrinho -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  const checkoutButtons = document.querySelectorAll('button[name="add"], .btn--checkout, [href*="/checkouts"]');
  
  checkoutButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Buscar dados do carrinho via AJAX
      fetch('/cart.js')
        .then(response => response.json())
        .then(cart => {
          const contents = cart.items.map(item => ({
            id: item.variant_id.toString(),
            quantity: item.quantity,
            item_price: item.price / 100, // Shopify usa centavos
            title: item.product_title,
            category: item.product_type,
            brand: item.vendor,
            variant: item.variant_title
          }));

          const checkoutData = {
            contents: contents,
            value: cart.total_price / 100, // Shopify usa centavos
            currency: '{{ cart.currency.iso_code }}',
            num_items: cart.item_count,
            content_ids: contents.map(item => item.id),
            content_type: 'product'
          };

          // Enviar evento InitiateCheckout
          window.FBCAPI.sendEvent('InitiateCheckout', checkoutData);
        })
        .catch(error => {
          console.error('[FBCAPI] Error fetching cart:', error);
        });
    });
  });
});
</script>
```

### **5. 💳 AddPaymentInfo - Informações de Pagamento**

**Arquivo:** `checkout.liquid` ou na página de método de pagamento

```liquid
<!-- Quando o usuário seleciona/adiciona método de pagamento -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  // Detectar mudanças nos métodos de pagamento
  const paymentForms = document.querySelectorAll('form[action*="/checkout"], .payment-form, [data-payment]');
  
  paymentForms.forEach(function(form) {
    form.addEventListener('change', function(e) {
      // Se mudou método de pagamento ou adicionou informações
      if (e.target.name && (e.target.name.includes('payment') || e.target.type === 'radio')) {
        sendAddPaymentInfoEvent();
      }
    });
    
    // Também enviar quando submeter formulário de pagamento
    form.addEventListener('submit', function(e) {
      sendAddPaymentInfoEvent();
    });
  });

  function sendAddPaymentInfoEvent() {
    fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        if (cart.item_count === 0) {
          console.warn('[FBCAPI] Cart is empty, skipping AddPaymentInfo');
          return;
        }

        const contents = cart.items.map(item => ({
          id: item.variant_id.toString(),
          quantity: item.quantity,
          item_price: item.price / 100,
          title: item.product_title,
          category: item.product_type || '',
          brand: item.vendor || '',
          variant_name: item.variant_title !== 'Default Title' ? item.variant_title : undefined,
          sku: item.sku || ''
        }));

        // Detectar método de pagamento selecionado
        const selectedPaymentMethod = detectPaymentMethod();

        const paymentData = {
          contents: contents,
          value: cart.total_price / 100,
          currency: '{{ cart.currency.iso_code }}',
          num_items: cart.item_count,
          content_ids: contents.map(item => item.id),
          content_type: 'product',
          
          // Informações de pagamento
          payment_method: selectedPaymentMethod,
          payment_type: 'one_time', // ou detectar se é subscription/installment
          
          // Se houver informações de shipping já preenchidas
          {% if checkout.shipping_price %}
          shipping_cost: {{ checkout.shipping_price | money_without_currency | remove: ',' | times: 0.01 }},
          {% endif %}
          
          // Step do checkout (geralmente 3 ou 4 para payment info)
          checkout_step: 3,
          checkout_id: '{{ checkout.id | default: "" }}',
          payment_source: 'checkout_page',
          device_type: detectDeviceType()
        };

        window.FBCAPI.sendEvent('AddPaymentInfo', paymentData);
      })
      .catch(error => {
        console.error('[FBCAPI] Error fetching cart for AddPaymentInfo:', error);
      });
  }

  // Função para detectar método de pagamento
  function detectPaymentMethod() {
    // Verificar métodos de pagamento comuns
    if (document.querySelector('input[value*="paypal"]:checked')) return 'paypal';
    if (document.querySelector('input[value*="apple"]:checked')) return 'apple_pay';
    if (document.querySelector('input[value*="google"]:checked')) return 'google_pay';
    if (document.querySelector('input[value*="pix"]:checked')) return 'pix';
    if (document.querySelector('input[value*="boleto"]:checked')) return 'boleto';
    if (document.querySelector('input[value*="credit"]:checked')) return 'credit_card';
    if (document.querySelector('input[value*="debit"]:checked')) return 'debit_card';
    
    // Verificar por classes ou data attributes
    const paymentInputs = document.querySelectorAll('[name*="payment"]:checked, .payment-method.selected');
    if (paymentInputs.length > 0) {
      const value = paymentInputs[0].value || paymentInputs[0].dataset.method || '';
      if (value.includes('paypal')) return 'paypal';
      if (value.includes('apple')) return 'apple_pay';
      if (value.includes('google')) return 'google_pay';
      if (value.includes('pix')) return 'pix';
      if (value.includes('boleto')) return 'boleto';
      if (value.includes('credit')) return 'credit_card';
      if (value.includes('debit')) return 'debit_card';
    }
    
    return 'credit_card'; // fallback
  }

  // Função para detectar tipo de dispositivo
  function detectDeviceType() {
    if (/Mobi|Android/i.test(navigator.userAgent)) return 'mobile';
    if (/Tablet|iPad/i.test(navigator.userAgent)) return 'tablet';
    return 'desktop';
  }
});
</script>
```

### **6. 🎉 Purchase - Compra Concluída**

**Arquivo:** `checkout.liquid` ou `order-status.liquid`

```liquid
{% if checkout.order_id %}
<!-- Somente na página de confirmação de pedido -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  const orderData = {
    order_id: '{{ checkout.order_id }}',
    value: {{ checkout.total_price | money_without_currency | remove: ',' | times: 0.01 }},
    currency: '{{ checkout.currency }}',
    contents: [
      {% for line_item in checkout.line_items %}
      {
        id: '{{ line_item.variant_id }}',
        quantity: {{ line_item.quantity }},
        item_price: {{ line_item.price | money_without_currency | remove: ',' | times: 0.01 }},
        title: '{{ line_item.title | escape }}',
        category: '{{ line_item.product.type | escape }}',
        brand: '{{ line_item.vendor | escape }}',
        sku: '{{ line_item.sku | escape }}'
      }{% unless forloop.last %},{% endunless %}
      {% endfor %}
    ],
    num_items: {{ checkout.item_count }},
    content_type: 'product',
    content_ids: [{% for line_item in checkout.line_items %}'{{ line_item.variant_id }}'{% unless forloop.last %},{% endunless %}{% endfor %}],
    
    // Informações financeiras
    {% if checkout.shipping_price > 0 %}
    shipping_cost: {{ checkout.shipping_price | money_without_currency | remove: ',' | times: 0.01 }},
    {% endif %}
    {% if checkout.tax_price > 0 %}
    tax_amount: {{ checkout.tax_price | money_without_currency | remove: ',' | times: 0.01 }},
    {% endif %}
    {% if checkout.discount_amount > 0 %}
    discount_amount: {{ checkout.discount_amount | money_without_currency | remove: ',' | times: 0.01 }},
    {% endif %}
    
    // Informações de pagamento
    {% if checkout.payment_gateway %}
    payment_method: '{{ checkout.payment_gateway | downcase }}',
    {% endif %}
    payment_status: 'completed',
    
    // Cupons de desconto
    {% if checkout.discount_codes.size > 0 %}
    coupon_codes: [{% for discount in checkout.discount_codes %}'{{ discount.code }}'{% unless forloop.last %},{% endunless %}{% endfor %}],
    {% endif %}
    
    // Método de entrega
    {% if checkout.shipping_method %}
    delivery_category: 'standard',
    shipping_method: '{{ checkout.shipping_method.title }}',
    {% endif %}
    
    // Informações do cliente
    customer_type: '{% if customer.orders_count == 1 %}new{% elsif customer.orders_count <= 5 %}returning{% else %}vip{% endif %}',
    order_source: 'website'
  };

  // Enviar evento Purchase
  window.FBCAPI.sendEvent('Purchase', orderData);
});
</script>
{% endif %}
```

---

## 🔧 **CONFIGURAÇÃO AVANÇADA**

### **1. Configurações no Admin da Shopify**

Adicione no `config/settings_schema.json`:

```json
{
  "name": "Facebook Conversions API",
  "settings": [
    {
      "type": "header",
      "content": "Facebook Conversions API E-commerce"
    },
    {
      "type": "text",
      "id": "fbcapi_url",
      "label": "API URL",
      "info": "URL da sua API de conversões",
      "default": "https://sua-api.com/api/track"
    },
    {
      "type": "checkbox",
      "id": "fbcapi_debug",
      "label": "Debug Mode",
      "info": "Ativar logs detalhados no console",
      "default": false
    },
    {
      "type": "checkbox",
      "id": "fbcapi_enable_viewcontent",
      "label": "Ativar ViewContent",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "fbcapi_enable_addtocart",
      "label": "Ativar AddToCart",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "fbcapi_enable_checkout",
      "label": "Ativar InitiateCheckout",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "fbcapi_enable_purchase",
      "label": "Ativar Purchase",
      "default": true
    }
  ]
}
```

### **2. Script Otimizado com Configurações**

Substitua o script base por:

```liquid
<script>
  window.FBCAPI_CONFIG = {
    apiUrl: '{{ settings.fbcapi_url | default: "https://sua-api.com/api/track" }}',
    debug: {{ settings.fbcapi_debug | default: false }},
    events: {
      viewContent: {{ settings.fbcapi_enable_viewcontent | default: true }},
      addToCart: {{ settings.fbcapi_enable_addtocart | default: true }},
      initiateCheckout: {{ settings.fbcapi_enable_checkout | default: true }},
      purchase: {{ settings.fbcapi_enable_purchase | default: true }}
    }
  };

  // Versão otimizada das funções FBCAPI
  window.FBCAPI = {
    sendEvent: function(eventType, customData, userData) {
      // Verificar se o evento está habilitado
      const eventKey = eventType.charAt(0).toLowerCase() + eventType.slice(1);
      if (!window.FBCAPI_CONFIG.events[eventKey]) {
        if (window.FBCAPI_CONFIG.debug) {
          console.log(`[FBCAPI] ${eventType} is disabled`);
        }
        return;
      }

      // Resto da implementação...
    }
  };
</script>
```

---

## 🐛 **TROUBLESHOOTING**

### **Problemas Comuns e Soluções:**

#### **1. Evento não está sendo enviado**
```javascript
// Adicione debug no console
if (window.FBCAPI_CONFIG.debug) {
  console.log('Event data:', customData);
  console.log('User data:', userData);
}
```

#### **2. Erro de CORS**
Verifique se `ALLOWED_ORIGIN` na API está correto:
```bash
ALLOWED_ORIGIN=https://sua-loja.myshopify.com
```

#### **3. Dados incorretos**
Use o console do navegador para verificar:
```javascript
// No console da Shopify
console.log('Cart data:', fetch('/cart.js').then(r => r.json()));
console.log('Product data:', {{ product | json }});
```

#### **4. Testando em modo debug**
```liquid
<!-- Ative debug temporariamente -->
<script>
  window.FBCAPI_CONFIG.debug = true;
</script>
```

### **Ferramentas de Debug:**

1. **Facebook Events Manager** - Verificar se eventos chegam
2. **Console do navegador** - Logs detalhados
3. **Network tab** - Ver requests para API
4. **Shopify admin** - Verificar configurações

---

## 📱 **EXEMPLOS COMPLETOS**

### **Exemplo 1: Tema Completo com Todos os Eventos**

```liquid
<!-- theme.liquid - Configuração base -->
{% comment %} Facebook Conversions API E-commerce {% endcomment %}
<script>
  window.FBCAPI_CONFIG = {
    apiUrl: '{{ settings.fbcapi_url | default: "https://sua-api.com/api/track" }}',
    shopUrl: '{{ shop.permanent_domain }}',
    currency: '{{ cart.currency.iso_code }}',
    debug: {{ settings.fbcapi_debug | default: false }}
  };

  window.FBCAPI = {
    getUserData: function() {
      return {
        {% if customer %}
        em: ['{{ customer.email | escape }}'],
        fn: ['{{ customer.first_name | escape }}'],
        ln: ['{{ customer.last_name | escape }}'],
        ph: ['{{ customer.phone | escape }}'],
        external_id: ['{{ customer.id }}']
        {% else %}
        external_id: ['guest_' + Date.now()]
        {% endif %}
      };
    },

    generateEventId: function() {
      return 'fbcapi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    sendEvent: function(eventType, customData, userData) {
      const eventId = this.generateEventId();
      const payload = {
        userData: userData || this.getUserData(),
        customData: customData,
        event_id: eventId,
        event_source_url: window.location.href,
        urlParameters: this.getUrlParameters()
      };

      if (window.FBCAPI_CONFIG.debug) {
        console.log(`[FBCAPI] Sending ${eventType}:`, payload);
      }

      return fetch(window.FBCAPI_CONFIG.apiUrl + '/' + eventType.toLowerCase(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      .then(response => response.json())
      .then(data => {
        if (window.FBCAPI_CONFIG.debug) {
          console.log(`[FBCAPI] ${eventType} Success:`, data);
        }
        return data;
      })
      .catch(error => {
        console.error(`[FBCAPI] ${eventType} Error:`, error);
        throw error;
      });
    },

    getUrlParameters: function() {
      const urlParams = new URLSearchParams(window.location.search);
      const params = {};
      
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
       'fbclid', 'gclid', 'ttclid', 'ref', 'source'].forEach(param => {
        if (urlParams.has(param)) {
          params[param] = urlParams.get(param);
        }
      });
      
      return params;
    }
  };
</script>
```

### **Exemplo 2: Implementação com Promises**

```javascript
// Exemplo avançado com tratamento de erros
class ShopifyFBCAPI {
  constructor(config) {
    this.config = config;
    this.eventQueue = [];
    this.isOnline = navigator.onLine;
  }

  async sendEvent(eventType, customData, userData) {
    const event = {
      type: eventType,
      data: customData,
      user: userData || this.getUserData(),
      timestamp: Date.now()
    };

    if (!this.isOnline) {
      this.eventQueue.push(event);
      return Promise.resolve({ queued: true });
    }

    try {
      const result = await this.makeRequest(event);
      return result;
    } catch (error) {
      this.eventQueue.push(event);
      throw error;
    }
  }

  async flushQueue() {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      try {
        await this.makeRequest(event);
      } catch (error) {
        console.error('[FBCAPI] Failed to flush event:', error);
      }
    }
  }
}

// Uso
const fbcapi = new ShopifyFBCAPI(window.FBCAPI_CONFIG);
window.addEventListener('online', () => fbcapi.flushQueue());
```

---

## 🎯 **CHECKLIST DE IMPLEMENTAÇÃO**

### **Fase 1: Configuração Base**
- [ ] Script base configurado no `theme.liquid`
- [ ] Configurações adicionadas no admin
- [ ] URL da API configurada
- [ ] Debug mode testado

### **Fase 2: Eventos Básicos**
- [ ] ViewContent implementado nas páginas de produto
- [ ] AddToCart implementado nos formulários
- [ ] Purchase implementado na confirmação

### **Fase 3: Eventos Avançados**
- [ ] InitiateCheckout implementado no carrinho
- [ ] AddToWishlist implementado (se aplicável)
- [ ] Dados de usuário capturados corretamente

### **Fase 4: Testes e Otimização**
- [ ] Todos os eventos testados no Facebook Events Manager
- [ ] Debug logs verificados
- [ ] Performance analisada
- [ ] Documentação atualizada

---

## 🚀 **PRÓXIMOS PASSOS**

1. **Implementar código base** no tema
2. **Testar cada evento** individualmente
3. **Verificar no Facebook Events Manager**
4. **Otimizar performance** conforme necessário
5. **Monitorar resultados** e fazer ajustes

---

**📞 Suporte:** Para dúvidas sobre implementação, verifique os logs de debug e teste cada evento individualmente.

**🔗 Links Úteis:**
- [Shopify Theme Development](https://shopify.dev/themes)
- [Facebook Events Manager](https://business.facebook.com/events_manager)
- [Liquid Template Language](https://shopify.github.io/liquid/)

---

*Documentação atualizada em {{ "now" | date: "%d/%m/%Y" }}* 