import { Ban, CheckCircle2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getIncidentGuidance } from "../api/client";

function cacheKeyFor(report) {
  return [
    "rescueme-ai-guidance",
    report.report_id,
    report.title,
    report.description || "",
    report.category,
    report.urgency,
    report.status,
    report.agingLabel || "",
    report.verificationLabel || "",
    report.confidenceScore ?? ""
  ].join(":");
}

export default function AiIncidentGuidance({ report }) {
  const [guidance, setGuidance] = useState(null);
  const [state, setState] = useState("idle");
  const requestRef = useRef(null);
  const mountedRef = useRef(true);
  const cacheKey = useMemo(() => cacheKeyFor(report), [report]);
  const guidancePayload = useMemo(
    () => ({
      title: report.title,
      category: report.category,
      description: report.description || "",
      urgency: report.urgency,
      status: report.status,
      timestamp: report.timestamp,
      latitude: report.latitude,
      longitude: report.longitude,
      confidence_score: report.confidenceScore,
      verification_label: report.verificationLabel,
      aging_label: report.agingLabel
    }),
    [
      report.title,
      report.category,
      report.description,
      report.urgency,
      report.status,
      report.timestamp,
      report.latitude,
      report.longitude,
      report.confidenceScore,
      report.verificationLabel,
      report.agingLabel
    ]
  );

  useEffect(() => {
    let cached = null;

    try {
      cached = localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey);
    } catch {
      cached = null;
    }

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const cachedGuidance = parsed.guidance || parsed;
        if (cachedGuidance.source === "google-ai") {
          setGuidance(cachedGuidance);
          setState("ready");
          return;
        }
      } catch {
        try {
          sessionStorage.removeItem(cacheKey);
          localStorage.removeItem(cacheKey);
        } catch {
          // Ignore cache cleanup failures.
        }
        setGuidance(null);
      }
    }

    setGuidance(null);
    setState("idle");
  }, [cacheKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (requestRef.current) requestRef.current.abort();
    };
  }, []);

  function generateGuidance() {
    if (state === "loading") return;

    if (requestRef.current) requestRef.current.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    setState("loading");
    getIncidentGuidance(guidancePayload, { signal: controller.signal })
      .then((nextGuidance) => {
        if (controller.signal.aborted || !mountedRef.current) return;
        try {
          const serialized = JSON.stringify({ guidance: nextGuidance, cachedAt: Date.now() });
          if (nextGuidance.source === "google-ai") localStorage.setItem(cacheKey, serialized);
        } catch {
          // Guidance can still render if browser session storage is unavailable.
        }
        setGuidance(nextGuidance);
        setState("ready");
      })
      .catch((error) => {
        if (!mountedRef.current) return;
        if (controller.signal.aborted) {
          setGuidance({
            should_do: [],
            avoid: [],
            safety_note: "Gemini took too long to respond. Try again in a moment.",
            source: "local-fallback",
            model: null,
            unavailable_reason: "Gemini request timed out."
          });
          setState("error");
          return;
        }
        console.error("Gemini guidance request failed", error);
        setState("error");
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (requestRef.current === controller) requestRef.current = null;
      });
  }

  if (state === "idle") {
    return (
      <section className="ai-guidance-panel">
        <div className="ai-guidance-title">
          <Sparkles size={16} /> Incident guidance
          <span>Gemini</span>
        </div>
        <p className="ai-guidance-loading">Generate incident-specific guidance for this report with Gemini.</p>
        <button type="button" className="secondary ai-guidance-button" onClick={generateGuidance} disabled={state === "loading"}>
          <Sparkles size={16} /> Generate Gemini Guidance
        </button>
      </section>
    );
  }

  if (state === "loading") {
    return (
      <section className="ai-guidance-panel">
        <div className="ai-guidance-title">
          <Sparkles size={16} /> Incident guidance
        </div>
        <p className="ai-guidance-loading">Generating incident-specific guidance with Gemini. This can take a few seconds...</p>
      </section>
    );
  }

  if (state === "error" || !guidance) {
    return (
      <section className="ai-guidance-panel">
        <div className="ai-guidance-title">
          <Sparkles size={16} /> Incident guidance
        </div>
        <p className="ai-guidance-loading">
          {guidance?.unavailable_reason || guidance?.safety_note || "Gemini guidance is unavailable right now."}
        </p>
        <button type="button" className="secondary ai-guidance-button" onClick={generateGuidance} disabled={state === "loading"}>
          <Sparkles size={16} /> Try Gemini Again
        </button>
      </section>
    );
  }

  if (!guidance.should_do.length && !guidance.avoid.length) {
    return (
      <section className="ai-guidance-panel">
        <div className="ai-guidance-title">
          <Sparkles size={16} /> Incident guidance
          <span>Gemini unavailable</span>
        </div>
        <p className="ai-guidance-loading">{guidance.unavailable_reason || guidance.safety_note}</p>
        <button type="button" className="secondary ai-guidance-button" onClick={generateGuidance} disabled={state === "loading"}>
          <Sparkles size={16} /> Try Gemini Again
        </button>
      </section>
    );
  }

  return (
    <section className="ai-guidance-panel">
      <div className="ai-guidance-title">
        <Sparkles size={16} /> Incident guidance
        <span>{guidance.source === "google-ai" ? "Google AI" : "Gemini unavailable"}</span>
      </div>
      <div className="ai-guidance-grid">
        <div>
          <strong>
            <CheckCircle2 size={15} /> Best things to do
          </strong>
          {guidance.should_do.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <div>
          <strong>
            <Ban size={15} /> Avoid
          </strong>
          {guidance.avoid.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </div>
      <p className="ai-guidance-note">{guidance.safety_note}</p>
    </section>
  );
}
