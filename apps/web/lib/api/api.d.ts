/**
 * Auto-generated OpenAPI types — placeholder.
 *
 * Run `pnpm run gen:types` to regenerate from backend openapi.json:
 *   openapi-typescript ../backend/openapi.json -o lib/api/api.d.ts
 *
 * This file will be overwritten by openapi-typescript.
 */
export interface paths {
  "/api/v1/chat/completions": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            messages: { role: string; content: string }[];
            provider?: string | null;
            temperature?: number;
            max_tokens?: number;
          };
        };
      };
      responses: {
        200: {
          content: { "text/event-stream": string };
        };
      };
    };
  };
  "/api/v1/chat/completions/sync": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            messages: { role: string; content: string }[];
            provider?: string | null;
            temperature?: number;
            max_tokens?: number;
          };
        };
      };
      responses: {
        200: {
          content: {
            "application/json": {
              content: string;
              model: string;
              provider: string;
            };
          };
        };
      };
    };
  };
}
