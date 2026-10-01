"use client";

/**
 * How scores work: the Quality Score (the Fathom criteria) in detail, the Urgency Score,
 * and how both make the priority and the matrix. Every number is read from
 * config/weights.yaml, and the worked example is a live deal, so the page cannot drift from
 * the calculation.
 */

import { Check, X } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { QUADRANT_COLOURS } from "@/components/MatrixChart";
import { DataTable, NUM, PageHeader } from "@/components/page";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrm } from "@/components/useCrm";
import * as repo from "@/lib/db/repository";
import { dealHref } from "@/lib/routes";
import { cockpitLines } from "@/lib/crm/views";
import { demoToday, loadTriageConfig } from "@/lib/triage/config";
import { DIMENSION_GUIDE, SCALE_GUIDE } from "@/lib/triage/fathomGuide";
import { pyFixed } from "@/lib/triage/py";
import { FATHOM_DIMENSIONS, ratedCount, ratingsOf, scoreBand, scoreCompany } from "@/lib/triage/scoring";
import { maxUrgencyRaw, QUADRANTS, urgencySummary, type QuadrantKey } from "@/lib/triage/urgency";

const SECTIONS = [
  { id: "quality", title: "Quality Score" },
  { id: "who-rates", title: "Who rates" },
  { id: "example", title: "Worked example" },
  { id: "urgency", title: "Urgency Score" },
  { id: "priority", title: "Attention Score and the matrix" },
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4 pt-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return <div className="rounded-lg bg-muted px-4 py-3 font-mono text-sm">{children}</div>;
}

