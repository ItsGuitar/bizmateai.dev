import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
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
          background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)",
          borderRadius: "8px",
          color: "white",
          fontWeight: 900,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: "20px",
          letterSpacing: "-1px",
          position: "relative",
        }}
      >
        <span style={{ marginTop: "-2px" }}>B</span>
        <div
          style={{
            position: "absolute",
            top: "3px",
            right: "3px",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "#38BDF8",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
