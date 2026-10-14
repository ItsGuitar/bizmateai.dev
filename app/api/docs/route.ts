import { NextResponse } from "next/server";

export async function GET() {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "BizMateAI • SME Financial Copilot API",
      version: "1.0.0",
      description:
        "Official API documentation for BizMateAI Autonomous Multi-Agent Financial Copilot. Features server-enforced deterministic guardrails, zero-surprise approval workflows, and immutable audit logging.",
      contact: {
        name: "BizMateAI Developer Platform",
        email: "dpo@bizmate.co",
      },
    },
    servers: [
      {
        url: "/",
        description: "Current Host Server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token obtained from `/api/auth/login` or `/api/auth/register`",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", example: "cmv5fop600000uz6kiibnw4by" },
            email: { type: "string", example: "owner@company.com" },
            businessName: { type: "string", example: "Ploy Select Co., Ltd." },
            role: { type: "string", example: "OWNER" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/User" },
            token: { type: "string", description: "Signed JWT Bearer token valid for 7 days" },
          },
        },
        InboxItem: {
          type: "object",
          properties: {
            id: { type: "string" },
            agentId: { type: "string", enum: ["health", "cash", "funding", "collections", "true-cost", "trust"] },
            title: { type: "string" },
            description: { type: "string" },
            impact: { type: "string" },
            requiresFaceId: { type: "boolean" },
            status: { type: "string", enum: ["PENDING", "APPROVED", "DECLINED"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        AuditLog: {
          type: "object",
          properties: {
            id: { type: "string" },
            agentId: { type: "string" },
            action: { type: "string" },
            status: { type: "string", enum: ["DONE", "SENT", "FLAGGED", "BLOCKED"] },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Invalid credentials" },
          },
        },
      },
    },
    paths: {
      "/api/auth/register": {
        post: {
          tags: ["Authentication"],
          summary: "Register new business owner account",
          description: "Creates a new user, hashes password with bcrypt, initializes initial inbox items and audit records, and returns JWT token.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email", example: "owner@ployselect.com" },
                    password: { type: "string", format: "password", example: "Password123!" },
                    businessName: { type: "string", example: "Ploy Select Co., Ltd." },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Account created successfully",
              content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
            },
            400: {
              description: "Missing email or password",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
            409: {
              description: "Email already registered",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "Sign in with email and password",
          description: "Authenticates credentials and issues signed JWT Bearer token.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email", example: "owner@ployselect.com" },
                    password: { type: "string", format: "password", example: "Password123!" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Authenticated successfully",
              content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
            },
            401: {
              description: "Invalid credentials",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Authentication"],
          summary: "Get current authenticated profile",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Profile retrieved successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { user: { $ref: "#/components/schemas/User" } },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/api/chat": {
        post: {
          tags: ["Multi-Agent AI Chat"],
          summary: "Query the autonomous multi-agent copilot",
          description: "Sends natural language query to the 6 specialized agents. Persists conversation and agent reasoning trace into database.",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: {
                    message: {
                      type: "string",
                      example: "Will my cash dip below the 80k buffer if I pay Shenzhen Chen Tech on due date?",
                    },
                    sessionId: { type: "string", description: "Optional conversation session ID" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Agent deliberated response with reasoning trace",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      sessionId: { type: "string" },
                      agentId: { type: "string" },
                      reply: { type: "string" },
                      reasoning: { type: "string" },
                      actionRoute: { type: "string" },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/api/inbox": {
        get: {
          tags: ["Approval Inbox (IB-01)"],
          summary: "Fetch pending or all approval inbox items",
          description: "Zero-Surprise Policy: Outbound communications and payments queue here for explicit owner sign-off.",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: ["PENDING", "APPROVED", "DECLINED", "ALL"], default: "PENDING" },
              description: "Filter items by status",
            },
          ],
          responses: {
            200: {
              description: "List of approval items",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: { $ref: "#/components/schemas/InboxItem" },
                      },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
        post: {
          tags: ["Approval Inbox (IB-01)"],
          summary: "Approve or decline an action item",
          description: "Deterministic Guardrail: Enforces server-side biometric step-up (Face ID) if required.",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["itemId", "action"],
                  properties: {
                    itemId: { type: "string", description: "Inbox Item ID" },
                    action: { type: "string", enum: ["APPROVE", "DECLINE"] },
                    biometricVerified: { type: "boolean", description: "True if Face ID passed" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Action executed successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      item: { $ref: "#/components/schemas/InboxItem" },
                    },
                  },
                },
              },
            },
            403: {
              description: "Biometric Face ID verification strictly required",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
            404: { description: "Item not found" },
          },
        },
      },
      "/api/trust/audit": {
        get: {
          tags: ["Trust & Security (TR-01)"],
          summary: "Get immutable audit trail ledger",
          description: "Provides tamper-proof event records of agent actions, blocked prompt injections, and risk mitigations.",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Audit ledger records",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      logs: {
                        type: "array",
                        items: { $ref: "#/components/schemas/AuditLog" },
                      },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/api/dev/reset": {
        post: {
          tags: ["Developer Tools"],
          summary: "Reset database state to demo baseline",
          description: "Resets the current user's inbox approvals, chats, and audit ledger back to default PRD initial state.",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Database reset successful",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
    },
  };

  return NextResponse.json(spec);
}
