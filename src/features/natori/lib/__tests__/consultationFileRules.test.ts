import { describe, expect, it } from "vitest";
import { validConsultationFile } from "../consultationFileRules";

describe("consultation file restrictions", () => {
  it("accepts supported images, PDFs and audio at their size limits", () => {
    expect(validConsultationFile("資料.PNG", "image/png", 10 * 1024 * 1024)).toBe(true);
    expect(validConsultationFile("song.mp3", "audio/mpeg", 50 * 1024 * 1024)).toBe(true);
    expect(validConsultationFile("score.pdf", "application/pdf", 1000)).toBe(true);
  });

  it("rejects oversized files and mismatched or executable types", () => {
    expect(validConsultationFile("song.wav", "audio/wav", 50 * 1024 * 1024 + 1)).toBe(false);
    expect(validConsultationFile("score.pdf", "application/pdf", 10 * 1024 * 1024 + 1)).toBe(false);
    expect(validConsultationFile("portrait.png", "application/pdf", 1000)).toBe(false);
    expect(validConsultationFile("run.exe", "application/octet-stream", 1000)).toBe(false);
    expect(validConsultationFile("empty.mp3", "audio/mpeg", 0)).toBe(false);
  });
});
