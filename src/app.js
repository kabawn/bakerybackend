import express from "express";
import cors from "cors";
import morgan from "morgan";
import pool from "./config/db.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
   res.json({ ok: true });
});

app.get("/dbtest", async (req, res) => {
   try {
      const result = await pool.query("select now()");
      res.json(result.rows[0]);
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

import productsRouter from "./routes/products.js";
import movementsRouter from "./routes/movements.js";
import inventoryRouter from "./routes/inventory.js";
import leftoverRouter from "./routes/leftover.js";
import kpiRouter from "./routes/kpi.js";
import preparationsRouter from "./routes/preparations.js";
import recommendationsRouter from "./routes/recommendations.js";

app.get("/", (req, res) => {
   res.json({ ok: true, name: "bakery-api", status: "running" });
});

app.use("/products", productsRouter);
app.use("/movements", movementsRouter);
app.use("/inventory", inventoryRouter);
app.use("/leftover", leftoverRouter);
app.use("/kpi", kpiRouter);
app.use("/preparations", preparationsRouter);
app.use("/recommendations", recommendationsRouter);

export default app;
