import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { openDeliveryNotification, sealDeliveryNotification } from "../deliveryNotificationPayload";
afterEach(() => vi.unstubAllEnvs());
describe("delivery notification confidentiality", () => {
  it("stores ciphertext and recovers an unchanged request within its bounded lifetime", () => {
    vi.stubEnv("NATORI_DELIVERY_NOTIFICATION_KEY", "42".repeat(32));
    const payload = { text: "synthetic-private-link", to: ["client@example.invalid"] };
    const sealed = sealDeliveryNotification(payload, new Date(Date.now() + 60000).toISOString());
    expect(JSON.stringify(sealed)).not.toContain("synthetic-private-link");
    expect(openDeliveryNotification(sealed)).toEqual(payload);
  });
  it("fails closed for an expired payload, wrong key, or modified expiry", () => {
    vi.stubEnv("NATORI_DELIVERY_NOTIFICATION_KEY", "42".repeat(32));
    const past = sealDeliveryNotification({}, new Date(Date.now() - 1000).toISOString());
    expect(() => openDeliveryNotification(past)).toThrow();
    const sealed = sealDeliveryNotification({}, new Date(Date.now() + 60000).toISOString());
    vi.stubEnv("NATORI_DELIVERY_NOTIFICATION_KEY", "43".repeat(32));
    expect(() => openDeliveryNotification(sealed)).toThrow();
    vi.stubEnv("NATORI_DELIVERY_NOTIFICATION_KEY", "42".repeat(32));
    expect(() => openDeliveryNotification({ ...sealed as object, expiresAt: new Date(Date.now() + 120000).toISOString() })).toThrow();
  });
});
