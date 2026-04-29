import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore(({ client }) => client.getDownstreamGaps());
