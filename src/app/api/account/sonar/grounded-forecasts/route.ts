import { NextResponse } from 'next/server';
import { CreateRunTemplateRequestSchema } from '@haiwave/protocol';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET  /api/account/sonar/grounded-forecasts — list the caller's grounded
 *      forecast RunTemplates.
 * POST /api/account/sonar/grounded-forecasts — create one.
 *
 * v1.62 BFF, mirroring /api/account/sonar/watcher/definitions. A grounded
 * forecast is a fourth observation_class on run_templates, so update, delete
 * and trigger deliberately have nothing here — they ride the generic
 * /api/account/sonar/templates routes.
 */

/**
 * The client method already asks haiCore for observation_class=grounded_forecast,
 * so the filter below is belt-and-braces: it keeps the page's contract true even
 * if that query parameter is ever dropped or ignored upstream, exactly as the
 * watcher list route does. The envelope key is preserved either way.
 */
export const GET = withHaiCore(async ({ client }) => {
  const { templates } = await client.listGroundedForecastTemplates();
  return NextResponse.json({
    templates: templates.filter((t) => t.observation_class === 'grounded_forecast'),
  });
});

/**
 * observation_class is forced server-side before validation, not merged after
 * it. The create request is a discriminated union on that field, so forcing it
 * first is what makes a spoofed value ('audit' with a forecast scope) parse as
 * the forecast branch rather than failing as a mismatched audit. It also lets
 * the wizard omit the field entirely.
 *
 * Everything else is haiCore's business: the 4xx passthrough in withHaiCore
 * carries its errors back verbatim, so this route adds no error handling of
 * its own beyond the shape check.
 */
export const POST = withHaiCore(async ({ client, request }) => {
  const raw = await request.json().catch(() => ({}));
  const forced = {
    ...(typeof raw === 'object' && raw !== null ? raw : {}),
    observation_class: 'grounded_forecast',
  };
  const parsed = CreateRunTemplateRequestSchema.safeParse(forced);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues } },
      { status: 400 },
    );
  }
  return NextResponse.json(await client.createRunTemplate(parsed.data));
}, { role: 'account_admin' });
