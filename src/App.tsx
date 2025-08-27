import React, { useEffect, useMemo, useState } from "react";
import { Droplet, Beaker, ShieldAlert, ClipboardCheck, Thermometer, FlaskConical, AlertTriangle, Info, History, HelpCircle } from "lucide-react";
import { Reading, Verdict, ValidatorReport, BodyType, Sanitizer, VisibleIssue, RecentAction, SafetyStatus, PlanStep } from './types';
import { ApiService } from './services/api';

// =============================
// Brand Config & Logo (SplashEasy)
// =============================

/**
 * SplashEasy — Brand Summary (for marketing use)
 * Category: Consumer web/mobile app
 * Audience: New & experienced pool & hot tub owners; residential service pros
 * Function: AI-powered assistant that tells users if water is safe, gives step-by-step adjustments, and teaches the "why" behind water chemistry.
 * Personality: Open, approachable, trustworthy; safety-first, clear, simple; a little fun; no overwhelming jargon.
 * Core Promise: "Pool and hot tub care made simple — get instant answers, easy steps, and clear water you can trust."
 * Visual: Aqua blue (trust, freshness), white/light gray (clarity), green (safe), orange/red (caution). Status indicators: Safe / Use with Caution / Not Safe.
 */
export const BRAND = {
  name: "SplashEasy",
  promise: "Pool and hot tub care made simple — get instant answers, easy steps, and clear water you can trust.",
  personality: ["Open", "Approachable", "Trustworthy", "Safety-first", "Clear", "Simple", "Fun"],
  colors: {
    aqua: "sky-600",
    surface: "white",
    bg: "slate-50",
    safeBg: "emerald-50",
    safeBorder: "emerald-300",
    cautionBg: "amber-50",
    cautionBorder: "amber-300",
    dangerBg: "rose-50",
    dangerBorder: "rose-300",
  },
} as const;

export function LogoSplashEasy({ className = "h-6 w-6" }: { className?: string }) {
  // Simple droplet + ripple placeholder logo (SVG). Replace later with final asset.
  return (
    <svg viewBox="0 0 64 64" aria-label="SplashEasy logo" className={className}>
      <defs>
        <linearGradient id="aqua" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Droplet */}
      <path d="M32 6C26 16 18 24 18 34c0 7.7 6.3 14 14 14s14-6.3 14-14C46 24 38 16 32 6z" fill="url(#aqua)" />
      {/* Ripple */}
      <ellipse cx="32" cy="52" rx="18" ry="4" fill="#bae6fd" />
    </svg>
  );
}


// =============================
// Constants
// =============================

// Brand: SplashEasy
// Category: Consumer web/mobile app
// Audience: New & experienced pool/hot tub owners; residential service pros
// Core Promise: "Pool and hot tub care made simple — get instant answers, easy steps, and clear water you can trust."
// Personality: Open, approachable, trustworthy. Safety-first, clear, simple, a little fun.
// Visual: Aqua blue, white/light gray, green (safe), orange/red (caution).


// =============================
// Validator (Local Input Validation)
// =============================

