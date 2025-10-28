import { Router } from "express";
import pool from "../config/db.js";

const router = Router();

// استلام شحنة
router.post("/receive", async (req, res) => {
  try {
    const { barcode, boxes, qty_pieces, note = null, session_date } = req.body || {};

    if (!barcode || (!Number.isInteger(boxes) && !Number.isInteger(qty_pieces))) {
      return res.status(400).json({ error: "barcode and (boxes OR qty_pieces) required" });
    }

    const prodRes = await pool.query(
      "select id, cost_price_cents, pieces_per_box from products where barcode=$1 and is_active=true",
      [barcode]
    );

    if (prodRes.rowCount === 0) return res.status(404).json({ error: "product not found" });

    const prod = prodRes.rows[0];
    const pieces = Number.isInteger(qty_pieces) ? qty_pieces : boxes * prod.pieces_per_box;

    await pool.query(
      `insert into movements (product_id, move_type, qty_pieces, unit_cost_cents, note, session_date)
       values ($1,'receipt',$2,$3,$4, coalesce($5,current_date))`,
      [prod.id, pieces, prod.cost_price_cents, note, session_date]
    );

    res.status(201).json({ ok: true, qty_pieces: pieces });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تحضير اليوم (خصم من المجمّد)
router.post("/prepare", async (req, res) => {
  try {
    const { barcode, qty_pieces, session_date } = req.body || {};
    if (!barcode || !Number.isInteger(qty_pieces) || qty_pieces <= 0)
      return res.status(400).json({ error: "barcode and positive qty_pieces required" });

    const prodRes = await pool.query(
      "select id, cost_price_cents from products where barcode=$1 and is_active=true",
      [barcode]
    );

    if (prodRes.rowCount === 0) return res.status(404).json({ error: "product not found" });

    const prod = prodRes.rows[0];

    await pool.query(
      `insert into movements (product_id, move_type, qty_pieces, unit_cost_cents, note, session_date)
       values ($1,'prepare',$2,$3,'prep consumption', coalesce($4,current_date))`,
      [prod.id, -qty_pieces, prod.cost_price_cents, session_date]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// غير صالح للبيع (خصم مخزون)
router.post("/defect", async (req, res) => {
  try {
    const { barcode, qty_pieces, note = null, session_date } = req.body || {};
    if (!barcode || !Number.isInteger(qty_pieces) || qty_pieces <= 0)
      return res.status(400).json({ error: "barcode and positive qty_pieces required" });

    const prodRes = await pool.query(
      "select id, cost_price_cents from products where barcode=$1",
      [barcode]
    );

    if (prodRes.rowCount === 0) return res.status(404).json({ error: "product not found" });

    const prod = prodRes.rows[0];

    await pool.query(
      `insert into movements (product_id, move_type, qty_pieces, unit_cost_cents, note, session_date)
       values ($1,'defect',$2,$3,$4, coalesce($5,current_date))`,
      [prod.id, -qty_pieces, prod.cost_price_cents, note, session_date]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
