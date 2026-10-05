import { describe, it, expect } from 'vitest';
import {
  ACTIVE_RISK_STATUSES, CAUSE_PILLS, DIMENSION_LABEL, RISK_STATUS_PILLS, backlogQuery, figureText, leadTimeText,
  loadErrorText, nextHref, openMapHref, originText, requestStatusText, windowText,
} from '../backlogs';
import { smRunHref } from '../routes';
import { riskOf } from '@/app/sourcing-map/__fixtures__/sp3';

describe('backlog selectors and labels', () => {
  it('builds the Open map href with every parameter encoded', () => {
    const m = { project_id: 'p1', template_id: 't1', execution_id: 'e1', option_key: '0:["u1","A&B#1"]' };
    const url = new URL(openMapHref(m), 'http://x');
    expect(url.pathname).toBe(smRunHref('p1', 't1'));
    expect(url.searchParams.get('execution')).toBe('e1');
    expect(url.searchParams.get('option')).toBe(m.option_key);
  });

  it('prints a zero figure as 0 and a null figure as a dash', () => {
    expect(figureText(0)).toBe('0');
    expect(figureText(1500)).toBe('1,500');
    expect(figureText(null)).toBe('—');
  });

  it('prints the origin through the class label, with a dash for a missing class or country', () => {
    const o = riskOf().origin;
    expect(originText(o)).toBe('tier 2 · Chemicals · IT · moderate');
    expect(originText({ ...o, class: null, country: null })).toBe('tier 2 · — · — · moderate');
  });

  it('labels the lead time by its kind, and is null without one', () => {
    expect(leadTimeText({ kind: 'calibrated_p50', days: 31, sample_count: 9 })).toBe('Calibrated p50: 31 d');
    expect(leadTimeText({ kind: 'calibrated_median', days: 42, sample_count: 4 })).toBe('Calibrated median: 42 d (4 orders)');
    expect(leadTimeText(null)).toBeNull();
  });

  it('words the direct supplier’s p90 beside its p50, and only there (§8.4)', () => {
    expect(leadTimeText({ kind: 'calibrated_p50', days: 30, sample_count: 12, p90_days: 45 })).toBe('Calibrated p50: 30 d · p90: 45 d');
    expect(leadTimeText({ kind: 'calibrated_p50', days: 30, sample_count: 12 })).toBe('Calibrated p50: 30 d');
    // a median never carries a p90, even when the object is cast to hold a stray one
    const stray = { kind: 'calibrated_median', days: 42, sample_count: 4, p90_days: 60 } as Parameters<typeof leadTimeText>[0];
    expect(leadTimeText(stray)).toBe('Calibrated median: 42 d (4 orders)');
  });

  it('words the request status', () => {
    expect(requestStatusText('request_closed')).toBe('Request closed');
    expect(requestStatusText('open')).toBe('Open');
  });

  it('writes a window with the year on both ends', () => {
    expect(windowText({ first: '2026-12-21', last: '2027-05-24' })).toBe('Dec 21, 2026 to May 24, 2027');
  });

  it('keeps the pill, active-status and dimension labels in the contract order', () => {
    expect(RISK_STATUS_PILLS.map((l) => l.label)).toEqual(['Open', 'Contacted', 'Resolving', 'Resolved', 'Accepted']);
    expect(RISK_STATUS_PILLS.map((l) => l.value)).toEqual(['open', 'contacted', 'resolving', 'resolved', 'accepted']);
    expect(ACTIVE_RISK_STATUSES).toEqual(['open', 'contacted', 'resolving']);
    expect(CAUSE_PILLS.map((l) => l.label)).toEqual(['Own capacity', 'Chain', 'Posture']);
    expect(CAUSE_PILLS.map((l) => l.value)).toEqual(['own_capacity', 'chain', 'posture']);
    expect(DIMENSION_LABEL).toEqual({
      fulfillment_reliability: 'Fulfillment reliability', response_time: 'Response time',
      price_adherence: 'Price adherence', agent_uptime: 'Agent uptime',
    });
  });

  it('builds the wire query with one parameter per value, then the cursor', () => {
    expect(backlogQuery('status', ['open', 'contacted'], 'c1')).toBe('status=open&status=contacted&cursor=c1');
    expect(backlogQuery('cause', ['chain'])).toBe('cause=chain');
  });

  it('links to the next page with the filter kept, and to nothing without a cursor', () => {
    expect(nextHref('/account/sonar/supply-risks', 'status', ['open'], 'c2')).toBe('/account/sonar/supply-risks?status=open&cursor=c2');
    expect(nextHref('/account/sonar/supply-risks', 'status', ['open'], null)).toBeNull();
  });

  it('words the load error by status, 0 included', () => {
    expect(loadErrorText(403, 'supply risks')).toBe('You do not have permission to view supply risks.');
    expect(loadErrorText(401, 'supply risks')).toBe('Your session has expired. Please sign in again.');
    expect(loadErrorText(500, 'demand exceptions')).toBe("Couldn't load demand exceptions. Try again in a moment.");
    expect(loadErrorText(0, 'supply risks')).toBe("Couldn't load supply risks. Try again in a moment.");
  });
});
