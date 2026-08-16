import type { ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";

const colors = {
  ink: "#edf4f1",
  paper: "#08131c",
  panel: "#0e1b25",
  line: "#263743",
  muted: "#94a2aa",
  permission: "#4ac39c",
  review: "#e6a13a",
  denial: "#ed766b",
  authority: "#7899ff"
} as const;

const easeOutCubic = Easing.out((value: number) => Easing.cubic(value));

function enter(frame: number, delay = 0): number {
  return interpolate(frame, [delay, delay + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOutCubic
  });
}

function exit(frame: number, duration: number): number {
  return interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
}

function sceneOpacity(frame: number, duration: number): number {
  return Math.min(enter(frame), exit(frame, duration));
}

function Shell({ children, section }: { children: ReactNode; section: string }) {
  return (
    <AbsoluteFill className="video-shell">
      <div className="video-grid" />
      <header className="video-header">
        <div className="video-brand"><span>C/</span><strong>CAPYN</strong></div>
        <div className="video-header-meta"><span>{section}</span><i /> PUBLIC ALPHA / v0.1</div>
      </header>
      {children}
      <footer className="video-footer">
        <span>AUTHORITY INFRASTRUCTURE FOR AUTONOMOUS AGENTS</span>
        <span>ALLOW / DENY / REQUIRE_APPROVAL</span>
      </footer>
    </AbsoluteFill>
  );
}

function Intro() {
  const frame = useCurrentFrame();
  const duration = 75;
  const titleProgress = spring({ frame, fps: 30, config: { damping: 22, stiffness: 90, mass: 0.9 } });
  return (
    <Shell section="THE AUTHORITY PROBLEM">
      <div className="intro" style={{ opacity: sceneOpacity(frame, duration) }}>
        <p className="eyebrow" style={{ opacity: enter(frame, 4) }}>AGENTS CAN ALREADY PAY.</p>
        <h1 style={{ opacity: titleProgress, transform: `translateY(${(1 - titleProgress) * 36}px)` }}>
          The missing layer<br /><span>is authority.</span>
        </h1>
        <div className="intro-rule" style={{ transform: `scaleX(${enter(frame, 18)})` }} />
        <p className="intro-copy" style={{ opacity: enter(frame, 25) }}>Capabilities. Limits. Approvals. Evidence before execution.</p>
      </div>
    </Shell>
  );
}

interface AuthorizationSceneProps {
  duration: number;
  index: string;
  amount: string;
  vendor: string;
  capability: string;
  decision: "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
  reason: string;
  accent: string;
  checks: Array<{ label: string; value: string; result: "PASS" | "REVIEW" | "FAIL" }>;
}

function AuthorizationScene({ duration, index, amount, vendor, capability, decision, reason, accent, checks }: AuthorizationSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const decisionProgress = spring({ frame: frame - 47, fps, config: { damping: 18, stiffness: 105, mass: 0.8 } });
  return (
    <Shell section={`AUTHORIZATION / ${index}`}>
      <div className="authorization" style={{ opacity: sceneOpacity(frame, duration) }}>
        <section className="request-panel" style={{ opacity: enter(frame, 3), transform: `translateX(${(1 - enter(frame, 3)) * -28}px)` }}>
          <p className="eyebrow">AGENT REQUEST</p>
          <div className="request-agent"><span className="status-pulse" /> procurement-agent</div>
          <p className="request-vendor">{vendor}</p>
          <p className="request-amount">{amount}</p>
          <div className="request-field"><span>CAPABILITY</span><strong>{capability}</strong></div>
          <div className="request-field"><span>CURRENCY</span><strong>USD</strong></div>
        </section>

        <section className="rail-panel">
          <p className="eyebrow">AUTHORITY RAIL</p>
          <div className="rail-line" style={{ transform: `scaleY(${enter(frame, 8)})` }} />
          <div className="rail-steps">
            {checks.map((check, checkIndex) => {
              const progress = enter(frame, 10 + checkIndex * 8);
              const resultColor = check.result === "PASS" ? colors.permission : check.result === "REVIEW" ? colors.review : colors.denial;
              return (
                <div className="rail-step" style={{ opacity: progress, transform: `translateX(${(1 - progress) * 22}px)` }} key={check.label}>
                  <span className="rail-index">{String(checkIndex + 1).padStart(2, "0")}</span>
                  <div><p>{check.label}</p><strong>{check.value}</strong></div>
                  <b style={{ color: resultColor }}>{check.result}</b>
                </div>
              );
            })}
          </div>
        </section>

        <section className="decision-panel" style={{ opacity: decisionProgress, transform: `translateX(${(1 - decisionProgress) * 38}px)`, borderColor: accent }}>
          <p className="eyebrow">DETERMINISTIC DECISION</p>
          <div className="decision-mark" style={{ color: accent, borderColor: accent }}>●</div>
          <p className="decision-word" style={{ color: accent }}>
            {decision === "REQUIRE_APPROVAL" ? <>REQUIRE_<br />APPROVAL</> : decision}
          </p>
          <p className="decision-reason">{reason}</p>
          <div className="decision-id">auth_request_bound</div>
        </section>
      </div>
    </Shell>
  );
}

function FinalScene() {
  const frame = useCurrentFrame();
  const duration = 165;
  const line = interpolate(frame, [15, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOutCubic });
  return (
    <Shell section="PUBLIC ALPHA">
      <div className="final-scene" style={{ opacity: sceneOpacity(frame, duration) }}>
        <div className="final-rail" style={{ transform: `scaleY(${line})` }} />
        <p className="eyebrow" style={{ opacity: enter(frame, 5) }}>CAPYN / v0.1</p>
        <h2 style={{ opacity: enter(frame, 14), transform: `translateY(${(1 - enter(frame, 14)) * 30}px)` }}>
          Give agents authority.<br /><span>Not unlimited access.</span>
        </h2>
        <p className="final-copy" style={{ opacity: enter(frame, 30) }}>Open-source policy engine · request-bound approvals · complete audit evidence</p>
        <div className="final-url" style={{ opacity: enter(frame, 48) }}>
          <span className="status-pulse" /> github.com/meanstackofdoom/capyn
        </div>
      </div>
    </Shell>
  );
}

export function CapynPublicAlpha() {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.paper }}>
      <Sequence from={0} durationInFrames={75}><Intro /></Sequence>
      <Sequence from={75} durationInFrames={135}>
        <AuthorizationScene duration={135} index="01" amount="$18.00" vendor="OpenAI" capability="spend.compute" decision="ALLOW" reason="ALL HARD RULES PASS" accent={colors.permission} checks={[
          { label: "Identity", value: "procurement-agent", result: "PASS" },
          { label: "Capability", value: "spend.compute", result: "PASS" },
          { label: "Vendor", value: "openai", result: "PASS" },
          { label: "Daily limit", value: "$18 / $200", result: "PASS" }
        ]} />
      </Sequence>
      <Sequence from={210} durationInFrames={120}>
        <AuthorizationScene duration={120} index="02" amount="$30.00" vendor="UnknownVendor" capability="spend.api" decision="DENY" reason="VENDOR_NOT_ALLOWED" accent={colors.denial} checks={[
          { label: "Identity", value: "procurement-agent", result: "PASS" },
          { label: "Capability", value: "spend.api", result: "PASS" },
          { label: "Vendor", value: "unknown", result: "FAIL" },
          { label: "Execution", value: "blocked", result: "FAIL" }
        ]} />
      </Sequence>
      <Sequence from={330} durationInFrames={135}>
        <AuthorizationScene duration={135} index="03" amount="$120.00" vendor="AWS" capability="spend.compute" decision="REQUIRE_APPROVAL" reason="THRESHOLD EXCEEDED / $100" accent={colors.review} checks={[
          { label: "Identity", value: "procurement-agent", result: "PASS" },
          { label: "Vendor", value: "aws", result: "PASS" },
          { label: "Hard ceiling", value: "$120 / $150", result: "PASS" },
          { label: "Approval", value: "above $100", result: "REVIEW" }
        ]} />
      </Sequence>
      <Sequence from={465} durationInFrames={90}>
        <AuthorizationScene duration={90} index="04" amount="$20.00" vendor="Wallet transfer" capability="transfer.wallet" decision="DENY" reason="CAPABILITY_NOT_GRANTED" accent={colors.denial} checks={[
          { label: "Identity", value: "procurement-agent", result: "PASS" },
          { label: "Mandate", value: "active / v1", result: "PASS" },
          { label: "Capability", value: "transfer.wallet", result: "FAIL" },
          { label: "Treasury", value: "protected", result: "PASS" }
        ]} />
      </Sequence>
      <Sequence from={555} durationInFrames={165}><FinalScene /></Sequence>
    </AbsoluteFill>
  );
}
