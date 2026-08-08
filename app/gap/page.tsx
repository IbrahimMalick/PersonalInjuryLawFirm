"use client";

import { useState } from "react";

// Cost of the Gap — the firm does its own arithmetic. Every number on screen
// derives live from the sliders; nothing is asserted.

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
}

function Slider({ label, value, min, max, step, format, onChange, hint }: SliderProps) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] text-inktext">{label}</span>
        <span className="font-mono font-semibold text-lg text-manila tabular-nums">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-1 accent-[var(--manila)] cursor-pointer"
        aria-label={label}
      />
      {hint && <div className="text-sm text-dim -mt-0.5">{hint}</div>}
    </label>
  );
}

export default function CostOfTheGap() {
  const [leads, setLeads] = useState(120);
  const [costPerLead, setCostPerLead] = useState(150);
  const [afterHoursPct, setAfterHoursPct] = useState(52);
  const [responsePct, setResponsePct] = useState(10);
  const [avgFee, setAvgFee] = useState(15000);
  const [signPct, setSignPct] = useState(20);

  const afterHoursLeads = leads * (afterHoursPct / 100);
  const unreached = afterHoursLeads * (1 - responsePct / 100);
  const lostCases = unreached * (signPct / 100);
  const lostFees = lostCases * avgFee;
  const wastedSpend = unreached * costPerLead;
  const annual = (lostFees + wastedSpend) * 12;

  return (
    <div className="px-6 pt-6 pb-10 max-w-[1280px] mx-auto grid grid-cols-[440px_minmax(0,1fr)] gap-10 items-start">
      {/* Inputs */}
      <section className="space-y-5 rounded-sm border border-ink-line bg-ink-raised px-5 py-5">
        <div>
          <h1 className="font-display font-bold uppercase tracking-wide text-2xl text-paper">
            Cost of the gap
          </h1>
          <p className="text-dim text-[15px] mt-1">
            Your numbers, your arithmetic. Drag anything.
          </p>
        </div>
        <Slider
          label="New leads per month"
          value={leads}
          min={20}
          max={400}
          step={5}
          format={(v) => String(v)}
          onChange={setLeads}
        />
        <Slider
          label="Cost per lead"
          value={costPerLead}
          min={25}
          max={500}
          step={5}
          format={money}
          onChange={setCostPerLead}
          hint="What you pay in ads and referrals for each inquiry"
        />
        <Slider
          label="Share arriving after hours"
          value={afterHoursPct}
          min={0}
          max={90}
          step={1}
          format={(v) => v + "%"}
          onChange={setAfterHoursPct}
          hint="Nights, weekends, holidays — when the office is dark"
        />
        <Slider
          label="After-hours leads reached within an hour today"
          value={responsePct}
          min={0}
          max={100}
          step={1}
          format={(v) => v + "%"}
          onChange={setResponsePct}
        />
        <Slider
          label="Average case fee"
          value={avgFee}
          min={2500}
          max={60000}
          step={500}
          format={money}
          onChange={setAvgFee}
        />
        <Slider
          label="Sign rate on leads you actually reach"
          value={signPct}
          min={5}
          max={50}
          step={1}
          format={(v) => v + "%"}
          onChange={setSignPct}
        />
      </section>

      {/* Output — the number is the headline */}
      <section aria-live="polite" className="pt-2">
        <div className="field-label text-dim">Walking out the door every month</div>
        <div className="font-mono font-semibold text-stamp tabular-nums leading-none text-[clamp(64px,8.5vw,124px)] mt-2">
          {money(lostFees + wastedSpend)}
        </div>

        <div className="mt-6 font-mono text-[15px] text-dim leading-7">
          <div>
            {Math.round(afterHoursLeads)} after-hours leads ×{" "}
            {100 - responsePct}% unreached ={" "}
            <span className="text-inktext">{Math.round(unreached)} people who got silence</span>
          </div>
          <div>
            {Math.round(unreached)} × {signPct}% sign rate ={" "}
            <span className="text-inktext">
              {lostCases.toFixed(1)} signed cases lost
            </span>{" "}
            × {money(avgFee)} = <span className="text-inktext">{money(lostFees)} in fees</span>
          </div>
          <div>
            plus {money(costPerLead)} already spent on each of the{" "}
            {Math.round(unreached)} ={" "}
            <span className="text-inktext">{money(wastedSpend)} in wasted ad spend</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 max-w-xl">
          <div className="border-t-2 border-ink-line pt-2">
            <div className="field-label text-dim">Lost fees / mo</div>
            <div className="font-mono text-2xl text-inktext tabular-nums">{money(lostFees)}</div>
          </div>
          <div className="border-t-2 border-ink-line pt-2">
            <div className="field-label text-dim">Wasted spend / mo</div>
            <div className="font-mono text-2xl text-inktext tabular-nums">
              {money(wastedSpend)}
            </div>
          </div>
          <div className="border-t-2 border-stamp pt-2">
            <div className="field-label text-stamp">Per year</div>
            <div className="font-mono text-2xl text-stamp tabular-nums">{money(annual)}</div>
          </div>
        </div>

        <p className="text-sm text-dim mt-8 max-w-xl leading-snug">
          Assumes an after-hours lead nobody reaches signs with whoever answered first —
          which is what the data on response time says happens. Adjust the sliders until you
          disagree with every input; the output is still yours.
        </p>
      </section>
    </div>
  );
}
