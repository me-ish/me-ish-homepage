import { WAVY_UNDERLINE } from "../../constants/workspaceLook";

/** Decorative pen-stroke line under a heading. */
export function WavyUnderline({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block h-1.5 w-16 bg-repeat-x ${className}`} style={{ backgroundImage: WAVY_UNDERLINE }} />;
}