function reading_validator(r: Reading): ValidatorReport {
  const flags: string[] = [];
  let severity: ValidatorReport["severity"] = "info";
  let confidence = 0.95;

  const push = (msg: string, sev: ValidatorReport["severity"]) => {
    flags.push(msg);
    if (sev === "critical") severity = "critical";
    if (sev === "warn" && severity !== "critical") severity = "warn";
    if (sev === "critical") confidence = Math.min(confidence, 0.4);
    if (sev === "warn") confidence = Math.min(confidence, 0.75);
  };

  // Strip mode reduces confidence a bit
  if ((r.input_mode ?? "numeric") === "strip") {
    confidence = Math.min(confidence, 0.8);
  }

  // Unit sanity (numeric mode only)
  if ((r.input_mode ?? "numeric") !== "strip") {
    if (r.ph !== undefined && (r.ph as any) > 14) push("pH above 14 is impossible — retest pH.", "critical");
    if (r.ph !== undefined && r.ph < 0) push("pH below 0 is impossible — retest pH.", "critical");

    if (r.fc !== undefined && (r.fc < 0 || r.fc > 20)) push("FC outside plausible 0–20 ppm.", r.fc < 0 ? "critical" : "warn");
    if (r.br !== undefined && (r.br < 0 || r.br > 20)) push("Bromine outside plausible 0–20 ppm.", r.br < 0 ? "critical" : "warn");
    if (r.cc !== undefined && (r.cc < 0 || r.cc > 5)) push("CC outside plausible 0–5 ppm.", r.cc < 0 ? "critical" : "warn");
    if (r.ta !== undefined && (r.ta < 0 || r.ta > 250)) push("TA outside plausible 0–250 ppm.", r.ta < 0 ? "critical" : "warn");
    if (r.ch !== undefined && (r.ch < 0 || r.ch > 800)) push("CH outside plausible 0–800 ppm.", r.ch < 0 ? "critical" : "warn");
    if (r.cya !== undefined && r.cya !== null && (r.cya < 0 || r.cya > 200)) push("CYA outside plausible 0–200 ppm.", r.cya < 0 ? "critical" : "warn");
    if (r.salt_ppm !== undefined && r.salt_ppm !== null && (r.salt_ppm < 0 || r.salt_ppm > 6000)) push("Salt outside plausible 0–6000 ppm.", r.salt_ppm < 0 ? "critical" : "warn");
  }

  // Temperature
  if (r.temp_f !== undefined && (r.temp_f < 40 || r.temp_f > 105)) {
    const sev = r.body === "hot_tub" ? (r.temp_f > 105 ? "critical" : "warn") : "warn";
    push(`Temperature ${r.temp_f}°F looks out of typical range.`, sev);
  }

  // Logical combos
  if (r.sanitizer === "bromine" && r.cya && r.cya > 0) push("CYA is typically not applicable to bromine systems — verify.", "info");
  if (r.body === "pool" && r.ch !== undefined && r.ch < 150) push("CH below 150 ppm may etch plaster/heater metals — verify and raise if plaster.", "warn");
  if ((r.visible_issues || []).includes("algae")) push("Visible algae present — water not safe until treated.", "critical");

  return { flags, severity, confidence };
}

// =============================
// Fallback Verdict (When API Fails)
// =============================

function getFallbackVerdict(reading: Reading, validator: ValidatorReport): Verdict {
  return {
    safety: {
      status: "caution",
      reasons: ["AI analysis unavailable - using basic safety check"]
    },
    diagnosis: {
      primary_issues: ["Service unavailable"],
      secondary_risks: ["Manual testing recommended"]
    },
    action_plan: [{
      step: 1,
      action: "Retest water chemistry manually and consult local pool professional",
      order_of_operations: "Verify all readings before adding chemicals",
      retest_after_minutes: 60
    }],
    targets: reading.body === "hot_tub" ? {
      "Sanitizer": "3-5 ppm",
      "pH": "7.4-7.6", 
      "TA": "50-80 ppm",
      "CH": "150-250 ppm"
    } : {
      "FC": "1-3 ppm",
      "pH": "7.4-7.6",
      "TA": "60-90 ppm", 
      "CH": "200-400 ppm",
      "CYA": "30-50 ppm"
    },
    education: {
      quick_tips: ["Always add chemicals one at a time", "Keep pump running when adding chemicals"],
      notes: ["AI service temporarily unavailable - manual testing recommended"]
    },
    follow_up: {
      retest_checklist: ["All parameters"],
      when: "After 1 hour circulation",
      what_to_log: ["Before/after readings"]
    },
    validator,
    disclaimers: [
      "This is a fallback analysis due to service issues",
      "Consult pool professional for accurate assessment"
    ]
  };
}

// =============================
// UI Components
// =============================

function Chip({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-slate-700 bg-white shadow-sm">
      {icon} {children}
    </span>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white shadow p-4 md:p-6 border">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  suffix,
  placeholder,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center rounded-xl border bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-sky-200">
        <input
          className="w-full outline-none"
          placeholder={placeholder}
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="ml-2 text-xs text-slate-500">{suffix}</span>}
      </div>
    </label>
  );
}

