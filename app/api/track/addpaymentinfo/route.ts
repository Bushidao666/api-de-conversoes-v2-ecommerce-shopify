import { NextRequest, NextResponse } from 'next/server';
import { sendServerEvent, type UserData } from '../../../../lib/fbevents';

// Interface para itens no carrinho durante AddPaymentInfo
interface PaymentCartItem {
  [key: string]: unknown; // Index signature for compatibility
  id: string;
  quantity: number;
  item_price: number;
  title?: string;
  category?: string;
  brand?: string;
  variant_id?: string;
  variant_name?: string;
  sku?: string;
}

// Interface principal para dados do evento AddPaymentInfo
interface EcommerceAddPaymentInfoData {
  [key: string]: unknown; // Index signature for compatibility
  // Dados obrigatórios
  contents: PaymentCartItem[];
  value: number;
  currency: string;
  num_items: number;
  content_type: 'product';
  
  // Dados do carrinho
  content_ids?: string[];
  content_name?: string;
  
  // Informações de pagamento
  payment_method?: 'credit_card' | 'debit_card' | 'paypal' | 'apple_pay' | 'google_pay' | 'bank_transfer' | 'boleto' | 'pix' | 'klarna' | 'afterpay' | 'other';
  payment_type?: 'one_time' | 'subscription' | 'installment';
  installments?: number;
  
  // Dados financeiros
  shipping_cost?: number;
  tax_amount?: number;
  discount_amount?: number;
  subtotal?: number;
  order_total?: number;
  
  // Informações de entrega
  delivery_category?: 'standard' | 'express' | 'overnight' | 'pickup' | 'digital';
  shipping_method?: string;
  estimated_delivery_date?: string;
  
  // Dados do checkout
  checkout_step?: number;
  checkout_id?: string;
  cart_id?: string;
  coupon_code?: string;
  coupon_codes?: string[];
  
  // Informações do cliente
  customer_type?: 'new' | 'returning' | 'vip' | 'guest';
  predicted_ltv?: number;
  
  // Dados de contexto
  payment_source?: 'checkout_page' | 'express_checkout' | 'one_click' | 'mobile_app';
  device_type?: 'desktop' | 'mobile' | 'tablet';
  
  // Informações de segurança/risco
  risk_score?: number;
  fraud_check_passed?: boolean;
}

