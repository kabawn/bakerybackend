import { Router } from "express";
import pool from "../config/db.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { barcode, production_date, leftover_qty } = req.body || {};
    if (!barcode || !production_date || !Number.isInteger(leftover_qty) || leftover_qty < 0) {
      return res.status(400).json({ error: "barcode, production_date, leftover_qty required" });
    }

    const prodRes = await pool.query("select id from products where barcode=$1", [barcode]);
    if (prodRes.rowCount === 0) return res.status(404).json({ error: "product not found" });
    const prod = prodRes.rows[0];

    await pool.query(
      `insert into leftover (product_id, production_date, leftover_qty)
       values ($1,$2,$3)
       on conflict (product_id, production_date)
       do update set leftover_qty=excluded.leftover_qty, created_at=now()`,
      [prod.id, production_date, leftover_qty]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
