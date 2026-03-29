import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 38,
          background: "#1a1a1a",
          border: "2px solid #333",
        }}
      >
        <svg
          width="96"
          height="96"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#ededed" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
