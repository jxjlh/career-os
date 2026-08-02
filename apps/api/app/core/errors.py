import logging
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("app.errors")


class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, details: Any = None):
        self.code = code
        self.message = message
        self.status = status
        self.details = details
        super().__init__(message)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # 记录完整堆栈到服务端日志（不暴露给客户端），便于诊断 500 根因。
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "Unexpected server error", "details": None}},
    )
