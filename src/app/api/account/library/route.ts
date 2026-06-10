import { withHaiCore } from "@/lib/with-hai-core";
import type { LibraryView } from "@/lib/library-types";

/**
 * Dev stand-alone fallback for the Company Library view. Served only when no
 * real Keycloak token is present (local UI work without haiCore running).
 */
const DEV_LIBRARY_FALLBACK: LibraryView = {
  sections: [
    {
      section: "legal_commercial",
      elements: [
        {
          key: "terms_of_sale",
          label: "Terms of Sale",
          kind: "artifact",
          validity: true,
          modal_fields: ["standard"],
          attribute: null,
          artifacts: [],
          policies: {
            share: { premier: true, trading_pair: true, connection: false, qualified: false },
            require: { premier: false, trading_pair: false, connection: false, qualified: false },
          },
          gap: true,
        },
        {
          key: "payment_terms",
          label: "Payment Terms",
          kind: "attribute",
          value_type: "string",
          validity: false,
          modal_fields: [],
          attribute: {
            id: "attr-payment-terms",
            elementKey: "payment_terms",
            valueJson: "Net 30",
            status: "affirmed",
            sourceTier: "premier",
            evidenceArtifactId: null,
            validUntil: null,
            affirmedBy: "dev@haiwave.test",
          },
          artifacts: [],
          policies: {
            share: { premier: true, trading_pair: true, connection: true, qualified: false },
            require: { premier: false, trading_pair: false, connection: false, qualified: false },
          },
          gap: false,
        },
      ],
    },
    {
      section: "quality",
      elements: [
        {
          key: "iso_9001_cert",
          label: "ISO 9001 Certification",
          kind: "artifact",
          validity: true,
          modal_fields: ["issuer", "cert_number", "scope"],
          attribute: null,
          artifacts: [],
          policies: {
            share: { premier: true, trading_pair: true, connection: false, qualified: false },
            require: { premier: false, trading_pair: false, connection: false, qualified: false },
          },
          gap: true,
        },
      ],
    },
  ],
};

/**
 * GET /api/account/library
 *
 * Returns the participant's Company Library view from haiCore.
 * Falls back to a dev stand-alone library in development.
 */
export const GET = withHaiCore(({ client }) => client.getLibrary(), {
  fallback: DEV_LIBRARY_FALLBACK,
});