// Função de validação para dados do AddPaymentInfo
function validateEcommerceAddPaymentInfoData(data: any): {
  isValid: boolean;
  errors: string[];
  sanitizedData?: EcommerceAddPaymentInfoData;
  paymentSummary?: {
    totalValue: number;
    totalItems: number;
    productCount: number;
    avgItemPrice: number;
    paymentMethod: string;
    hasShipping: boolean;
    hasTax: boolean;
    hasDiscount: boolean;
    checkoutProgress: number;
  };
} {
  const errors: string[] = [];
  
  // Validação de campos obrigatórios
  if (!data.contents || !Array.isArray(data.contents) || data.contents.length === 0) {
    errors.push('contents é obrigatório e deve ser um array não vazio');
  }
  
  if (typeof data.value !== 'number' || data.value < 0) {
    errors.push('value deve ser um número positivo');
  }
  
  if (!data.currency || typeof data.currency !== 'string') {
    errors.push('currency é obrigatório');
  }
  
  if (typeof data.num_items !== 'number' || data.num_items < 1) {
    errors.push('num_items deve ser um número maior que 0');
  }
  
  // Validação dos itens do carrinho
  if (data.contents && Array.isArray(data.contents)) {
    data.contents.forEach((item: any, index: number) => {
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`contents[${index}].id é obrigatório`);
      }
      
      if (typeof item.quantity !== 'number' || item.quantity < 1) {
        errors.push(`contents[${index}].quantity deve ser um número maior que 0`);
      }
      
      if (typeof item.item_price !== 'number' || item.item_price < 0) {
        errors.push(`contents[${index}].item_price deve ser um número positivo`);
      }
    });
  }
  
  // Validação de método de pagamento
  if (data.payment_method) {
    const validPaymentMethods = [
      'credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 
      'bank_transfer', 'boleto', 'pix', 'klarna', 'afterpay', 'other'
    ];
    if (!validPaymentMethods.includes(data.payment_method)) {
      errors.push(`payment_method deve ser um dos valores: ${validPaymentMethods.join(', ')}`);
    }
  }
  
  // Validação de tipo de pagamento
  if (data.payment_type) {
    const validPaymentTypes = ['one_time', 'subscription', 'installment'];
    if (!validPaymentTypes.includes(data.payment_type)) {
      errors.push(`payment_type deve ser um dos valores: ${validPaymentTypes.join(', ')}`);
    }
  }
  
  // Validação de parcelas
  if (data.installments && (typeof data.installments !== 'number' || data.installments < 1 || data.installments > 24)) {
    errors.push('installments deve ser um número entre 1 e 24');
  }
  
  // Validação de valores monetários
  const monetaryFields = ['shipping_cost', 'tax_amount', 'discount_amount', 'subtotal', 'order_total', 'predicted_ltv'];
  monetaryFields.forEach(field => {
    if (data[field] !== undefined && (typeof data[field] !== 'number' || data[field] < 0)) {
      errors.push(`${field} deve ser um número positivo`);
    }
  });
  
  // Validação de consistência financeira
  if (data.contents && Array.isArray(data.contents)) {
    const calculatedTotal = data.contents.reduce((sum: number, item: any) => {
      return sum + (item.item_price * item.quantity);
    }, 0);
    
    const calculatedItems = data.contents.reduce((sum: number, item: any) => {
      return sum + item.quantity;
    }, 0);
    
    // Verificar se value está próximo do total calculado (tolerância de 1%)
    const tolerance = calculatedTotal * 0.01;
    if (Math.abs(data.value - calculatedTotal) > tolerance) {
      errors.push(`value (${data.value}) não corresponde ao total calculado dos itens (${calculatedTotal})`);
    }
    
    // Verificar se num_items corresponde
    if (data.num_items !== calculatedItems) {
      errors.push(`num_items (${data.num_items}) não corresponde ao total de itens calculado (${calculatedItems})`);
    }
  }
  
  // Validação de step do checkout
  if (data.checkout_step && (typeof data.checkout_step !== 'number' || data.checkout_step < 1 || data.checkout_step > 10)) {
    errors.push('checkout_step deve ser um número entre 1 e 10');
  }
  
  // Validação de categoria de entrega
  if (data.delivery_category) {
    const validCategories = ['standard', 'express', 'overnight', 'pickup', 'digital'];
    if (!validCategories.includes(data.delivery_category)) {
      errors.push(`delivery_category deve ser um dos valores: ${validCategories.join(', ')}`);
    }
  }
  
  // Validação de tipo de cliente
  if (data.customer_type) {
    const validCustomerTypes = ['new', 'returning', 'vip', 'guest'];
    if (!validCustomerTypes.includes(data.customer_type)) {
      errors.push(`customer_type deve ser um dos valores: ${validCustomerTypes.join(', ')}`);
    }
  }
  
  // Validação de fonte de pagamento
  if (data.payment_source) {
    const validSources = ['checkout_page', 'express_checkout', 'one_click', 'mobile_app'];
    if (!validSources.includes(data.payment_source)) {
      errors.push(`payment_source deve ser um dos valores: ${validSources.join(', ')}`);
    }
  }
  
  // Validação de risk score
  if (data.risk_score && (typeof data.risk_score !== 'number' || data.risk_score < 0 || data.risk_score > 100)) {
    errors.push('risk_score deve ser um número entre 0 e 100');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  
  // Sanitizar e estruturar dados
  const sanitizedData: EcommerceAddPaymentInfoData = {
    contents: data.contents.map((item: any) => ({
      id: item.id.toString(),
      quantity: parseInt(item.quantity),
      item_price: parseFloat(item.item_price),
      title: item.title?.toString(),
      category: item.category?.toString(),
      brand: item.brand?.toString(),
      variant_id: item.variant_id?.toString(),
      variant_name: item.variant_name?.toString(),
      sku: item.sku?.toString()
    })),
    value: parseFloat(data.value),
    currency: data.currency.toString().toUpperCase(),
    num_items: parseInt(data.num_items),
    content_type: 'product',
    content_ids: data.content_ids || data.contents.map((item: any) => item.id.toString()),
    content_name: data.content_name?.toString(),
    payment_method: data.payment_method,
    payment_type: data.payment_type,
    installments: data.installments ? parseInt(data.installments) : undefined,
    shipping_cost: data.shipping_cost ? parseFloat(data.shipping_cost) : undefined,
    tax_amount: data.tax_amount ? parseFloat(data.tax_amount) : undefined,
    discount_amount: data.discount_amount ? parseFloat(data.discount_amount) : undefined,
    subtotal: data.subtotal ? parseFloat(data.subtotal) : undefined,
    order_total: data.order_total ? parseFloat(data.order_total) : undefined,
    delivery_category: data.delivery_category,
    shipping_method: data.shipping_method?.toString(),
    estimated_delivery_date: data.estimated_delivery_date?.toString(),
    checkout_step: data.checkout_step ? parseInt(data.checkout_step) : undefined,
    checkout_id: data.checkout_id?.toString(),
    cart_id: data.cart_id?.toString(),
    coupon_code: data.coupon_code?.toString(),
    coupon_codes: data.coupon_codes,
    customer_type: data.customer_type,
    predicted_ltv: data.predicted_ltv ? parseFloat(data.predicted_ltv) : undefined,
    payment_source: data.payment_source,
    device_type: data.device_type,
    risk_score: data.risk_score ? parseFloat(data.risk_score) : undefined,
    fraud_check_passed: data.fraud_check_passed
  };
  
  // Gerar resumo de pagamento
  const paymentSummary = {
    totalValue: sanitizedData.value,
    totalItems: sanitizedData.num_items,
    productCount: sanitizedData.contents.length,
    avgItemPrice: sanitizedData.value / sanitizedData.num_items,
    paymentMethod: sanitizedData.payment_method || 'not_specified',
    hasShipping: Boolean(sanitizedData.shipping_cost && sanitizedData.shipping_cost > 0),
    hasTax: Boolean(sanitizedData.tax_amount && sanitizedData.tax_amount > 0),
    hasDiscount: Boolean(sanitizedData.discount_amount && sanitizedData.discount_amount > 0),
    checkoutProgress: sanitizedData.checkout_step || 3 // AddPaymentInfo geralmente é step 3
  };
  
  return {
    isValid: true,
    errors: [],
    sanitizedData,
    paymentSummary
  };
}

