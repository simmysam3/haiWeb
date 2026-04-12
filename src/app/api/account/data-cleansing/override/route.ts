import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";
import {
  CLASSIFICATION_OVERRIDE_ACTIONS,
  type ClassificationOverrideInput,
  type ClassificationOverrideAction,
} from "@/lib/haiwave-api";

export const POST = withHaiCore(
  async ({ client, request }) => {
    const body = (await request.json()) as ClassificationOverrideInput;

    if (!body.product_id || typeof body.product_id !== 'string') {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
    }
    if (!CLASSIFICATION_OVERRIDE_ACTIONS.includes(body.action as ClassificationOverrideAction)) {
      return NextResponse.json(
        { error: `action must be one of ${CLASSIFICATION_OVERRIDE_ACTIONS.join(', ')}` },
        { status: 400 },
      );
    }

    return client.submitClassificationOverride(body);
  },
);
