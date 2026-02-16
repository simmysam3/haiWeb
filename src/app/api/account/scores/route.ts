import { NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
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
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({
        composite: MOCK_SCORE_COMPOSITE,
        components: MOCK_SCORES,
        history: MOCK_SCORE_HISTORY,
      });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const [score, history] = await Promise.all([
      client.getScore(session.participant.id),
      client.getScoreHistory(session.participant.id),
    ]);

    return NextResponse.json({ score, history });
  } catch {
    return NextResponse.json({
      composite: MOCK_SCORE_COMPOSITE,
      components: MOCK_SCORES,
      history: MOCK_SCORE_HISTORY,
    });
  }
}