export default function ScoringPage() {
  useCrm();
  const config = loadTriageConfig();
  const { fathom, urgency, matrix } = config;
  const labels = Object.fromEntries(FATHOM_DIMENSIONS.map((dimension) => [dimension.key, dimension.label]));

  return (
    <>
      <PageHeader
        title="How scores work"
        description="Every deal gets two scores. The Quality Score says how good an investment it looks; the Urgency Score says how pressing it is. Together they set the order of the cockpit and the place on the priority matrix."
      />

      <nav aria-label="On this page" className="mb-2 flex flex-wrap gap-2">
        {SECTIONS.map((section) => (
          <Button key={section.id} variant="outline" size="sm" asChild>
            <a href={`#${section.id}`}>{section.title}</a>
          </Button>
        ))}
      </nav>

      {/* ── Quality Score ─────────────────────────────────────────────────── */}
      <Section
        id="quality"
        title="Quality Score"
        description="The Fathom investment criteria for Pre-Seed and Seed: ten dimensions that almost every early-stage venture decision rests on, each rated from 1 to 5 and weighted by how much it matters."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>The formula</CardTitle>
              <CardDescription>Each dimension adds its weight in proportion to its rating.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Formula>
                Quality Score = Σ ( weight × rating / {fathom.scale_max} ) + storytelling bonus, capped at 100
              </Formula>
              <ul className="list-disc space-y-1 pl-5">
                <li>The weights add up to 100 %, so a deal rated {fathom.scale_max} everywhere scores 100.</li>
                <li>
                  A rating of 3 earns 60 % of a dimension&apos;s weight: Team (weight {fathom.weights.team} %) rated 3
                  adds {pyFixed((fathom.weights.team * 3) / fathom.scale_max, 1)} points.
                </li>
                <li>An unrated dimension adds nothing; it is not averaged in.</li>
                <li>
                  Storytelling &amp; design is an optional bonus of 0–{fathom.storytelling_bonus_max} points on top, for
                  how clearly the deck tells its story.
                </li>
                <li>Time in the queue is never part of the score.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>The rating scale</CardTitle>
              <CardDescription>What each point means, for the agent and for people alike.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rating</TableHead>
                    <TableHead>Meaning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SCALE_GUIDE.map((point) => (
                    <TableRow key={point.value}>
                      <TableCell className="font-semibold tabular-nums">
                        {point.value} <span className="font-normal text-muted-foreground">{point.label}</span>
                      </TableCell>
                      <TableCell className="whitespace-normal">{point.meaning}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>The ten dimensions and their weights</CardTitle>
            <CardDescription>
              Open a dimension for what is assessed and the signals that raise or lower its rating.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="rounded-lg border">
              {FATHOM_DIMENSIONS.map((dimension) => {
                const weight = fathom.weights[dimension.key];
                const guide = DIMENSION_GUIDE[dimension.key];
                return (
                  <AccordionItem key={dimension.key} value={dimension.key} className="px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <span className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 pr-2 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
                        <span className="font-medium">{dimension.label}</span>
                        <Progress value={weight * 5} className="hidden h-1.5 sm:block" aria-hidden="true" />
                        <Badge variant="secondary" className="tabular-nums">
                          {weight} %
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <p>
                        <span className="text-muted-foreground">What is assessed: </span>
                        {dimension.assesses}
                      </p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <SignalList tone="positive" items={guide.positive} />
                        <SignalList tone="negative" items={guide.negative} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Worth up to {weight} points: {pyFixed(weight / fathom.scale_max, 1)} per rating point.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reading the score</CardTitle>
            <CardDescription>
              Once all ten dimensions are rated, the score reads as a band. Until then the deal shows &ldquo;Provisional
              – x of 10 rated&rdquo;, so a half-rated deal never looks like a poor one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable>
              <TableHeader>
                <TableRow>
                  <TableHead>Quality Score</TableHead>
                  <TableHead>Band</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fathom.bands.map((band, index) => {
                  const upper = index === 0 ? 100 : fathom.bands[index - 1].min - 1;
                  return (
                    <TableRow key={band.label}>
                      <TableCell className="tabular-nums">
                        {band.min}–{upper} %
                      </TableCell>
                      <TableCell>{band.label}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </DataTable>
          </CardContent>
        </Card>
      </Section>

      {/* ── Who rates ────────────────────────────────────────────────────────── */}
      <Section
        id="who-rates"
        title="Who rates"
        description="Ratings come from the Fathom agent, and a person can change any of them. A person's rating always wins."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Pre-rated demo data</CardTitle>
              <CardDescription>The bundled demo companies, rated without any API call.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Each company starts from an assessment of its sector&apos;s deck text (for example: warehouse robotics
                has a large market and active strategic buyers, but unclear hardware economics). Its signals then move
                the dimensions they are evidence for:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  A senior hire: Team +1; a Head of Sales also Go-to-market +1, a VP Engineering Technology +1, a CFO
                  Financial plan +1.
                </li>
                <li>Passed EUR 1m ARR or doubled paying customers: Traction to 4, Business model +1.</li>
                <li>
                  A first enterprise customer: Traction to 3, Go-to-market +1. A pilot: Traction to 3, Problem–solution
                  fit +1.
                </li>
                <li>An announced round: Financial plan +1.</li>
                <li>Press and awards change no rating; they appear in the rationale.</li>
              </ul>
              <p className="text-muted-foreground">
                Where there is no evidence, a dimension stays at 2, and the rationale says so.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>The live Fathom agent</CardTitle>
              <CardDescription>For new companies the demo data does not cover.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                An AI model rates all ten dimensions and writes a three-sentence rationale: the overall picture, the
                strongest dimensions with their evidence, and what is missing.
              </p>
              <p>
                It only runs when someone presses <strong>Rate with the Fathom agent</strong> on{" "}
                <Link className="underline" href="/uploads">
                  Deal flow uploads
                </Link>
                , because it uses OpenAI credits.
              </p>
              <p className="text-muted-foreground">
                It sees company-level information only: deck text, one-liner, stage, round, channels and signals. Never
                founder names, email addresses or LinkedIn profiles, and it rates the team on evidence, not on people.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
              <CardDescription>The final word, on the deal page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Anyone can change a rating under <strong>Decide</strong> on the deal page; a preview shows the new score
                and band before saving.
              </p>
              <p>
                A person&apos;s ratings replace the agent&apos;s, are logged in the audit log, and are never overwritten
                by the agent, not even in a merge.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── Worked example ───────────────────────────────────────────────────── */}
      <Section
        id="example"
        title="Worked example"
        description="A live deal from the CRM, the highest Quality Score right now."
      >
        <WorkedExample labels={labels} />
      </Section>

      {/* ── Urgency Score ────────────────────────────────────────────────────── */}
      <Section
        id="urgency"
        title="Urgency Score"
        description="How pressing a deal is, built like the LP scoring matrix: five dimensions with point tables, a raw sum normalised to 0–100. It comes from obligations, relationships and news; how long a deal has waited never counts (that only raises the 14- and 21-day flags)."
      >
        <Card>
          <CardHeader>
            <CardTitle>The formula</CardTitle>
            <CardDescription>
              Always reported both ways, so a score can be audited back to its dimensions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Formula>
              raw = reply obligation + relationship + activity signal + competitive pressure + founder momentum (max{" "}
              {maxUrgencyRaw()})
              <br />
              Urgency Score = round( raw / {maxUrgencyRaw()} × 100 ) → e.g. &ldquo;63/100 (raw 75/{maxUrgencyRaw()}
              )&rdquo;
            </Formula>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <PointsCard
            title={`1 · Reply obligation (0–${Math.max(...Object.values(urgency.reply_obligation))})`}
            description={`An open warm intro, by its reply deadline of ${config.intro_reply_working_days} working days (weekends skipped). With several, the most recent counts.`}
            rows={[
              ["Past the deadline", urgency.reply_obligation.overdue],
              ["Day 3: due today, escalated to the responsible partner", urgency.reply_obligation.due_today],
              ["Day 2: reminder sent to the owner", urgency.reply_obligation.reminder],
              ["Open, within time", urgency.reply_obligation.open],
              ["No open warm intro", urgency.reply_obligation.none],
            ]}
          />
          <PointsCard
            title={`2 · Relationship proximity (0–${Math.max(...Object.values(urgency.relationship))})`}
            description="How close the founder is to the team."
            rows={[
              ["Warm intro from an LP, a portfolio founder or an angel", urgency.relationship.warm_intro],
              ["Reached out on two or more channels", urgency.relationship.repeat_contact],
              ["A single cold inbound", urgency.relationship.cold],
            ]}
          />
          <PointsCard
            title={`3 · Activity signal (0–${Math.max(...urgency.activity.map((band) => band.points))})`}
            description="How recent the latest signal is: a hire, traction, news or an announced round."
            rows={[
              ...urgency.activity.map((band) => [`In the last ${band.days} days`, band.points] as [string, number]),
              ["Older, or no signal", 0],
            ]}
          />
          <PointsCard
            title={`4 · Competitive pressure (0–${Math.max(...Object.values(urgency.competitive_pressure))})`}
            description={`What the latest signal says, if it is from the last ${urgency.competitive_pressure_days} days. A round announced by another lead means deciding now or losing the deal.`}
            rows={[
              ["A round announced by another lead", urgency.competitive_pressure.round_announced ?? 0],
              ["A traction update", urgency.competitive_pressure.traction_update ?? 0],
              ["A senior hire", urgency.competitive_pressure.senior_hire ?? 0],
              ["News", urgency.competitive_pressure.news ?? 0],
              [`No signal, or older than ${urgency.competitive_pressure_days} days`, 0],
            ]}
          />
          <PointsCard
            title={`5 · Founder momentum (0–${Math.max(...urgency.momentum.map((band) => band.points))})`}
            description="How recently the founder last got in touch: the latest inbound, never the first one, so waiting in the queue cannot raise it."
            rows={[
              ...urgency.momentum.map(
                (band) => [`Latest inbound in the last ${band.days} days`, band.points] as [string, number],
              ),
              ["Longer ago", 0],
            ]}
          />
          <Card>
            <CardHeader>
              <CardTitle>Tiers</CardTitle>
              <CardDescription>On the normalised score, with what to do.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Urgency Score</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {urgency.tiers.map((tier, index) => (
                    <TableRow key={tier.label}>
                      <TableCell className="tabular-nums">
                        {tier.min}–{index === 0 ? 100 : urgency.tiers[index - 1].min - 1}
                      </TableCell>
                      <TableCell className="font-medium">{tier.label}</TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">{tier.action}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </CardContent>
          </Card>
        </div>

        <UrgencyExample />
      </Section>

      {/* ── Priority ─────────────────────────────────────────────────────────── */}
      <Section
        id="priority"
        title="Attention Score and the matrix"
        description="The two scores combine into the order of the cockpit and the four quadrants of the priority matrix."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Attention Score</CardTitle>
              <CardDescription>Which deal needs the team&apos;s attention first: the order of every worklist.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Formula>Attention Score = Quality Score × Urgency Score / 100</Formula>
              <p>
                Ties go to the higher Quality Score, then the higher Urgency Score, then the name. A rank a person
                pins on the deal page keeps its place, with the reason logged.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>The four quadrants</CardTitle>
              <CardDescription>
                Split at Quality Score {matrix.score_split} % (the watchlist line) and Urgency Score{" "}
                {matrix.urgency_split}, where the &ldquo;Soon&rdquo; tier starts (open warm intros land above it).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {(["reply_fast", "act_now", "park", "plan"] as QuadrantKey[]).map((key) => (
                <div
                  key={key}
                  className="relative overflow-hidden rounded-lg border p-3 pl-4"
                  style={{ "--quadrant": QUADRANT_COLOURS[key] } as CSSProperties}
                >
                  <span className="absolute inset-y-0 left-0 w-1 bg-(--quadrant)" aria-hidden="true" />
                  <p className="font-medium">{QUADRANTS[key][0]}</p>
                  <p className="text-xs text-muted-foreground">{QUADRANTS[key][1]}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Section>
    </>
  );
}

function SignalList({ tone, items }: { tone: "positive" | "negative"; items: string[] }) {
  const Icon = tone === "positive" ? Check : X;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {tone === "positive" ? "Raises the rating" : "Lowers the rating"}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Icon
              className={
                tone === "positive"
                  ? "mt-0.5 size-4 shrink-0 text-success-foreground"
                  : "mt-0.5 size-4 shrink-0 text-error-foreground"
              }
              aria-hidden="true"
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkedExample({ labels }: { labels: Record<string, string> }) {
  const { fathom } = loadTriageConfig();
  const company = repo
    .listCompanies()
    .filter((candidate) => ratedCount(candidate) === FATHOM_DIMENSIONS.length)
    .sort((a, b) => b.score - a.score)[0];
  if (!company) {
    return <p className="text-muted-foreground">No fully rated deal yet.</p>;
  }
  const [score, breakdown] = scoreCompany(ratingsOf(company), fathom);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link className="hover:underline" href={dealHref(company.id, "/scoring")}>
            {company.name}
          </Link>{" "}
          <span className="font-normal text-muted-foreground">· {company.one_liner}</span>
        </CardTitle>
        <CardDescription>
          {pyFixed(score, 1)} % · {scoreBand(score, ratedCount(company), fathom)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>Dimension</TableHead>
              <TableHead className={NUM}>Rating</TableHead>
              <TableHead className={NUM}>Weight</TableHead>
              <TableHead className={NUM}>Calculation</TableHead>
              <TableHead className={NUM}>Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.map((row) => (
              <TableRow key={row.component}>
                <TableCell>{labels[row.component] ?? "Storytelling bonus"}</TableCell>
                <TableCell className={NUM}>{row.value ?? "–"}</TableCell>
                <TableCell className={NUM}>{row.weight ? `${row.weight} %` : "bonus"}</TableCell>
                <TableCell className={`${NUM} text-muted-foreground`}>
                  {row.value === null
                    ? "not rated"
                    : row.weight
                      ? `${row.weight} × ${row.value} / ${fathom.scale_max}`
                      : `+${row.value}`}
                </TableCell>
                <TableCell className={NUM}>{pyFixed(row.points, 1)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold hover:bg-transparent">
              <TableCell colSpan={4}>Quality Score</TableCell>
              <TableCell className={NUM}>{pyFixed(score, 1)}</TableCell>
            </TableRow>
          </TableBody>
        </DataTable>
        {company.rating_rationale ? (
          <blockquote className="border-l-2 pl-4 text-sm text-muted-foreground italic">
            {company.rating_rationale}
          </blockquote>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PointsCard({ title, description, rows }: { title: string; description: string; rows: [string, number][] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>Signal</TableHead>
              <TableHead className={NUM}>Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(([label, points]) => (
              <TableRow key={label}>
                <TableCell className="whitespace-normal">{label}</TableCell>
                <TableCell className={NUM}>{points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </CardContent>
    </Card>
  );
}

/** A live example: the most urgent open deal right now, dimension by dimension. */
function UrgencyExample() {
  const line = cockpitLines(demoToday())
    .filter((candidate) => candidate.company.status === "open" && candidate.company.passed_hard_filters)
    .sort((a, b) => b.urgency - a.urgency)[0];
  if (!line) return null;
  const breakdown = line.urgency_breakdown;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Example:{" "}
          <Link className="hover:underline" href={dealHref(line.company.id, "/scoring")}>
            {line.company.name}
          </Link>
        </CardTitle>
        <CardDescription>
          The most urgent open deal right now: {urgencySummary(breakdown)}. {breakdown.tier.action}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>Dimension</TableHead>
              <TableHead>Why</TableHead>
              <TableHead className={NUM}>Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.rows.map((row) => (
              <TableRow key={row.dimension}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{row.note}</TableCell>
                <TableCell className={NUM}>
                  {row.points} / {row.max}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold hover:bg-transparent">
              <TableCell colSpan={2}>
                Raw sum → round({breakdown.raw} / {breakdown.max_raw} × 100)
              </TableCell>
              <TableCell className={NUM}>
                {breakdown.raw} → {breakdown.score}
              </TableCell>
            </TableRow>
          </TableBody>
        </DataTable>
      </CardContent>
    </Card>
  );
}
