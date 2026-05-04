import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils";
import type { Appointment, WorkOrder, Company, Center, Staff } from "@shared/schema";

interface CardData {
  appointment: Appointment;
  workOrder: WorkOrder | null;
  company: Company | null;
  center: Center | null;
  assignedStaff: Staff | null;
  rmStaff: Staff | null;
  applicantPhotoUrl: string | null;
  serviceTypeName: string | null;
}

function formatDateParts(dt: Date): { weekday: string; date: string; time: string; hour: string; ampm: string } {
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekday = weekdays[dt.getDay()];
  const day = dt.getDate();
  const month = months[dt.getMonth()];
  const year = dt.getFullYear();
  let hours = dt.getHours();
  const mins = dt.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return {
    weekday,
    date: `${weekday}, ${day} ${month} ${year}`,
    time: `${hours}:${mins}`,
    hour: `${hours}:${mins}`,
    ampm,
  };
}

function AppleWalletButton({ token }: { token: string }) {
  const { data, isLoading } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/card", token, "wallet-check"],
    queryFn: async () => {
      const res = await fetch(`/api/card/${token}/wallet`, { method: "HEAD" }).catch(() => null);
      if (res?.status === 503) return { configured: false };
      return { configured: true };
    },
    retry: false,
    staleTime: Infinity,
  });

  if (isLoading || !data?.configured) return null;

  return (
    <div style={{ textAlign: "center", padding: "20px 32px 0" }}>
      <a
        href={`/api/card/${token}/wallet`}
        data-testid="link-add-to-wallet"
        style={{ display: "inline-block" }}
      >
        {/* Apple's official Add to Apple Wallet badge layout */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="220"
          height="60"
          viewBox="0 0 220 60"
          role="img"
          aria-label="Add to Apple Wallet"
        >
          <rect width="220" height="60" rx="12" fill="#000" />
          {/* Wallet icon - simplified wallet/card stack icon matching Apple's official badge */}
          <rect x="18" y="18" width="24" height="16" rx="3" fill="none" stroke="white" strokeWidth="1.5" />
          <rect x="18" y="26" width="24" height="8" rx="0" fill="white" opacity="0.3" />
          <rect x="22" y="31" width="4" height="3" rx="1" fill="white" />
          {/* Badge text */}
          <text x="55" y="26" fill="white" fontSize="10" fontFamily="-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif" fontWeight="300" letterSpacing="0.3">
            Add to
          </text>
          <text x="55" y="43" fill="white" fontSize="17" fontFamily="-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif" fontWeight="600" letterSpacing="-0.2">
            Apple Wallet
          </text>
        </svg>
      </a>
    </div>
  );
}

