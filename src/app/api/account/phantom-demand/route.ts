import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/phantom-demand
 *
 * Returns phantom demand usage and forecast from haiCore.
 * Falls back to empty data on error.
 */
export const GET = withHaiCore(
  async ({ client }) => {
    const [usage, forecast] = await Promise.all([
      client.getPhantomDemandUsage(),
      client.getPhantomDemandForecast(),
    ]);
    return { usage, forecast };
  },
  {
    fallback: {
      usage: { entries: [], total_requests: 0 },
      forecast: { entries: [] },
    },
  },
);
