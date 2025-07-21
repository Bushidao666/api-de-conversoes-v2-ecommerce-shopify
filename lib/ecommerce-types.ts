/**
 * E-COMMERCE TYPES AND INTERFACES
 * 
 * Centralized type definitions for Facebook Conversions API e-commerce events.
 * Includes comprehensive interfaces for all e-commerce events and Zod schemas
 * for runtime validation and type safety.
 * 
 * @version 2.0.0
 * @author Facebook Conversions API E-commerce Team
 */

import { z } from 'zod';

// =============================================================================
// CORE E-COMMERCE ENUMS
// =============================================================================

export const AvailabilityEnum = z.enum([
  'in stock',
  'out of stock', 
  'preorder',
  'available for order',
  'discontinued'
]);

export const ConditionEnum = z.enum([
  'new',
  'refurbished', 
  'used'
]);

export const PaymentMethodEnum = z.enum([
  'credit_card',
  'debit_card',
  'paypal',
  'apple_pay',
  'google_pay', 
  'bank_transfer',
  'boleto',
  'pix',
  'other'
]);

export const PaymentStatusEnum = z.enum([
  'completed',
  'pending',
  'failed',
  'refunded',
  'partially_refunded'
]);

export const DeliveryCategoryEnum = z.enum([
  'standard',
  'express',
  'overnight',
  'pickup',
  'digital',
  'subscription'
]);

export const CustomerTypeEnum = z.enum([
  'new',
  'returning',
  'vip',
  'wholesale'
]);

export const OrderSourceEnum = z.enum([
  'website',
  'mobile_app',
  'social_media',
  'marketplace',
  'phone',
  'in_store'
]);

export const DiscountTypeEnum = z.enum([
  'percentage',
  'fixed_amount',
  'shipping',
  'bogo',
  'bulk'
]);

export const WishlistTypeEnum = z.enum([
  'favorites',
  'later',
  'gift',
  'comparison',
  'custom'
]);

export const UserIntentEnum = z.enum([
  'browse',
  'compare',
  'gift',
  'later_purchase'
]);

// =============================================================================
// PRODUCT SCHEMAS
// =============================================================================

export const BaseProductSchema = z.object({
  id: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  item_price: z.number().nonnegative('Item price must be non-negative'),
  title: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  image_url: z.string().url().optional(),
});

export const ViewContentProductSchema = BaseProductSchema.extend({
  variant_id: z.string().optional(),
  variant_name: z.string().optional(),
});

export const CartItemSchema = BaseProductSchema.extend({
  variant: z.string().optional(),
});

