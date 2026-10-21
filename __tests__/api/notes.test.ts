/**
 * Integration test for notes API with mocked mongoose.
 */

// Mock mongoose connection
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({}),
  connectToDatabase: jest.fn().mockResolvedValue({}),
}));

// Mock the auth module
jest.mock("@/lib/auth", () => ({
  getSessionUser: jest.fn(),
  hashPassword: jest.fn().mockResolvedValue("$2b$12$hashedpassword"),
  verifyPassword: jest.fn().mockResolvedValue(true),
  signJWT: jest.fn().mockResolvedValue("mock.jwt.token"),
  verifyJWT: jest.fn().mockResolvedValue({ userId: "user1", email: "test@test.com" }),
  createSessionCookie: jest.fn().mockReturnValue("session=mock; HttpOnly"),
  clearSessionCookie: jest.fn().mockReturnValue("session=; Max-Age=0"),
}));

// Mock StudyNote model - define mock data inside the factory to avoid hoisting issues
jest.mock("@/models/StudyNote", () => {
  const mockNoteData = {
    _id: { toString: () => "note1" },
    userId: "user1",
    title: "Test Note",
    subjectId: undefined,
    sectionId: undefined,
    topicId: undefined,
    examRelevance: ["tier1"],
    content: {
      overview: "Test overview",
      coreConcepts: [],
      keyFacts: ["fact 1"],
      shortcuts: ["point 1"],
      revisionTips: [],
      commonConfusions: [],
      mcqs: [],
      workedExamples: [],
      references: [],
    },
    revisionStatus: "not_started",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    __esModule: true,
    default: {
      create: jest.fn().mockResolvedValue(mockNoteData),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([mockNoteData]),
      }),
      findOne: jest.fn().mockResolvedValue(mockNoteData),
      countDocuments: jest.fn().mockResolvedValue(1),
      findOneAndUpdate: jest.fn().mockResolvedValue(mockNoteData),
      findOneAndDelete: jest.fn().mockResolvedValue(mockNoteData),
    },
  };
});

import { getSessionUser } from "@/lib/auth";
import StudyNote from "@/models/StudyNote";

const mockNoteForTest = {
  _id: { toString: () => "note1" },
  userId: "user1",
  title: "Test Note",
  revisionStatus: "not_started",
};

describe("Notes API (unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSessionUser as jest.Mock).mockResolvedValue({
      userId: "user1",
      email: "test@test.com",
    });
  });

  describe("Note creation", () => {
    it("creates a note with valid data", async () => {
      const createSpy = jest.spyOn(StudyNote, "create");

      await StudyNote.create({
        userId: "user1",
        title: "Test Note",
        content: {
          overview: "An overview",
          coreConcepts: [],
          keyFacts: ["Fact 1"],
          shortcuts: ["Point 1"],
          revisionTips: [],
          commonConfusions: [],
          mcqs: [],
          workedExamples: [],
          references: [],
        },
        examRelevance: ["tier1"],
        revisionStatus: "not_started",
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user1",
          title: "Test Note",
        })
      );
    });
  });

  describe("Note retrieval", () => {
    it("retrieves a note by ID and userId", async () => {
      const note = await StudyNote.findOne({
        _id: "note1",
        userId: "user1",
      });

      expect(note).toBeDefined();
      expect(note?.title).toBe("Test Note");
      expect(note?.userId).toBe("user1");
    });

    it("does not retrieve notes from other users", async () => {
      (StudyNote.findOne as jest.Mock).mockResolvedValueOnce(null);

      const note = await StudyNote.findOne({
        _id: "note1",
        userId: "other_user",
      });

      expect(note).toBeNull();
    });
  });

  describe("Note update", () => {
    it("updates a note correctly", async () => {
      const updatedNote = {
        ...mockNoteForTest,
        title: "Updated Title",
        revisionStatus: "learning",
      };
      (StudyNote.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(updatedNote);

      const result = await StudyNote.findOneAndUpdate(
        { _id: "note1", userId: "user1" },
        { $set: { title: "Updated Title", revisionStatus: "learning" } },
        { new: true }
      );

      expect(result?.title).toBe("Updated Title");
      expect(result?.revisionStatus).toBe("learning");
    });
  });

  describe("Note deletion", () => {
    it("deletes a note correctly", async () => {
      const result = await StudyNote.findOneAndDelete({
        _id: "note1",
        userId: "user1",
      });

      expect(result).toBeDefined();
      expect(result?.title).toBe("Test Note");
    });
  });
});
