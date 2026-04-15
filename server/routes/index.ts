import { Router, type Request, type Response } from "express";
import authRoutes from "./auth";
import tenantRoutes from "./tenant";
import paymentRoutes from "./payment";
import exportRoutes from "./export";
import chatRoutes from "./chat";

const router = Router();

// ─── System ───
router.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// ─── Route modules ───
router.use("/api/auth", authRoutes);
router.use("/api/tenant", tenantRoutes);
router.use("/api/payment", paymentRoutes);
router.use("/api/export", exportRoutes);
router.use("/api/chat", chatRoutes);

export default router;
