// Mock jose since it's an ESM module that Jest can't transform in this config
jest.mock("jose", () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue("mock.jwt.token.12345"),
  })),
  jwtVerify: jest.fn().mockResolvedValue({
    payload: { userId: "user123", email: "test@example.com" },
  }),
}));

// Mock next/headers
jest.mock("next/headers", () => ({
  cookies: jest.fn().mockReturnValue({
    get: jest.fn().mockReturnValue(undefined),
  }),
}));

process.env.SESSION_SECRET = "test_secret_key_for_testing_32_chars_ok";

import { hashPassword, verifyPassword, signJWT, verifyJWT } from "@/lib/auth";

describe("Auth utilities", () => {
  describe("hashPassword / verifyPassword", () => {
    it("hashes a password to a bcrypt string", async () => {
      const hash = await hashPassword("testpassword123");
      expect(hash).toBeDefined();
      expect(hash).not.toBe("testpassword123");
      expect(hash.startsWith("$2")).toBe(true);
    });

    it("verifies a correct password against its hash", async () => {
      const hash = await hashPassword("correctpassword");
      const result = await verifyPassword("correctpassword", hash);
      expect(result).toBe(true);
    });

    it("rejects an incorrect password", async () => {
      const hash = await hashPassword("correctpassword");
      const result = await verifyPassword("wrongpassword", hash);
      expect(result).toBe(false);
    });

    it("produces different hashes for the same password (random salt)", async () => {
      const hash1 = await hashPassword("samepassword");
      const hash2 = await hashPassword("samepassword");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("signJWT", () => {
    it("returns a JWT string", async () => {
      const payload = { userId: "user123", email: "test@example.com" };
      const token = await signJWT(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token).toBe("mock.jwt.token.12345");
    });

    it("calls SignJWT with the correct payload", async () => {
      const { SignJWT } = require("jose");
      const payload = { userId: "user456", email: "verify@example.com" };
      await signJWT(payload);

      expect(SignJWT).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user456",
          email: "verify@example.com",
        })
      );
    });
  });

  describe("verifyJWT", () => {
    it("verifies a JWT and returns the payload", async () => {
      const decoded = await verifyJWT("some.valid.token");
      expect(decoded.userId).toBe("user123");
      expect(decoded.email).toBe("test@example.com");
    });

    it("throws for an invalid JWT", async () => {
      const { jwtVerify } = require("jose");
      (jwtVerify as jest.Mock).mockRejectedValueOnce(new Error("Invalid token"));

      await expect(verifyJWT("invalid.jwt.token")).rejects.toThrow();
    });
  });
});
