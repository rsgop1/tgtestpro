import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes/index.js";
import adminRouter from "./admin/router.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.use("/api", router);
app.use("/admin", adminRouter);

// Serve user web app (testbook-web) static files on /app
const userWebPath = path.join(__dirname, "../../testbook-web/dist/public");
app.use("/app", express.static(userWebPath));
app.get(/^\/app(.*)/, (req, res) => {
  res.sendFile(path.join(userWebPath, "index.html"));
});

// Serve admin-panel static files on /
const adminPanelPath = path.join(__dirname, "../../admin-panel/dist/public");
app.use(express.static(adminPanelPath));
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(adminPanelPath, "index.html"));
});

export default app;
