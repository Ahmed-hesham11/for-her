import { ImageResponse } from "next/og";

export const alt = "FOR HER | More Than A Look";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f8f2ee 0%, #e9d3c7 100%)",
          color: "#1d1918",
        }}
      >
        <div style={{ display: "flex", fontSize: 120, fontWeight: 700, letterSpacing: "0.12em" }}>FOR HER</div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 38, letterSpacing: "0.3em", color: "#9c4a37" }}>MORE THAN A LOOK</div>
      </div>
    ),
    { ...size },
  );
}