function SafetyBanner({ status, reasons }: { status: SafetyStatus; reasons: string[] }) {
  const styles = {
    safe: "bg-emerald-50 border-emerald-300 text-emerald-800",
    caution: "bg-amber-50 border-amber-300 text-amber-800",
    not_safe: "bg-rose-50 border-rose-300 text-rose-800",
  } as const;
  const icons = {
    safe: <ClipboardCheck className="h-5 w-5" />,
    caution: <AlertTriangle className="h-5 w-5" />,
    not_safe: <ShieldAlert className="h-5 w-5" />,
  } as const;
  return (
    <div className={`rounded-2xl border p-4 md:p-5 flex gap-3 items-start ${styles[status]}`}>
      {icons[status]}
      <div>
        <div className="font-semibold capitalize">{status.replace("_", " ")}</div>
        <ul className="list-disc ml-5 text-sm mt-1">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ActionPlan({ steps }: { steps: PlanStep[] }) {
  return (
    <div className="grid gap-3">
      {steps.map((s) => (
        <div key={s.step} className="rounded-xl border p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="font-medium">Step {s.step}: {s.action}</div>
            <Beaker className="h-4 w-4 text-slate-500" />
          </div>
          {s.dosage && (
            <div className="mt-2 text-sm text-slate-700">
              <div><span className="font-semibold">Dosage:</span> {s.dosage.chemical} — {s.dosage.amount.value} {s.dosage.amount.unit}</div>
              {s.dosage.assumptions && <div className="text-slate-500">Assumptions: {s.dosage.assumptions}</div>}
            </div>
          )}
          {s.order_of_operations && (
            <div className="mt-2 text-sm"><span className="font-semibold">Order:</span> {s.order_of_operations}</div>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            {s.wait_time_minutes !== undefined && <Chip icon={<FlaskConical className="h-3 w-3" />}>Wait {s.wait_time_minutes} min</Chip>}
            {s.retest_after_minutes !== undefined && <Chip icon={<Droplet className="h-3 w-3" />}>Retest {s.retest_after_minutes} min</Chip>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Targets({ targets }: { targets: Record<string, string> }) {
  const entries = Object.entries(targets);
  return (
    <div className="grid gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm">
          <div className="font-medium">{k}</div>
          <div className="text-slate-600">{v}</div>
        </div>
      ))}
    </div>
  );
}

function Education({ tips, notes }: { tips: string[]; notes: string[] }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div className="text-sm font-semibold flex items-center gap-2"><Info className="h-4 w-4" /> Quick tips</div>
        <ul className="list-disc ml-5 text-sm text-slate-700">
          {tips.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>
      <div className="grid gap-2">
        <div className="text-sm font-semibold flex items-center gap-2"><Beaker className="h-4 w-4" /> Learn more</div>
        <ul className="list-disc ml-5 text-sm text-slate-700">
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </div>
    </div>
  );
}

// =============================
// Main App
// =============================

function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}

const DEFAULT_READING: Reading = {
  audience: "homeowner",
  body: "hot_tub",
  input_mode: "strip",
  volume_gal: undefined,
  sanitizer: "bromine",
  br: undefined,
  cc: undefined,
  ph: undefined,
  ta: undefined,
  ch: undefined,
  cya: null,
  temp_f: undefined,
  salt_ppm: null,
  visible_issues: [],
  recent_actions: [],
  region: "PNW",
  strip: { br: "unknown", cc: "unknown", ph: "unknown", ta: "unknown", ch: "unknown", cya: "unknown", fc: "unknown" },
};

export default function App() {
  const [reading, setReading] = useLocalStorage<Reading>("aquaguide:lastReading", DEFAULT_READING);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const validator = useMemo(() => reading_validator(reading), [reading]);

  // Form validation - check if required readings are provided
  const isFormValid = useMemo(() => {
    if (!reading.volume_gal || reading.volume_gal <= 0) return false;
    if (!reading.sanitizer) return false;
    
    if (reading.input_mode === "strip") {
      // For strip mode, require key readings to not be "unknown"
      const strip = reading.strip || {};
      if (reading.sanitizer === "bromine") {
        if (strip.br === "unknown") return false;
      } else {
        if (strip.fc === "unknown") return false;
      }
      if (strip.ph === "unknown") return false;
      if (strip.ta === "unknown") return false;
    } else {
      // For numeric mode, require key readings to be defined
      if (reading.sanitizer === "bromine") {
        if (reading.br === undefined || reading.br === null) return false;
      } else {
        if (reading.fc === undefined || reading.fc === null) return false;
      }
      if (reading.ph === undefined || reading.ph === null) return false;
      if (reading.ta === undefined || reading.ta === null) return false;
    }
    
    return true;
  }, [reading]);

  // Manual analysis function
  const analyzeReading = async () => {
    if (!isFormValid) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await ApiService.analyzeWater(reading);
      setVerdict(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      // Fallback to basic local validation
      setVerdict(getFallbackVerdict(reading, validator));
    } finally {
      setIsLoading(false);
    }
  };

  // Helpers to update fields safely
  const up = (patch: Partial<Reading>) => setReading({ ...reading, ...patch });

  const stripTips = () => {
    alert(
      `Strip tips:
• Dip for 1 sec, hold level.
• Wait the package time (15–30 sec).
• Read immediately in good light; colors drift after ~60 sec.
• Compare pad-by-pad; if between colors, pick the closest.
• Don't touch pads; check expiration.`
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoSplashEasy className="h-6 w-6" />
            <div className="font-semibold">SplashEasy</div>
            <span className="text-xs text-slate-500">MVP v0.2</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Chip icon={<History className="h-3 w-3" />}>Local history saved</Chip>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid md:grid-cols-2 gap-6">
        {/* Left: Reading Form */}
        <Section title="Enter Readings" icon={<Droplet className="h-5 w-5 text-sky-600" />}>
          <div className="grid grid-cols-2 gap-3">
            {/* Audience & Body */}
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Audience</span>
                <select
                  className="rounded-xl border bg-white px-3 py-2 shadow-sm"
                  value={reading.audience}
                  onChange={(e) => up({ audience: e.target.value as any })}
                >
                  <option value="homeowner">Homeowner</option>
                  <option value="pro">Pro</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Body</span>
                <select
                  className="rounded-xl border bg-white px-3 py-2 shadow-sm"
                  value={reading.body}
                  onChange={(e) => up({ body: e.target.value as BodyType })}
                >
                  <option value="pool">Pool</option>
                  <option value="hot_tub">Hot Tub</option>
                </select>
              </label>
            </div>

            {/* Input mode */}
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Measurement Mode</span>
                <select
                  className="rounded-xl border bg-white px-3 py-2 shadow-sm"
                  value={reading.input_mode ?? "numeric"}
                  onChange={(e) => up({ input_mode: e.target.value as any })}
                >
                  <option value="numeric">Numeric (drop-count/photometer)</option>
                  <option value="strip">Test Strip (color match)</option>
                </select>
              </label>
              {(reading.input_mode ?? "numeric") === "strip" ? (
                <button
                  type="button"
                  onClick={stripTips}
                  className="self-end rounded-xl border px-3 py-2 text-sm shadow-sm bg-white hover:bg-slate-50 flex items-center gap-2"
                >
                  <HelpCircle className="h-4 w-4" /> How to read a strip
                </button>
              ) : (
                <div className="self-end text-xs text-slate-500">Use exact readings from your kit or device.</div>
              )}
            </div>

            {/* Volume & Sanitizer */}
            <LabeledInput
              label="Volume *"
              value={reading.volume_gal}
              onChange={(v) => up({ volume_gal: Number(v) || undefined })}
              suffix="gal"
              placeholder="e.g. 350"
            />
            <label className="grid gap-1">
              <span className="text-sm text-slate-600">Sanitizer</span>
              <select
                className="rounded-xl border bg-white px-3 py-2 shadow-sm"
                value={reading.sanitizer}
                onChange={(e) => up({ sanitizer: e.target.value as Sanitizer })}
              >
                <option value="chlorine">Chlorine</option>
                <option value="bromine">Bromine</option>
                <option value="salt_chlorine">Salt Chlorine</option>
                <option value="baquacil">Baquacil</option>
                <option value="other">Other</option>
              </select>
            </label>

            {/* Measurements: numeric vs strip */}
            {(reading.input_mode ?? "numeric") === "strip" ? (
              <>
                {reading.sanitizer === "bromine" ? (
                  <label className="grid gap-1">
                    <span className="text-sm text-slate-600">Bromine (strip) *</span>
                    <select className="rounded-xl border bg-white px-3 py-2 shadow-sm" value={reading.strip?.br ?? "unknown"} onChange={(e)=> up({ strip: { ...reading.strip, br: e.target.value as any } })}>
                      {(["unknown","0","1","2","4","6","10+"] as const).map(v=> <option key={v} value={v}>{v === "unknown" ? "Select reading..." : v}</option>)}
                    </select>
                  </label>
                ) : (
                  <label className="grid gap-1">
                    <span className="text-sm text-slate-600">Free Chlorine (strip) *</span>
                    <select className="rounded-xl border bg-white px-3 py-2 shadow-sm" value={reading.strip?.fc ?? "unknown"} onChange={(e)=> up({ strip: { ...reading.strip, fc: e.target.value as any } })}>
                      {(["unknown","0","0.5","1","3","5","10+"] as const).map(v=> <option key={v} value={v}>{v === "unknown" ? "Select reading..." : v}</option>)}
                    </select>
                  </label>
                )}
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Combined Chlorine (strip)</span>
                  <select className="rounded-xl border bg-white px-3 py-2 shadow-sm" value={reading.strip?.cc ?? "unknown"} onChange={(e)=> up({ strip: { ...reading.strip, cc: e.target.value as any } })}>
                    {(["unknown","0","0.5+","1+"] as const).map(v=> <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">pH (strip) *</span>
                  <select className="rounded-xl border bg-white px-3 py-2 shadow-sm" value={reading.strip?.ph ?? "unknown"} onChange={(e)=> up({ strip: { ...reading.strip, ph: e.target.value as any } })}>
                    {(["unknown","6.8","7.2","7.5","7.8","8.2+"] as const).map(v=> <option key={v} value={v}>{v === "unknown" ? "Select reading..." : v}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Total Alkalinity (strip) *</span>
                  <select className="rounded-xl border bg-white px-3 py-2 shadow-sm" value={reading.strip?.ta ?? "unknown"} onChange={(e)=> up({ strip: { ...reading.strip, ta: e.target.value as any } })}>
                    {(["unknown","0","40","80","120","180","240+"] as const).map(v=> <option key={v} value={v}>{v === "unknown" ? "Select reading..." : v}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Calcium Hardness (strip)</span>
                  <select className="rounded-xl border bg-white px-3 py-2 shadow-sm" value={reading.strip?.ch ?? "unknown"} onChange={(e)=> up({ strip: { ...reading.strip, ch: e.target.value as any } })}>
                    {(["unknown","0","100","150","250","400","500+"] as const).map(v=> <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Cyanuric Acid (strip)</span>
                  <select className="rounded-xl border bg-white px-3 py-2 shadow-sm" value={reading.strip?.cya ?? "unknown"} onChange={(e)=> up({ strip: { ...reading.strip, cya: e.target.value as any } })}>
                    {(["unknown","0","30","50","80","100+"] as const).map(v=> <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Salt (strip)</span>
                  <select className="rounded-xl border bg-white px-3 py-2 shadow-sm" value={reading.strip?.salt ?? "unknown"} onChange={(e)=> up({ strip: { ...reading.strip, salt: e.target.value as any } })}>
                    {(["unknown","0","2000","3000","4000+"] as const).map(v=> <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              </>
            ) : (
              <>
                {reading.sanitizer === "bromine" ? (
                  <LabeledInput label="Bromine *" value={reading.br} onChange={(v) => up({ br: Number(v) || undefined })} suffix="ppm" placeholder="e.g. 3.0" />
                ) : (
                  <LabeledInput label="Free Chlorine *" value={reading.fc} onChange={(v) => up({ fc: Number(v) || undefined })} suffix="ppm" placeholder="e.g. 1.5" />
                )}
                <LabeledInput label="Combined Chlorine" value={reading.cc} onChange={(v) => up({ cc: Number(v) || undefined })} suffix="ppm" placeholder="e.g. 0.2" />
                <LabeledInput label="pH *" value={reading.ph} onChange={(v) => up({ ph: Number(v) || undefined })} placeholder="e.g. 7.4" />
                <LabeledInput label="Total Alkalinity *" value={reading.ta} onChange={(v) => up({ ta: Number(v) || undefined })} suffix="ppm" placeholder="e.g. 80" />
                <LabeledInput label="Calcium Hardness" value={reading.ch} onChange={(v) => up({ ch: Number(v) })} suffix="ppm" />
                <LabeledInput label="Cyanuric Acid" value={reading.cya ?? ""} onChange={(v) => up({ cya: v === "" ? null : Number(v) })} suffix="ppm" />
                <LabeledInput label="Temperature" value={reading.temp_f} onChange={(v) => up({ temp_f: Number(v) })} suffix="°F" />
                <LabeledInput label="Salt" value={reading.salt_ppm ?? ""} onChange={(v) => up({ salt_ppm: v === "" ? null : Number(v) })} suffix="ppm" />
              </>
            )}

            {/* Issues */}
            <label className="col-span-2 grid gap-1">
              <span className="text-sm text-slate-600">Visible Issues</span>
              <select
                multiple
                className="rounded-xl border bg-white px-3 py-2 shadow-sm min-h-[42px]"
                value={reading.visible_issues}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map((o) => o.value as VisibleIssue);
                  up({ visible_issues: opts });
                }}
              >
                {(["none", "cloudy", "algae", "scaling", "corrosion", "irritation", "odor"] as VisibleIssue[]).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>

            {/* Recent actions */}
            <label className="col-span-2 grid gap-1">
              <span className="text-sm text-slate-600">Recent Actions</span>
              <select
                multiple
                className="rounded-xl border bg-white px-3 py-2 shadow-sm min-h-[42px]"
                value={reading.recent_actions}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map((o) => o.value as RecentAction);
                  up({ recent_actions: opts });
                }}
              >
                {(["none", "shock", "refill", "rain", "heavy_use"] as RecentAction[]).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>

            {/* Required fields validation message */}
            {!isFormValid && (
              <div className="col-span-2">
                <div className="rounded-xl border border-blue-300 bg-blue-50 p-3">
                  <div className="font-medium mb-1 flex items-center gap-2">
                    <Info className="h-4 w-4" /> Required Test Readings
                  </div>
                  <div className="text-sm text-blue-700 mb-2">
                    To get an accurate analysis, please provide these essential readings:
                  </div>
                  <ul className="list-disc ml-5 text-sm text-blue-800">
                    {(!reading.volume_gal || reading.volume_gal <= 0) && <li>Volume (gallons)</li>}
                    {reading.input_mode === "strip" ? (
                      <>
                        {reading.sanitizer === "bromine" && reading.strip?.br === "unknown" && <li>Bromine level (from test strip)</li>}
                        {reading.sanitizer !== "bromine" && reading.strip?.fc === "unknown" && <li>Free Chlorine level (from test strip)</li>}
                        {reading.strip?.ph === "unknown" && <li>pH level (from test strip)</li>}
                        {reading.strip?.ta === "unknown" && <li>Total Alkalinity (from test strip)</li>}
                      </>
                    ) : (
                      <>
                        {reading.sanitizer === "bromine" && (reading.br === undefined || reading.br === null) && <li>Bromine level (ppm)</li>}
                        {reading.sanitizer !== "bromine" && (reading.fc === undefined || reading.fc === null) && <li>Free Chlorine level (ppm)</li>}
                        {(reading.ph === undefined || reading.ph === null) && <li>pH level</li>}
                        {(reading.ta === undefined || reading.ta === null) && <li>Total Alkalinity (ppm)</li>}
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Validator flags */}
            {validator.flags.length > 0 && (
              <div className="col-span-2">
                <div className={`rounded-xl border p-3 ${validator.severity === "critical" ? "border-rose-300 bg-rose-50" : validator.severity === "warn" ? "border-amber-300 bg-amber-50" : "border-sky-200 bg-sky-50"}`}>
                  <div className="font-medium mb-1 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Input checks
                    <span className="text-xs text-slate-500">Confidence {Math.round(validator.confidence * 100)}%</span>
                  </div>
                  <ul className="list-disc ml-5 text-sm text-slate-700">
                    {validator.flags.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* Submit button */}
            <div className="col-span-2 mt-4">
              <button
                type="button"
                onClick={analyzeReading}
                disabled={!isFormValid || isLoading}
                className={`w-full rounded-xl px-4 py-3 font-semibold text-white transition-colors ${
                  isFormValid && !isLoading
                    ? "bg-sky-600 hover:bg-sky-700"
                    : "bg-slate-300 cursor-not-allowed"
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Droplet className="h-5 w-5 animate-pulse" />
                    Analyzing Water Chemistry...
                  </div>
                ) : isFormValid ? (
                  <div className="flex items-center justify-center gap-2">
                    <Beaker className="h-5 w-5" />
                    Get Water Analysis
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Enter Required Test Readings First
                  </div>
                )}
              </button>
            </div>
          </div>
        </Section>

        {/* Right: Result */}
        <div className="grid gap-6">
          {isLoading ? (
            <Section title="Analyzing..." icon={<Droplet className="h-5 w-5 text-sky-600 animate-pulse" />}>
              <div className="flex items-center justify-center py-8">
                <div className="text-slate-600">AI is analyzing your water chemistry...</div>
              </div>
            </Section>
          ) : error ? (
            <Section title="Analysis Error" icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="text-amber-800 font-medium mb-1">Connection Issue</div>
                <div className="text-sm text-amber-700 mb-2">{error}</div>
                <div className="text-xs text-amber-600">Using fallback analysis below</div>
              </div>
            </Section>
          ) : !verdict ? (
            <Section title="Ready for Analysis" icon={<Droplet className="h-5 w-5 text-sky-600" />}>
              <div className="text-center py-8">
                <div className="mb-4">
                  <Beaker className="h-12 w-12 text-slate-300 mx-auto" />
                </div>
                <div className="text-slate-600 mb-2">Enter your water test readings on the left</div>
                <div className="text-sm text-slate-500">
                  We need at least: Volume, Sanitizer level, pH, and Total Alkalinity
                </div>
                <div className="mt-4 text-xs text-slate-400">
                  Pro tip: More readings = more accurate recommendations
                </div>
              </div>
            </Section>
          ) : null}
          
          {verdict && (
            <>
              <Section title="Safety Verdict" icon={<ShieldAlert className="h-5 w-5 text-sky-600" />}>
                <SafetyBanner status={verdict.safety.status} reasons={verdict.safety.reasons} />
              </Section>

              <Section title="Action Plan" icon={<Beaker className="h-5 w-5 text-sky-600" />}>
                <ActionPlan steps={verdict.action_plan} />
              </Section>

              <Section title="Targets" icon={<Thermometer className="h-5 w-5 text-sky-600" />}>
                <Targets targets={verdict.targets} />
              </Section>

              <Section title="Education" icon={<Info className="h-5 w-5 text-sky-600" />}>
                <Education tips={verdict.education.quick_tips} notes={verdict.education.notes} />
              </Section>

              <Section title="Follow Up" icon={<ClipboardCheck className="h-5 w-5 text-sky-600" />}>
                <div className="grid gap-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {verdict.follow_up.retest_checklist.map((c) => (
                      <Chip key={c}>{c}</Chip>
                    ))}
                  </div>
                  <div className="text-slate-700">{verdict.follow_up.when}</div>
                  <div className="text-slate-500">Log: {verdict.follow_up.what_to_log.join(", ")}</div>
                </div>
              </Section>

              <Section title="Disclaimers" icon={<Info className="h-5 w-5 text-sky-600" />}>
                <ul className="list-disc ml-5 text-sm text-slate-600">
                  {verdict.disclaimers.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </Section>
            </>
          )}
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} SplashEasy — MVP demo — SplashEasy brand build. Do not mix chemicals. Add with pump running.
      </footer>
    </div>
  );
}
