export type Role = "OWNER" | "ADMIN" | "OPERATOR" | "VIEWER";

export type HealthResponse = {
  status: "ok";
  service: string;
  timestamp: string;
};

