import { withHaiCore } from "@/lib/with-hai-core";
import {
  MOCK_SCORES,
  MOCK_SCORE_COMPOSITE,
  MOCK_SCORE_HISTORY,
} from "@/lib/mock-data";

/**
 * GET /api/account/scores
 *
 * Returns behavioral scores from haiCore. Falls back to mock scores.
 */
export const GET = withHaiCore(
  async ({ client, session }) => {
    const [score, history] = await Promise.all([
      client.getScore(session.participant.id),
      client.getScoreHistory(session.participant.id),
    ]);
    return { score, history };
  },
  {
    fallback: {
      composite: MOCK_SCORE_COMPOSITE,
      components: MOCK_SCORES,
      history: MOCK_SCORE_HISTORY,
    },
  },
);
