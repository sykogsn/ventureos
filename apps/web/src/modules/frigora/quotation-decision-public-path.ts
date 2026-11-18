/** Customer decision pages and their one API. Not a general public API. */
export function isQuotationDecisionPublicPath(pathname: string): boolean {
  if (pathname === "/api/quotation-decision") {
    return true;
  }
  return /^\/quotation-decision\/[^/]+$/.test(pathname);
}
