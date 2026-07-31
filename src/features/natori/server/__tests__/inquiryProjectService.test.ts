import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  mockCreateAdminProject,
  mockCreateIntake,
  mockDeleteReferences,
  mockFindLinkedReferences,
  mockResolveOwner,
} = vi.hoisted(() => ({
  mockCreateAdminProject: vi.fn(),
  mockCreateIntake: vi.fn(),
  mockDeleteReferences: vi.fn(),
  mockFindLinkedReferences: vi.fn(),
  mockResolveOwner: vi.fn(),
}));

vi.mock("@/features/natori/server/projectsService", () => ({
  createNatoriAdminProject: (...args: unknown[]) =>
    mockCreateAdminProject(...args),
}));

vi.mock("@/features/natori/server/intakeRpcAdapter", () => ({
  createNatoriIntakeViaRpc: (...args: unknown[]) => mockCreateIntake(...args),
  findLinkedNatoriIntakeReferencePaths: (...args: unknown[]) =>
    mockFindLinkedReferences(...args),
}));

vi.mock("@/features/natori/server/portfolioSiteService", () => ({
  deletePortfolioReferenceImages: (...args: unknown[]) =>
    mockDeleteReferences(...args),
}));

vi.mock("@/features/natori/server/natoriOwner", () => ({
  resolveNatoriActingUserId: (...args: unknown[]) => mockResolveOwner(...args),
}));

import {
  createInquiryProject,
  createStructuredInquiryProject,
} from "@/features/natori/server/inquiryProjectService";

const PROJECT_ID = "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c";
const OWNER_ID = "a2823bd4-9b9a-4ae0-b408-e2d131c2ba09";
const OTHER_PROJECT_ID = "ba24cb61-b3ff-4584-87f9-d549bc3af77d";
const REFERENCE_PATH = `${PROJECT_ID}/b65e16de-13c8-4bf6-a830-87f466815dba.webp`;

const consultationSubmission = {
  clientName: "テスト依頼者",
  clientEmail: "client@example.com",
  requestData: {
    schemaVersion: 1,
    formVersion: "etorie-request-v1",
    inquiryMode: "consultation",
    requestType: "undecided",
    requestTypeOther: null,
    commissionScope: "undecided",
    commissionScopeOther: null,
    options: [],
    usageTypes: [],
    usageTypeOther: null,
    commercialUse: "unknown",
    publicationPolicy: "unknown",
    budget: { kind: "undecided", min: null, max: null, currency: "JPY" },
    deadline: { kind: "undecided", date: null, note: "" },
    characterFeatures: "相談しながら決めたいです。",
    expressionMood: "",
    composition: "",
    colorDirection: "",
    referenceNotes: "",
    message: "",
    legacySource: null,
  },
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateIntake.mockResolvedValue({ kind: "ok", projectId: PROJECT_ID });
  mockDeleteReferences.mockResolvedValue(undefined);
  mockFindLinkedReferences.mockResolvedValue({ kind: "ok", linkedPaths: [] });
  mockResolveOwner.mockResolvedValue(OWNER_ID);
  mockCreateAdminProject.mockResolvedValue({
    kind: "ok",
    projectId: PROJECT_ID,
  });
});

