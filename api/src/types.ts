export type BodyType = "pool" | "hot_tub";

export type Sanitizer = "chlorine" | "bromine" | "salt_chlorine" | "baquacil" | "other";

export type VisibleIssue = "cloudy" | "algae" | "scaling" | "corrosion" | "irritation" | "odor" | "none";

export type RecentAction = "shock" | "refill" | "rain" | "heavy_use" | "none";

export type SafetyStatus = "safe" | "caution" | "not_safe";

export type Reading = {
  audience: "homeowner" | "pro";
  body: BodyType;
  input_mode?: "numeric" | "strip";
  volume_gal: number;
  sanitizer: Sanitizer;
  fc?: number;
  br?: number;
  cc?: number;
  ph?: number;
  ta?: number;
  ch?: number;
  cya?: number | null;
  temp_f?: number;
  salt_ppm?: number | null;
  visible_issues: VisibleIssue[];
  recent_actions: RecentAction[];
  region?: string;
  strip?: {
    fc?: "0" | "0.5" | "1" | "3" | "5" | "10+" | "unknown";
    br?: "0" | "1" | "2" | "4" | "6" | "10+" | "unknown";
    cc?: "0" | "0.5+" | "1+" | "unknown";
    ph?: "6.8" | "7.2" | "7.5" | "7.8" | "8.2+" | "unknown";
    ta?: "0" | "40" | "80" | "120" | "180" | "240+" | "unknown";
    ch?: "0" | "100" | "150" | "250" | "400" | "500+" | "unknown";
    cya?: "0" | "30" | "50" | "80" | "100+" | "unknown";
    salt?: "0" | "2000" | "3000" | "4000+" | "unknown";
  };
};

export type ValidatorReport = {
  flags: string[];
  severity: "info" | "warn" | "critical";
  confidence: number;
};

export type PlanStep = {
  step: number;
  action: string;
  dosage?: { 
    chemical: string; 
    amount: { value: number; unit: string }; 
    assumptions?: string 
  };
  order_of_operations?: string;
  wait_time_minutes?: number;
  retest_after_minutes?: number;
};

export type Verdict = {
  safety: { status: SafetyStatus; reasons: string[] };
  diagnosis: { primary_issues: string[]; secondary_risks: string[] };
  action_plan: PlanStep[];
  targets: Record<string, string>;
  education: { quick_tips: string[]; notes: string[] };
  follow_up: { retest_checklist: string[]; when: string; what_to_log: string[] };
  validator: ValidatorReport;
  disclaimers: string[];
};