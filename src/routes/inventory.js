import { Router } from "express";
import pool from "../config/db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select p.barcode, p.name, p.category,
              coalesce(sum(m.qty_pieces),0)::int as qty_in_stock
         from products p
    left join movements m on m.product_id = p.id
        group by p.barcode, p.name, p.category
        order by p.name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
