export {};

declare global {
  interface Window {
    /** Injected by `/api/invitation-page` on wedding subdomains for WhatsApp + CSR bootstrap. */
    __TI_INVITATION_SLUG__?: string;
    /** The published invitation, injected by `/api/invitation-page` so it shows without an API call. */
    __TI_INVITATION__?: unknown;
  }
}
