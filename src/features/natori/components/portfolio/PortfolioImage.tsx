import Image, { type ImageProps } from "next/image";
import { parsePortfolioAssetUrl } from "@/features/natori/lib/portfolioAssetUrl";

/** Managed images must reach their authorization/publication check on every GET. */
export default function PortfolioImage(props: ImageProps) {
  const managed =
    typeof props.src === "string" && parsePortfolioAssetUrl(props.src) !== null;
  return (
    <Image
      {...props}
      alt={props.alt}
      unoptimized={props.unoptimized || managed}
    />
  );
}
