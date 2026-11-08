import { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { ApiError } from "@/middleware/errorHandler";

const memory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 12 },
});

export function handleMulter(upload: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") return next(new ApiError(400, "File is larger than 10 MB"));
        if (err.code === "LIMIT_FILE_COUNT") return next(new ApiError(400, "Too many files in this request"));
        return next(new ApiError(400, err.message));
      }
      if (err instanceof ApiError) return next(err);
      const message = err instanceof Error ? err.message : "Invalid upload";
      return next(new ApiError(400, message));
    });
  };
}

export const uploadSingleDocument = handleMulter(memory.single("file"));
export const uploadProductImages = handleMulter(memory.array("images", 12));
