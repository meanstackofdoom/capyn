export interface ValidationDetail {
  path: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: ValidationDetail[]
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication is required") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class InvalidRequestError extends AppError {
  constructor(code: string, message: string, details?: ValidationDetail[]) {
    super(400, code, message, details);
  }
}

export class GoneError extends AppError {
  constructor(code: string, message: string) {
    super(410, code, message);
  }
}
