import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #c17a5e 0%, #9c4a37 100%)",
        }}
      >
        <span
          style={{
            display: "flex",
            fontSize: 20,
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