// Handler para requisições OPTIONS (CORS)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// Handler principal para AddPaymentInfo
export async function POST(request: NextRequest) {
  try {
    console.log('[AddPaymentInfo] 💳 Processando evento AddPaymentInfo...');
    
    const body = await request.json();
    console.log('[AddPaymentInfo] 📄 Body recebido:', JSON.stringify(body, null, 2));
    
    // Extrair dados do corpo da requisição
    const { userData, customData, event_id, event_source_url, urlParameters } = body;
    
    if (!userData) {
      console.error('[AddPaymentInfo] ❌ userData é obrigatório');
      return NextResponse.json(
        { success: false, error: 'userData é obrigatório' },
        { status: 400 }
      );
    }
    
    if (!customData) {
      console.error('[AddPaymentInfo] ❌ customData é obrigatório');
      return NextResponse.json(
        { success: false, error: 'customData é obrigatório' },
        { status: 400 }
      );
    }
    
    // Validar dados específicos do AddPaymentInfo
    const validation = validateEcommerceAddPaymentInfoData(customData);
    
    if (!validation.isValid) {
      console.error('[AddPaymentInfo] ❌ Dados inválidos:', validation.errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Dados de pagamento inválidos',
          details: validation.errors 
        },
        { status: 400 }
      );
    }
    
    const { sanitizedData, paymentSummary } = validation;
    
    console.log('[AddPaymentInfo] ✅ Dados validados com sucesso');
    console.log('[AddPaymentInfo] 📊 Resumo do pagamento:', {
      totalValue: paymentSummary?.totalValue,
      paymentMethod: paymentSummary?.paymentMethod,
      totalItems: paymentSummary?.totalItems,
      checkoutStep: paymentSummary?.checkoutProgress
    });
    
    // Enviar evento para o Facebook
    const result = await sendServerEvent(
      'AddPaymentInfo',
      request,
      userData as UserData,
      sanitizedData,
      event_source_url,
      event_id,
      urlParameters
    );
    
    console.log('[AddPaymentInfo] 🚀 Evento enviado para Facebook:', result.success);
    
    if (result.success) {
      console.log('[AddPaymentInfo] ✅ AddPaymentInfo processado com sucesso');
      return NextResponse.json({
        success: true,
        message: 'Evento AddPaymentInfo enviado com sucesso',
        eventId: event_id,
        paymentSummary: paymentSummary,
        facebook_response: result.success && 'fbtrace_id' in result ? { fbtrace_id: result.fbtrace_id } : null
      });
    } else {
      console.error('[AddPaymentInfo] ❌ Erro ao enviar para Facebook:', result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Erro ao enviar evento para Facebook',
          details: result.error 
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('[AddPaymentInfo] ❌ Erro interno:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
} 