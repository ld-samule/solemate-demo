import { useFlags } from "launchdarkly-react-client-sdk";

const DEFAULT_TEXT = "Free shipping on all orders over $150!";
const DEFAULT_COLOR = "#F59E0B";

function contrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#000000" : "#FFFFFF";
}

export default function Banner() {
  const flags = useFlags();

  const showBanner = flags.topBanner ?? false;
  const bannerText = flags.bannerText ?? DEFAULT_TEXT;
  const bannerColor = flags.bannerColor ?? DEFAULT_COLOR;

  if (!showBanner) return null;

  return (
    <div
      className="w-full py-2.5 px-6 text-center text-sm font-semibold tracking-wide"
      style={{ backgroundColor: bannerColor, color: contrastColor(bannerColor) }}
    >
      {bannerText}
    </div>
  );
}
