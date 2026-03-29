import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 7,
          background: "#1a1a1a",
          border: "1px solid #333",
        }}
      >
        <svg
          width="18"
          height="18"
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
