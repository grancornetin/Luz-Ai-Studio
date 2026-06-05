import type { GrowthProduct } from '../../growthPlannerTypes';

export function normalizeProductsForEngineV2(products: GrowthProduct[]): GrowthProduct[] {
  return products
    .filter(product => product && String(product.name || '').trim())
    .map((product, index) => ({
      ...product,
      id: String(product.id || `product_${index + 1}`),
      name: String(product.name || '').trim(),
      category: String(product.category || 'Sin categoría').trim(),
      description: String(product.description || '').trim(),
      price: String(product.price || '').trim(),
      stock: String(product.stock || '').trim(),
      benefit: String(product.benefit || product.messageKey || '').trim(),
      credits: product.credits ? String(product.credits).trim() : undefined,
      idealFor: product.idealFor ? String(product.idealFor).trim() : undefined,
      useCases: (product.useCases || []).map(value => String(value).trim()).filter(Boolean),
      messageKey: product.messageKey ? String(product.messageKey).trim() : undefined,
      warnings: Array.from(new Set(product.warnings || [])),
    }));
}
