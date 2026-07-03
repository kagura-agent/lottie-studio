"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          color: "#e4e4e7",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div
            style={{
              fontSize: "48px",
              fontWeight: 700,
              letterSpacing: "-1px",
              marginBottom: "12px",
              color: "#71717a",
              fontFamily: "monospace",
            }}
          >
            :(
          </div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              marginBottom: "8px",
              color: "#e4e4e7",
            }}
          >
            Something Went Wrong
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#71717a",
              marginBottom: "24px",
              maxWidth: "360px",
              lineHeight: 1.6,
            }}
          >
            A critical error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: "#fff",
              color: "#09090b",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
