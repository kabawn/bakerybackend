import { Router } from "express";
import pool from "../config/db.js";

const router = Router();

// GET /products  -> قائمة المنتجات
router.get("/", async (req, res) => {
   try {
      const { rows } = await pool.query(
         `select id, barcode, name, category, cost_price_cents, sell_price_cents, pieces_per_box, is_active, created_at
       from products
       order by created_at desc`
      );
      res.json(rows);
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

// POST /products  -> إضافة أو تحديث حسب barcode (upsert)
router.post("/", async (req, res) => {
   try {
      const {
         barcode,
         name,
         category,
         cost_price_cents,
         sell_price_cents,
         pieces_per_box,
         is_active = true,
      } = req.body || {};

      if (
         !barcode ||
         !name ||
         !category ||
         !Number.isInteger(cost_price_cents) ||
         !Number.isInteger(sell_price_cents) ||
         !Number.isInteger(pieces_per_box)
      ) {
         return res.status(400).json({ error: "invalid payload" });
      }

      const { rows } = await pool.query(
         `insert into products (barcode,name,category,cost_price_cents,sell_price_cents,pieces_per_box,is_active)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (barcode) do update set
         name=excluded.name,
         category=excluded.category,
         cost_price_cents=excluded.cost_price_cents,
         sell_price_cents=excluded.sell_price_cents,
         pieces_per_box=excluded.pieces_per_box,
         is_active=excluded.is_active
       returning *`,
         [barcode, name, category, cost_price_cents, sell_price_cents, pieces_per_box, is_active]
      );
      res.status(201).json(rows[0]);
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

// GET /products/:barcode -> منتج محدد
router.get("/:barcode", async (req, res) => {
   try {
      const { barcode } = req.params;
      const { rows } = await pool.query(
         `select barcode, name, category, cost_price_cents, sell_price_cents, pieces_per_box, is_active
       from products
       where barcode = $1
       limit 1`,
         [barcode]
      );

      if (rows.length === 0) {
         return res.status(404).json({ error: "not_found" });
      }

      res.json(rows[0]);
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

export default router;