describe("createStructuredInquiryProject", () => {
  it("validates and sends an undecided task-free project with normalized links", async () => {
    const referencePaths = [REFERENCE_PATH];
    const result = await createStructuredInquiryProject({
      submissionId: PROJECT_ID,
      submission: consultationSubmission,
      referencePaths,
      referenceLinks: [
        { url: "HTTPS://EXAMPLE.COM:443/a/?b=2&a=1#preview", label: "資料" },
      ],
    });

    expect(result).toEqual({ kind: "ok", projectId: PROJECT_ID });
    expect(mockCreateIntake).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      clientName: "テスト依頼者",
      clientEmail: "client@example.com",
      requestData: consultationSubmission.requestData,
      referenceFiles: referencePaths,
      referenceLinks: [
        {
          url: "HTTPS://EXAMPLE.COM:443/a/?b=2&a=1#preview",
          normalized_url: "https://example.com/a/?b=2&a=1",
          label: "資料",
          provider: null,
          sort_order: 0,
        },
      ],
    });
    expect(mockDeleteReferences).not.toHaveBeenCalled();
  });

  it("accepts quote intake while request type and scope are undecided", async () => {
    const quoteSubmission = {
      ...consultationSubmission,
      requestData: {
        ...consultationSubmission.requestData,
        inquiryMode: "quote" as const,
      },
    };

    await expect(
      createStructuredInquiryProject({
        submissionId: PROJECT_ID,
        submission: quoteSubmission,
        referencePaths: [],
        referenceLinks: [],
      }),
    ).resolves.toEqual({ kind: "ok", projectId: PROJECT_ID });

    expect(mockCreateIntake).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        projectId: PROJECT_ID,
        requestData: expect.objectContaining({
          inquiryMode: "quote",
          requestType: "undecided",
          commissionScope: "undecided",
        }),
      }),
    );
    expect(mockDeleteReferences).not.toHaveBeenCalled();
  });

  it("cleans up after a definite rejection but retains files for an unknown outcome", async () => {
    const referencePaths = [REFERENCE_PATH];
    mockCreateIntake.mockResolvedValueOnce({ kind: "rejected" });
    await expect(
      createStructuredInquiryProject({
        submissionId: PROJECT_ID,
        submission: consultationSubmission,
        referencePaths,
        referenceLinks: [],
      }),
    ).resolves.toEqual({ kind: "db-error" });
    expect(mockDeleteReferences).toHaveBeenCalledWith(referencePaths);

    vi.clearAllMocks();
    mockCreateIntake.mockResolvedValue({ kind: "unknown" });
    mockResolveOwner.mockResolvedValue(OWNER_ID);
    await expect(
      createStructuredInquiryProject({
        submissionId: PROJECT_ID,
        submission: consultationSubmission,
        referencePaths,
        referenceLinks: [],
      }),
    ).resolves.toEqual({ kind: "db-error" });
    expect(mockDeleteReferences).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mockCreateIntake.mockResolvedValue({ kind: "ok", projectId: PROJECT_ID });
    mockDeleteReferences.mockResolvedValue(undefined);
    mockResolveOwner.mockResolvedValue(OWNER_ID);
    await createStructuredInquiryProject({
      submissionId: PROJECT_ID,
      submission: consultationSubmission,
      referencePaths,
      referenceLinks: [],
    });
    expect(mockDeleteReferences).not.toHaveBeenCalled();
  });

  it("cleans safely scoped uploads when another input field fails validation", async () => {
    await expect(
      createStructuredInquiryProject({
        submissionId: PROJECT_ID,
        submission: {
          ...consultationSubmission,
          requestData: {
            ...consultationSubmission.requestData,
            schemaVersion: 2,
          },
        },
        referencePaths: [REFERENCE_PATH],
        referenceLinks: [],
      }),
    ).resolves.toEqual({ kind: "invalid-input" });
    expect(mockDeleteReferences).toHaveBeenCalledWith([REFERENCE_PATH]);
    expect(mockCreateIntake).not.toHaveBeenCalled();
  });

  it("never removes a path that is linked or cannot be reconciled", async () => {
    mockCreateIntake.mockResolvedValue({ kind: "rejected" });
    mockFindLinkedReferences.mockResolvedValueOnce({
      kind: "ok",
      linkedPaths: [REFERENCE_PATH],
    });
    await createStructuredInquiryProject({
      submissionId: PROJECT_ID,
      submission: consultationSubmission,
      referencePaths: [REFERENCE_PATH],
      referenceLinks: [],
    });
    expect(mockDeleteReferences).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mockCreateIntake.mockResolvedValue({ kind: "rejected" });
    mockResolveOwner.mockResolvedValue(OWNER_ID);
    mockFindLinkedReferences.mockResolvedValue({ kind: "unknown" });
    await createStructuredInquiryProject({
      submissionId: PROJECT_ID,
      submission: consultationSubmission,
      referencePaths: [REFERENCE_PATH],
      referenceLinks: [],
    });
    expect(mockDeleteReferences).not.toHaveBeenCalled();
  });

  it("cleans up validated uploads when link normalization or owner resolution fails", async () => {
    const referencePaths = [REFERENCE_PATH];
    await expect(
      createStructuredInquiryProject({
        submissionId: PROJECT_ID,
        submission: consultationSubmission,
        referencePaths,
        referenceLinks: [
          { url: "https://example.com/a#one" },
          { url: "https://example.com/a#two" },
        ],
      }),
    ).resolves.toEqual({ kind: "invalid-input" });
    expect(mockDeleteReferences).toHaveBeenCalledWith(referencePaths);
    expect(mockCreateIntake).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mockResolveOwner.mockResolvedValue(null);
    mockDeleteReferences.mockResolvedValue(undefined);
    await expect(
      createStructuredInquiryProject({
        submissionId: PROJECT_ID,
        submission: consultationSubmission,
        referencePaths,
        referenceLinks: [],
      }),
    ).resolves.toEqual({ kind: "no-owner" });
    expect(mockDeleteReferences).toHaveBeenCalledWith(referencePaths);
    expect(mockCreateIntake).not.toHaveBeenCalled();
  });

  it("rejects invalid V1 input, foreign paths, duplicate links, and more than five references", async () => {
    await expect(
      createStructuredInquiryProject({
        submissionId: PROJECT_ID,
        submission: {
          ...consultationSubmission,
          requestData: {
            ...consultationSubmission.requestData,
            schemaVersion: 2,
          },
        },
        referencePaths: [],
        referenceLinks: [],
      }),
    ).resolves.toEqual({ kind: "invalid-input" });

    await expect(
      createStructuredInquiryProject({
        submissionId: PROJECT_ID,
        submission: consultationSubmission,
        referencePaths: [
          `${OTHER_PROJECT_ID}/b65e16de-13c8-4bf6-a830-87f466815dba.webp`,
        ],
        referenceLinks: [],
      }),
    ).resolves.toEqual({ kind: "invalid-input" });

    await expect(
      createStructuredInquiryProject({
        submissionId: PROJECT_ID,
        submission: consultationSubmission,
        referencePaths: [],
        referenceLinks: [
          { url: "https://example.com/a#one" },
          { url: "https://example.com/a#two" },
        ],
      }),
    ).resolves.toEqual({ kind: "invalid-input" });

    await expect(
      createStructuredInquiryProject({
        submissionId: PROJECT_ID,
        submission: consultationSubmission,
        referencePaths: Array.from(
          { length: 6 },
          (_, index) =>
            `${PROJECT_ID}/b65e16de-13c8-4bf6-a830-87f466815db${index}.webp`,
        ),
        referenceLinks: [],
      }),
    ).resolves.toEqual({ kind: "invalid-input" });

    await expect(
      createStructuredInquiryProject({
        submissionId: PROJECT_ID,
        submission: consultationSubmission,
        referencePaths: [],
        referenceLinks: Array.from({ length: 6 }, (_, index) => ({
          url: `https://example.com/${index}`,
        })),
      }),
    ).resolves.toEqual({ kind: "invalid-input" });
    expect(mockCreateIntake).not.toHaveBeenCalled();
  });

  it("preserves the legacy creator and its original RPC path", async () => {
    await createInquiryProject({
      name: "依頼者",
      email: "client@example.com",
      requestType: "アイコン",
      plan: "胸上",
      options: [],
      budget: "相談",
      deadline: "相談",
      details: "詳細",
      message: "メッセージ",
      refUrls: "",
    });
    expect(mockCreateAdminProject).toHaveBeenCalledTimes(1);
    expect(mockCreateIntake).not.toHaveBeenCalled();
  });
});