export const WishlistProductSchema = BaseProductSchema.extend({
  availability: AvailabilityEnum.optional(),
  condition: ConditionEnum.optional(),
  variant_id: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

export const PurchasedProductSchema = BaseProductSchema.extend({
  variant_id: z.string().optional(),
  variant_name: z.string().optional(),
  sku: z.string().optional(),
  original_price: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
});

// =============================================================================
// EVENT DATA SCHEMAS
// =============================================================================

export const ViewContentDataSchema = z.object({
  content_ids: z.array(z.string()).min(1, 'At least one content ID is required'),
  content_name: z.string().min(1, 'Content name is required'),
  content_type: z.literal('product'),
  value: z.number().nonnegative('Value must be non-negative'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  content_category: z.string().optional(),
  brand: z.string().optional(),
  availability: AvailabilityEnum.optional(),
  condition: ConditionEnum.optional(),
  contents: z.array(ViewContentProductSchema).optional(),
});

export const AddToCartDataSchema = z.object({
  content_ids: z.array(z.string()).min(1, 'At least one content ID is required'),
  content_name: z.string().min(1, 'Content name is required'),
  content_type: z.literal('product'),
  value: z.number().positive('Value must be positive'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  content_category: z.string().optional(),
  brand: z.string().optional(),
  availability: AvailabilityEnum.optional(),
  condition: ConditionEnum.optional(),
  contents: z.array(ViewContentProductSchema).optional(),
  cart_id: z.string().optional(),
  product_group_id: z.string().optional(),
  custom_label_0: z.string().optional(),
  predicted_ltv: z.number().nonnegative().optional(),
});

export const InitiateCheckoutDataSchema = z.object({
  contents: z.array(CartItemSchema).min(1, 'At least one cart item is required'),
  value: z.number().positive('Value must be positive'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  num_items: z.number().int().positive('Number of items must be positive'),
  content_ids: z.array(z.string()).optional(),
  content_type: z.literal('product'),
  shipping_cost: z.number().nonnegative().optional(),
  tax_amount: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
  coupon_code: z.string().optional(),
  delivery_category: DeliveryCategoryEnum.optional(),
  cart_id: z.string().optional(),
  checkout_step: z.number().int().positive().optional(),
  payment_available: z.array(z.string()).optional(),
});

export const AddToWishlistDataSchema = z.object({
  content_ids: z.array(z.string()).min(1, 'At least one content ID is required'),
  content_name: z.string().min(1, 'Content name is required'),
  content_type: z.literal('product'),
  value: z.number().nonnegative('Value must be non-negative'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  num_items: z.number().int().positive('Number of items must be positive'),
  contents: z.array(WishlistProductSchema).min(1, 'At least one wishlist product is required'),
  wishlist_name: z.string().optional(),
  wishlist_type: WishlistTypeEnum.optional(),
  wishlist_id: z.string().optional(),
  content_category: z.string().optional(),
  brand: z.string().optional(),
  predicted_ltv: z.number().nonnegative().optional(),
  recommendation_source: z.string().optional(),
  user_intent: UserIntentEnum.optional(),
});

export const PurchaseDataSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required for deduplication'),
  value: z.number().positive('Value must be positive'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  contents: z.array(PurchasedProductSchema).min(1, 'At least one purchased product is required'),
  num_items: z.number().int().positive('Number of items must be positive'),
  content_type: z.literal('product'),
  content_ids: z.array(z.string()).optional(),
  content_name: z.string().optional(),
  
  // Financial fields
  order_total: z.number().nonnegative().optional(),
  shipping_cost: z.number().nonnegative().optional(),
  tax_amount: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
  subtotal: z.number().nonnegative().optional(),
  
  // Payment fields
  payment_method: PaymentMethodEnum.optional(),
  payment_status: PaymentStatusEnum.optional(),
  
  // Coupon/discount fields
  coupon_code: z.string().optional(),
  coupon_codes: z.array(z.string()).optional(),
  discount_type: DiscountTypeEnum.optional(),
  
  // Shipping fields
  delivery_category: DeliveryCategoryEnum.optional(),
  shipping_method: z.string().optional(),
  delivery_date: z.string().optional(),
  
  // Business intelligence fields
  customer_type: CustomerTypeEnum.optional(),
  order_source: OrderSourceEnum.optional(),
  predicted_ltv: z.number().nonnegative().optional(),
  subscription_id: z.string().optional(),
  
  // Attribution fields
  campaign_id: z.string().optional(),
  affiliate_id: z.string().optional(),
  referrer_source: z.string().optional(),
});

// PAYMENT CART ITEM SCHEMA (for AddPaymentInfo)
export const PaymentCartItemSchema = z.object({
  id: z.string().min(1, 'Product ID é obrigatório'),
  quantity: z.number().int().positive('Quantity deve ser positivo'),
  item_price: z.number().nonnegative('Item price deve ser não-negativo'),
  title: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  variant_id: z.string().optional(),
  variant_name: z.string().optional(),
  sku: z.string().optional()
});

// E-COMMERCE ADD PAYMENT INFO DATA SCHEMA
export const AddPaymentInfoDataSchema = z.object({
  // Dados obrigatórios
  contents: z.array(PaymentCartItemSchema).min(1, 'Contents é obrigatório'),
  value: z.number().positive('Value deve ser positivo'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  num_items: z.number().int().positive('Num items deve ser positivo'),
  content_type: z.literal('product'),
  
  // Dados do carrinho
  content_ids: z.array(z.string()).optional(),
  content_name: z.string().optional(),
  
  // Informações de pagamento
  payment_method: PaymentMethodEnum.optional(),
  payment_type: z.enum(['one_time', 'subscription', 'installment']).optional(),
  installments: z.number().int().min(1).max(24).optional(),
  
  // Dados financeiros
  shipping_cost: z.number().nonnegative().optional(),
  tax_amount: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
  subtotal: z.number().positive().optional(),
  order_total: z.number().positive().optional(),
  
  // Informações de entrega
  delivery_category: DeliveryCategoryEnum.optional(),
  shipping_method: z.string().optional(),
  estimated_delivery_date: z.string().optional(),
  
  // Dados do checkout
  checkout_step: z.number().int().min(1).max(10).optional(),
  checkout_id: z.string().optional(),
  cart_id: z.string().optional(),
  coupon_code: z.string().optional(),
  coupon_codes: z.array(z.string()).optional(),
  
  // Informações do cliente
  customer_type: CustomerTypeEnum.optional(),
  predicted_ltv: z.number().positive().optional(),
  
  // Dados de contexto
  payment_source: z.enum(['checkout_page', 'express_checkout', 'one_click', 'mobile_app']).optional(),
  device_type: z.enum(['desktop', 'mobile', 'tablet']).optional(),
  
  // Informações de segurança/risco
  risk_score: z.number().min(0).max(100).optional(),
  fraud_check_passed: z.boolean().optional()
});

// =============================================================================
// TYPE EXPORTS (inferred from Zod schemas)
// =============================================================================

export type Availability = z.infer<typeof AvailabilityEnum>;
export type Condition = z.infer<typeof ConditionEnum>;
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;
export type DeliveryCategory = z.infer<typeof DeliveryCategoryEnum>;
export type CustomerType = z.infer<typeof CustomerTypeEnum>;
export type OrderSource = z.infer<typeof OrderSourceEnum>;
export type DiscountType = z.infer<typeof DiscountTypeEnum>;
export type WishlistType = z.infer<typeof WishlistTypeEnum>;
export type UserIntent = z.infer<typeof UserIntentEnum>;

export type BaseProduct = z.infer<typeof BaseProductSchema>;
export type ViewContentProduct = z.infer<typeof ViewContentProductSchema>;
export type CartItem = z.infer<typeof CartItemSchema>;
export type WishlistProduct = z.infer<typeof WishlistProductSchema>;
export type PurchasedProduct = z.infer<typeof PurchasedProductSchema>;

export type EcommerceViewContentData = z.infer<typeof ViewContentDataSchema>;
export type EcommerceAddToCartData = z.infer<typeof AddToCartDataSchema>;
export type EcommerceInitiateCheckoutData = z.infer<typeof InitiateCheckoutDataSchema>;
export type EcommerceAddToWishlistData = z.infer<typeof AddToWishlistDataSchema>;
export type EcommerceAddPaymentInfoData = z.infer<typeof AddPaymentInfoDataSchema>;
export type EcommercePurchaseData = z.infer<typeof PurchaseDataSchema>;

// =============================================================================
// VALIDATION RESULT INTERFACES
// =============================================================================

export interface ValidationResult<T> {
  isValid: boolean;
  errors: string[];
  sanitizedData?: T;
  summary?: Record<string, any>;
}

export interface ProductSummary {
  totalValue: number;
  totalQuantity: number;
  avgUnitPrice: number;
  productCount: number;
  categories: string[];
  brands: string[];
}

export interface CartSummary extends ProductSummary {
  totalItems: number;
  avgItemPrice: number;
}

export interface WishlistSummary extends ProductSummary {
  totalItems: number;
  avgItemPrice: number;
}

export interface OrderSummary extends ProductSummary {
  totalItems: number;
  avgItemPrice: number;
  grossTotal: number;
  netTotal: number;
  totalSavings: number;
}

// =============================================================================
// API RESPONSE INTERFACES
// =============================================================================

export interface EcommerceApiResponse {
  message: string;
  fbtrace_id?: string;
  event_id: string;
  success: boolean;
  error?: string;
  errors?: string[];
}

export interface ViewContentApiResponse extends EcommerceApiResponse {
  product_data?: {
    ids: string[];
    name: string;
    value: number;
    currency: string;
  };
}

export interface AddToCartApiResponse extends EcommerceApiResponse {
  product_data?: {
    ids: string[];
    name: string;
    quantity: number;
    value: number;
    currency: string;
  };
}

export interface InitiateCheckoutApiResponse extends EcommerceApiResponse {
  cart_summary?: {
    product_count: number;
    total_items: number;
    total_value: number;
    currency: string;
    product_ids: string[];
  };
}

export interface AddToWishlistApiResponse extends EcommerceApiResponse {
  wishlist_data?: {
    product_count: number;
    total_items: number;
    total_value: number;
    currency: string;
    wishlist_name: string;
    product_ids: string[];
  };
}

export interface PurchaseApiResponse extends EcommerceApiResponse {
  order_data?: {
    order_id: string;
    product_count: number;
    total_items: number;
    total_value: number;
    currency: string;
    total_savings: number;
    payment_method?: PaymentMethod;
    product_ids: string[];
    categories: string[];
    brands: string[];
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validates e-commerce event data using Zod schemas
 */
export function validateEcommerceData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
    };
  }
  
  return {
    isValid: true,
    errors: [],
    sanitizedData: result.data,
  };
}

/**
 * Calculates product summary from contents array
 */
export function calculateProductSummary(contents: BaseProduct[]): ProductSummary {
  const totalValue = contents.reduce((sum, item) => sum + (item.item_price * item.quantity), 0);
  const totalQuantity = contents.reduce((sum, item) => sum + item.quantity, 0);
  const categories = Array.from(new Set(contents.map(item => item.category).filter(Boolean)));
  const brands = Array.from(new Set(contents.map(item => item.brand).filter(Boolean)));
  
  return {
    totalValue,
    totalQuantity,
    avgUnitPrice: totalValue / totalQuantity,
    productCount: contents.length,
    categories,
    brands,
  };
}

/**
 * Formats currency value for display
 */
export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(value);
}

/**
 * Generates unique event ID
 */
export function generateEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validates order totals for financial consistency
 */
export function validateOrderTotals(
  subtotal: number,
  shipping: number = 0,
  tax: number = 0,
  discount: number = 0,
  finalValue: number,
  tolerance: number = 0.01
): boolean {
  const calculatedTotal = subtotal + shipping + tax - discount;
  return Math.abs(calculatedTotal - finalValue) <= tolerance;
} 