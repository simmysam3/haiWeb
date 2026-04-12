import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";
import type { ClassificationOverrideInput } from "@/lib/haiwave-api";

/**
 * POST /api/account/data-cleansing/override
 *
 * Applies a vendor override to an unclassifiable product.
 * Actions: reassign, new_node_request, non_product, dismiss.
 */
export const POST = withHaiCore(
  async ({ client, request }) => {
    const body = (await request.json()) as ClassificationOverrideInput;

    if (!body.product_id || typeof body.product_id !== 'string') {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
    }
    const validActions = ['reassign', 'new_node_request', 'non_product', 'dismiss'];
    if (!validActions.includes(body.action)) {
      return NextResponse.json({ error: `action must be one of ${validActions.join(', ')}` }, { status: 400 });
    }

    return client.submitClassificationOverride(body);
  },
);
