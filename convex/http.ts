import { httpRouter } from "convex/server";

import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

http.route({
  path: "/activity/log",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }),
});

http.route({
  path: "/activity/log",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await request.json();

      if (typeof payload !== "object" || payload === null) {
        return Response.json(
          { ok: false, error: "Invalid payload" },
          { status: 400, headers: corsHeaders },
        );
      }

      const body = payload as {
        type?: string;
        title?: string;
        description?: string;
        metadata?: unknown;
        status?: string;
        timestamp?: number;
      };

      if (typeof body.type !== "string" || typeof body.title !== "string") {
        return Response.json(
          { ok: false, error: "type and title are required" },
          { status: 400, headers: corsHeaders },
        );
      }

      const activityId = await ctx.runMutation(api.activities.logFromHttp, {
        type: body.type as
          | "email"
          | "code"
          | "cron"
          | "search"
          | "message"
          | "file"
          | "browser"
          | "system",
        title: body.title,
        description: typeof body.description === "string" ? body.description : undefined,
        metadata: body.metadata,
        status:
          body.status === "success" || body.status === "error" || body.status === "pending"
            ? body.status
            : undefined,
        timestamp: typeof body.timestamp === "number" ? body.timestamp : undefined,
      });

      return Response.json(
        { ok: true, id: activityId },
        { status: 201, headers: corsHeaders },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to log activity";

      return Response.json(
        { ok: false, error: message },
        { status: 400, headers: corsHeaders },
      );
    }
  }),
});

export default http;
