'use client';
import type { SmCandidateResult2 as SmCandidateResult, SourcingMapExecutionResult2 } from '@/lib/sourcing-map/types';
import { EM_DASH, bandVar, bandWord, candidateKeyOf, modalBand, nodeTallies, pathGroups, underOf, utilBandWord } from '@/lib/sourcing-map/map/selectors';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';
import { NOT_TRACED_NOTE } from './option-card';
import { UtilizationBar } from './utilization-bar';

/** "IT (2), IN (1)"; a dash for an empty tally, as the Details tab shows an empty list. */
const tallyText = (tally: Array<[string, number]>) => (tally.length > 0 ? tally.map(([name, n]) => `${name} (${n})`).join(', ') : EM_DASH);

/** What is beneath an option, by tier and class group (LF spec §7, §8.1): the details panel's Path beneath tab. */
export function PathBeneath({ result, candidate: c, onOpenRow }: { result: SourcingMapExecutionResult2; candidate: SmCandidateResult; onOpenRow(alias: string): void }) {
  const agg = c.aggregates ?? null;
  const band = agg !== null ? modalBand(agg.utilization) : null;
  const { countries, classes } = nodeTallies(c);
  const key = candidateKeyOf(c);
  const traceNodes = new Map((c.trace?.nodes ?? []).map((t) => [t.alias, t]));
  return (
    <div className="mt-4">
      <h3 className="sm-muted text-xs">{`Path beneath ${c.supplier_name}`}</h3>
      {agg !== null && (
        <>
          <p className="mt-1">
            {[
              `${agg.responders} ${agg.responders === 1 ? 'responder' : 'responders'}`,
              agg.median_lead_time_days === null ? 'median withheld' : `median ${agg.median_lead_time_days} d`,
              ...(band !== null ? [`modal utilization ${utilBandWord(band)}`] : []),
              `${countries.length} ${countries.length === 1 ? 'country' : 'countries'}`,
            ].join(' · ')}
          </p>
          <div className="mt-1"><UtilizationBar utilization={agg.utilization} /></div>
        </>
      )}
      <p className="mt-1">{`Countries: ${tallyText(countries)}`}</p>
      <p className="mt-1">{`Classes: ${tallyText(classes)}`}</p>
      <p className="sm-muted mt-1 text-xs">Classes are shown at the deepest level the population floor allows.</p>
      {pathGroups(c).map((tier) => (
        <section key={tier.tier} role="group" aria-label={`Path beneath ${c.supplier_name}, tier ${tier.tier}`} className="mt-3">
          <h4 className="sm-muted text-xs">{`Tier ${tier.tier}`}</h4>
          {tier.groups.map((g) => (
            <div key={`${g.label}:${g.level}`} className="mt-2">
              <span>{g.label ?? 'No class'}</span>
              {g.level !== null && <span className="sm-muted ml-2">{`L${g.level}`}</span>}
              <ul className="mt-1">
                {g.nodes.map((n) => {
                  const t = traceNodes.get(n.alias);
                  const alsoUnder = underOf(result, n.alias).filter((k) => k !== key).length;
                  return (
                    <li key={n.alias}>
                      <button type="button" data-path-row={n.alias} onClick={() => onOpenRow(n.alias)} className="group sm-btn sm-btn-ghost flex w-full items-center gap-2 text-left text-xs">
                        <span>{`${n.alias} · ${n.country ?? EM_DASH}`}</span>
                        {n.band !== null && (
                          <>
                            {/* LF final review m-B: the word beside it names the band; a named dot would say it twice in the row's name */}
                            <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: bandVar(n.band) }} />
                            <span>{bandWord(n.band)}</span>
                          </>
                        )}
                        {t && <span>{t.role}</span>}
                        {t && t.binds_for > 1 && <span className="sm-warn">{`Binding for ${t.binds_for} options`}</span>}
                        {alsoUnder > 0 && <span className="sm-muted">{`also under ${alsoUnder}`}</span>}
                        {n.not_traced_below === true ? <span className="sm-warn">{NOT_TRACED_NOTE}</span> : !n.observed_below && <span className="sm-warn">not observed below</span>}
                        <span className="ml-auto flex"><DetailChevron /></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
