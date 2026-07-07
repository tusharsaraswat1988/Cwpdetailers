import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { guardWalkInRoutes, guardResource, WALK_IN_PATH_PREFIX } from "./permissions";

const requirePermissionMock = vi.fn();

vi.mock("./auth", () => ({
  requirePermission: (resource: string, action: string) => {
    requirePermissionMock(resource, action);
    return (_req: Request, _res: Response, next: NextFunction) => next();
  },
}));

function mockReq(method: string, path: string): Request {
  return { method, path } as Request;
}

function mockRes(): Response {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response;
}

describe("WALK_IN_PATH_PREFIX", () => {
  it("matches walk-in routes only", () => {
    expect(WALK_IN_PATH_PREFIX.test("/staff/walk-in/search")).toBe(true);
    expect(WALK_IN_PATH_PREFIX.test("/staff/walk-in/resolve")).toBe(true);
    expect(WALK_IN_PATH_PREFIX.test("/staff/walk-in/customer/42")).toBe(true);
    expect(WALK_IN_PATH_PREFIX.test("/staff")).toBe(false);
    expect(WALK_IN_PATH_PREFIX.test("/staff/42/verify")).toBe(false);
  });
});

describe("guardWalkInRoutes", () => {
  beforeEach(() => {
    requirePermissionMock.mockClear();
  });

  it("maps GET search to staff:view", () => {
    const next = vi.fn();
    guardWalkInRoutes()(mockReq("GET", "/staff/walk-in/search"), mockRes(), next);
    expect(requirePermissionMock).toHaveBeenCalledWith("staff", "view");
    expect(next).toHaveBeenCalled();
  });

  it("maps GET customer context to staff:view", () => {
    const next = vi.fn();
    guardWalkInRoutes()(mockReq("GET", "/staff/walk-in/customer/99"), mockRes(), next);
    expect(requirePermissionMock).toHaveBeenCalledWith("staff", "view");
    expect(next).toHaveBeenCalled();
  });

  it("maps POST resolve to bookings:edit", () => {
    const next = vi.fn();
    guardWalkInRoutes()(mockReq("POST", "/staff/walk-in/resolve"), mockRes(), next);
    expect(requirePermissionMock).toHaveBeenCalledWith("bookings", "edit");
    expect(next).toHaveBeenCalled();
  });

  it("skips non-walk-in paths", () => {
    const next = vi.fn();
    guardWalkInRoutes()(mockReq("POST", "/staff"), mockRes(), next);
    expect(requirePermissionMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe("guardResource staff CRUD excludes walk-in", () => {
  beforeEach(() => {
    requirePermissionMock.mockClear();
  });

  it("does not enforce staff:create on walk-in resolve", () => {
    const next = vi.fn();
    const guard = guardResource("staff", [], [WALK_IN_PATH_PREFIX]);
    guard(mockReq("POST", "/staff/walk-in/resolve"), mockRes(), next);
    expect(requirePermissionMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("still enforces staff:create on POST /staff", () => {
    const next = vi.fn();
    const guard = guardResource("staff", [], [WALK_IN_PATH_PREFIX]);
    guard(mockReq("POST", "/staff"), mockRes(), next);
    expect(requirePermissionMock).toHaveBeenCalledWith("staff", "create");
    expect(next).toHaveBeenCalled();
  });
});
