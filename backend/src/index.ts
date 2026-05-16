import express from "express";
import type { Request, Response } from "express";
import { h3TileRender } from "./h3";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/api", (_req: Request, res: Response) => {
  res.json({ message: "Hello from express backend" });
});

app.get("/tiles/:z/:x/:y.mvt", h3TileRender);

app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`);
});
