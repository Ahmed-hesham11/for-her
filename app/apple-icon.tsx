import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #c17a5e 0%, #9c4a37 100%)",
        }}
      >
        <span
          style={{
            display: "flex",
            fontSize: 108,
            fontWeight: 700,
            color: "#fdf8f4",
            letterSpacing: "-0.02em",
          }}
        >
          F
        </span>
      </div>
    ),
    { ...size },
  );
}
