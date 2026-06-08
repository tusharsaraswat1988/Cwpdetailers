import type { Request, Response, NextFunction, Router } from "express";
import { requirePermission } from "./auth";

const METHOD_TO_ACTION: Record<string, string> = {
  GET: "view",
  HEAD: "view",
  POST: "create",
  PUT: "edit",
  PATCH: "edit",
  DELETE: "delete",
};

/**
 * Wraps a sub-router so every request first runs the matching permission check
 * for `resource`. Method → action mapping is conventional (GET=view, etc.).
 * Specific routes may use POST for non-create flows (e.g. `/bulk-message`), so
 * pass a path matcher in `overrides` to map them to a different action.
 */
export function guardResource(
  resource: string,
  overrides: { match: RegExp; method?: string; action: string }[] = [],
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    const method = req.method.toUpperCase();
    let action = METHOD_TO_ACTION[method] ?? "view";
    for (const o of overrides) {
      if ((!o.method || o.method.toUpperCase() === method) && o.match.test(path)) {
        action = o.action;
        break;
      }
    }
    return requirePermission(resource, action)(req, res, next);
  };
}

/** Attach a guard to a router only for paths matching `prefix`. */
export function mountGuarded(parent: Router, prefix: string, child: Router, resource: string,
  overrides?: { match: RegExp; method?: string; action: string }[]) {
  parent.use(prefix, guardResource(resource, overrides), child);
}
