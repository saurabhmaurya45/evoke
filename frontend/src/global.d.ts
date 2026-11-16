export {};

declare global {
  interface Window {
    /** Injected by `/api/invitation-page` on wedding subdomains for WhatsApp + CSR bootstrap. */
    __TI_INVITATION_SLUG__?: string;
  }
}