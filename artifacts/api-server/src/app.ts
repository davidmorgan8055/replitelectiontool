import express, { type Express, type ErrorRequestHandler } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.disable("etag");
app.disable("x-powered-by");

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
app.use("/api", router);

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err.type === "entity.too.large") {
    res.status(413).json({ error: "JSON body exceeds the 1 MB limit" });
    return;
  }
  if (err.type === "entity.parse.failed" || err.type === "request.size.invalid") {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  if (err.status === 415) {
    res.status(415).json({ error: "Unsupported body encoding or media type" });
    return;
  }
  req.log.error({ code: err.code }, "Results API request failed");
  res.status(503).json({ error: "Results storage is temporarily unavailable" });
};
app.use(errorHandler);

export default app;