export default function CardPage() {
  const [, params] = useRoute("/card/:token");
  const token = params?.token;
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const appBaseUrl = import.meta.env.VITE_APP_BASE_URL;
  const cardUrl = appBaseUrl && token
    ? `${appBaseUrl}/card/${token}`
    : (typeof window !== "undefined" ? window.location.href : "");

  const { data, isLoading, error } = useQuery<CardData>({
    queryKey: ["/api/card", token],
    queryFn: async () => {
      const res = await fetch(`/api/card/${token}`);
      if (!res.ok) throw new Error("Invalid card link");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (!qrCanvasRef.current || !cardUrl || !data) return;
    QRCode.toCanvas(qrCanvasRef.current, cardUrl, {
      width: 100,
      margin: 1,
      color: { dark: "#1a2030", light: "#ffffff" },
    }).catch(() => {});
  }, [cardUrl, data]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif",
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px 64px",
        background: "radial-gradient(ellipse at 30% 20%, rgba(190,210,245,0.70) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(210,225,250,0.50) 0%, transparent 50%), #edf2f9",
      }}>
        <div style={{ width: "100%", maxWidth: "500px" }}>
          <div style={{ background: "rgba(255,255,255,0.72)", borderRadius: "26px", padding: "24px 32px 28px", border: "1px solid rgba(255,255,255,0.65)" }}>
            <Skeleton className="h-6 w-24 mb-4" />
            <Skeleton className="h-8 w-48 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "radial-gradient(ellipse at 30% 20%, rgba(190,210,245,0.70) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(210,225,250,0.50) 0%, transparent 50%), #edf2f9",
      }}>
        <div style={{
          width: "100%", maxWidth: "500px", textAlign: "center",
          background: "rgba(255,255,255,0.72)", borderRadius: "26px", padding: "40px 32px",
          border: "1px solid rgba(255,255,255,0.65)",
        }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "#1a2030", marginBottom: "8px" }}>Card Not Found</div>
          <div style={{ fontSize: "14px", color: "#8a9ab0", lineHeight: "1.6" }}>
            This appointment card link is invalid or has expired. Please contact us for assistance.
          </div>
        </div>
      </div>
    );
  }

  const { appointment, workOrder, company, center, assignedStaff, serviceTypeName } = data;

  const applicantName = workOrder?.applicantName ?? "—";
  const companyName = company?.name ?? "—";
  const centerName = center?.name ?? "—";
  const centerAddress = center?.address ?? "";
  const mapsUrl = center?.googleMapsUrl ?? `https://www.google.com/maps/search/${encodeURIComponent(centerName + " " + centerAddress)}`;
  const dt = new Date(appointment.datetime);
  const { date: dateStr, hour, ampm } = formatDateParts(dt);
  const initials = getInitials(applicantName);
  const guideInitials = assignedStaff?.name ? getInitials(assignedStaff.name) : "";
  const guidePhone = assignedStaff?.phone ?? "";

  const inkColor = "#1a2030";
  const inkMid = "#4a5568";
  const inkSoft = "#8a9ab0";
  const inkMute = "#b0beca";
  const accent = "#4a90d9";

  return (
    <div style={{
      fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif",
      WebkitFontSmoothing: "antialiased",
      minHeight: "100vh",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "40px 16px 64px",
      background: "radial-gradient(ellipse at 30% 20%, rgba(190,210,245,0.70) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(210,225,250,0.50) 0%, transparent 50%), #edf2f9",
    }}>
      <div
        data-testid="appointment-card"
        style={{
          width: "100%",
          maxWidth: "500px",
          borderRadius: "26px",
          overflow: "hidden",
          position: "relative",
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          border: "1px solid rgba(255,255,255,0.65)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.95) inset, 0 8px 32px rgba(60,90,140,0.10), 0 24px 56px rgba(60,90,140,0.07), 0 48px 72px rgba(60,90,140,0.04)",
          animation: "lift 0.65s cubic-bezier(0.22,1,0.36,1) forwards",
          opacity: 0,
          transform: "translateY(16px)",
        }}
      >
        <style>{`
          @keyframes lift { to { opacity:1; transform:translateY(0); } }
          @media (max-width: 420px) {
            .card-section-pad { padding-left: 20px !important; padding-right: 20px !important; }
            .card-section-margin { margin-left: 16px !important; margin-right: 16px !important; }
          }
        `}</style>

        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: `linear-gradient(90deg, transparent, ${accent} 25%, #6aaae8 50%, ${accent} 75%, transparent)`,
          zIndex: 10,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* TOP BAR */}
          <div className="card-section-pad" style={{ padding: "24px 32px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "7px", height: "7px", borderRadius: "50%",
                background: accent, boxShadow: "0 0 0 3px rgba(74,144,217,0.15)",
              }} />
              <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.08em", color: accent }}>
                Confirmed
              </span>
            </div>
            <div style={{ height: "28px", display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: inkColor, letterSpacing: "-0.01em" }}>
                The P.R.O. Company
              </span>
            </div>
          </div>

          {/* IDENTITY */}
          <div className="card-section-pad" style={{ padding: "24px 32px 0" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, color: inkColor, marginBottom: "10px" }}
              data-testid="text-company-name">
              {companyName}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {data.applicantPhotoUrl ? (
                <img
                  src={data.applicantPhotoUrl}
                  alt={applicantName}
                  style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", border: `1px solid rgba(74,144,217,0.20)`, flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "rgba(74,144,217,0.10)", border: "1px solid rgba(74,144,217,0.20)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", fontWeight: 700, color: accent, flexShrink: 0,
                }} data-testid="text-applicant-initials">
                  {initials}
                </div>
              )}
              <div>
                <div style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.015em", color: inkColor, lineHeight: 1.2 }}
                  data-testid="text-applicant-name">
                  {applicantName}
                </div>
                {serviceTypeName && (
                  <div style={{ fontSize: "11px", fontWeight: 400, color: inkSoft, marginTop: "2px" }}>
                    {serviceTypeName}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RULE */}
          <div style={{ margin: "24px 32px 0", height: "1px", background: "linear-gradient(90deg, rgba(74,144,217,0.20), rgba(74,144,217,0.06) 70%, transparent)" }} />

          {/* APPOINTMENT DATETIME */}
          <div className="card-section-pad" style={{ padding: "22px 32px 0" }}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: inkColor, letterSpacing: "-0.01em", lineHeight: 1.3, marginBottom: "4px" }}
              data-testid="text-appointment-date">
              {dateStr}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: accent, marginBottom: "6px" }}>
              <span data-testid="text-appointment-time">{hour}</span>
              {" "}
              <span style={{ fontSize: "14px", fontWeight: 400, opacity: 0.55, letterSpacing: "0.02em" }}>{ampm}</span>
            </div>
            <div style={{ fontSize: "11px", fontWeight: 500, color: inkSoft, letterSpacing: "0.01em", marginBottom: "14px" }}>
              Arrive by {new Date(dt.getTime() - 15 * 60000).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })} &nbsp;&middot;&nbsp; Est. 15 – 30 mins
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-location"
              style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                fontSize: "14px", fontWeight: 600, color: inkColor, textDecoration: "none",
                letterSpacing: "-0.01em", lineHeight: 1.35,
                borderBottom: "1px solid rgba(74,144,217,0.25)", paddingBottom: "1px",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              <span data-testid="text-center-name">{centerName}</span>
            </a>
          </div>

          {/* RULE */}
          <div style={{ margin: "22px 32px 0", height: "1px", background: "linear-gradient(90deg, rgba(74,144,217,0.20), rgba(74,144,217,0.06) 70%, transparent)" }} />

          {/* MEDICAL APPLICATION NO. */}
          {appointment.applicationNumber?.trim() && (
            <div className="card-section-margin" style={{
              margin: "18px 24px 0",
              padding: "14px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(74,144,217,0.18)",
              background: "rgba(74,144,217,0.04)",
            }} data-testid="section-application-number">
              <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: inkSoft, marginBottom: "6px" }}>
                Medical Application No.
              </div>
              <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", color: inkColor, lineHeight: 1 }}
                data-testid="text-application-number">
                {appointment.applicationNumber}
              </div>
            </div>
          )}

          {/* WHAT TO KEEP IN MIND */}
          <div className="card-section-pad" style={{ padding: "22px 32px 0" }}>
            <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: inkSoft, marginBottom: "10px" }}>
              What to keep in mind
            </div>
            {appointment.type === "EID" ? (
              <>
                <div style={{ fontSize: "14px", fontWeight: 600, color: inkColor, marginBottom: "3px" }}>
                  Bring your original passport and Emirates ID.
                </div>
                <div style={{ fontSize: "11px", fontWeight: 400, color: inkSoft, marginBottom: "12px" }}>
                  Both documents must be original — no copies accepted.
                </div>
                <div style={{ fontSize: "11px", fontWeight: 400, color: inkSoft, lineHeight: 1.6 }}>
                  Your guide will meet you on arrival and handle the queue and registration on your behalf.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "14px", fontWeight: 600, color: inkColor, marginBottom: "3px" }}>
                  Please bring your original passport.
                </div>
                <div style={{ fontSize: "11px", fontWeight: 400, color: inkSoft, marginBottom: "12px" }}>
                  Digital copies are not accepted at the center.
                </div>
                <div style={{ fontSize: "11px", fontWeight: 400, color: inkSoft, lineHeight: 1.6 }}>
                  Dress comfortably &#8212; loose, modest clothing works best.<br />
                  Leave jewellery at home. The examination includes an X-ray.
                </div>
              </>
            )}
          </div>

          {/* ON-SITE GUIDE */}
          {assignedStaff && (
            <a
              href={guidePhone ? `tel:${guidePhone}` : undefined}
              data-testid="link-guide-phone"
              className="card-section-margin"
              style={{
                margin: "22px 32px 0",
                padding: "12px 14px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(255,255,255,0.70)",
                boxShadow: "0 1px 0 rgba(255,255,255,0.95) inset, 0 2px 8px rgba(60,90,140,0.06)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textDecoration: "none",
                cursor: guidePhone ? "pointer" : "default",
              }}
            >
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                background: "rgba(74,144,217,0.10)", border: "1px solid rgba(74,144,217,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "9px", fontWeight: 700, color: accent, flexShrink: 0,
              }}>
                {guideInitials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: inkColor }}>{assignedStaff.name}</div>
                <div style={{ fontSize: "10px", fontWeight: 400, color: inkSoft, marginTop: "1px", lineHeight: 1.3 }}>{assignedStaff.roleTitle || "On-Site Support"}</div>
              </div>
              {guidePhone && (
                <div style={{ fontSize: "12px", fontWeight: 600, color: accent, flexShrink: 0 }}>{guidePhone}</div>
              )}
              {guidePhone && (
                <svg style={{ opacity: 0.28, flexShrink: 0, marginLeft: "2px" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              )}
            </a>
          )}

          {token && (
            <div className="card-section-pad" style={{ padding: "0" }}>
              <AppleWalletButton token={token} />
            </div>
          )}

          {/* QR CODE + COPY LINK */}
          <div className="card-section-margin" style={{
            margin: "20px 32px 0",
            padding: "14px",
            borderRadius: "14px",
            background: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.70)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.95) inset, 0 2px 8px rgba(60,90,140,0.06)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}>
            <div style={{ flexShrink: 0, borderRadius: "8px", overflow: "hidden", background: "white", padding: "4px" }}>
              <canvas ref={qrCanvasRef} data-testid="card-qr-code" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: inkColor, marginBottom: "4px" }}>Share This Card</div>
              <div style={{ fontSize: "10px", fontWeight: 400, color: inkSoft, lineHeight: 1.5, marginBottom: "8px" }}>
                Scan the QR code or copy the link to share this appointment card.
              </div>
              <button
                onClick={handleCopyLink}
                data-testid="button-copy-card-link"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: copied ? "#15803d" : accent,
                  background: copied ? "rgba(21,128,61,0.08)" : "rgba(74,144,217,0.08)",
                  border: `1px solid ${copied ? "rgba(21,128,61,0.20)" : "rgba(74,144,217,0.20)"}`,
                  borderRadius: "8px",
                  padding: "5px 10px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {copied ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20,6 9,17 4,12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copy Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* FOOTER */}
          <div className="card-section-margin" style={{
            margin: "20px 32px 0",
            padding: "16px 0 28px",
            borderTop: "1px solid rgba(74,144,217,0.10)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ fontSize: "11px", fontWeight: 400, color: inkSoft, lineHeight: 1.5 }}>
              <strong style={{ display: "block", fontSize: "11px", fontWeight: 600, color: inkMid, marginBottom: "1px" }}>Any questions?</strong>
              Your HR team can help with anything else.
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: inkColor, letterSpacing: "-0.01em" }}>The P.R.O. Company™</div>
              <div style={{ fontSize: "9px", fontWeight: 400, color: inkMute, marginTop: "1px" }}>Keystone Business Solutions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
