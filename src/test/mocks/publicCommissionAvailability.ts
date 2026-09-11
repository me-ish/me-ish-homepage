export type PublicCommissionAvailability =
  | {
      kind: "ok";
      commissionOpen: boolean;
      massProductionIllustrationOpen: boolean;
    }
  | { kind: "unavailable" };

const DEFAULT_AVAILABILITY: PublicCommissionAvailability = {
  kind: "ok",
  commissionOpen: true,
  massProductionIllustrationOpen: true,
};

let currentAvailability: PublicCommissionAvailability = DEFAULT_AVAILABILITY;

export function setMockPublicCommissionAvailability(
  availability: PublicCommissionAvailability
) {
  currentAvailability = availability;
}

export function resetMockPublicCommissionAvailability() {
  currentAvailability = DEFAULT_AVAILABILITY;
}

export async function loadPublicCommissionAvailability(): Promise<PublicCommissionAvailability> {
  return currentAvailability;
}
