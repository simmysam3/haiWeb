/** App URLs for the Sourcing Map (spec §7.1). */
export const SM_HOME = '/sourcing-map';

export function smProjectHref(projectId: string): string {
  return `${SM_HOME}/${encodeURIComponent(projectId)}`;
}

export function smProductHref(projectId: string, productId: string): string {
  return `${smProjectHref(projectId)}/products/${encodeURIComponent(productId)}`;
}

export function smRunHref(projectId: string, templateId: string): string {
  return `${smProjectHref(projectId)}/runs/${encodeURIComponent(templateId)}`;
}
