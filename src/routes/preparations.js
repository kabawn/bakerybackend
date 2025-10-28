// src/routes/preparations.js
import { Router } from "express";
import pool from "../config/db.js";

const router = Router();

// Always regex against TEXT, then cast back to DATE only if it matches YYYY-MM-DD
const DAY_EXPR = `
case
  when nullif(m.session_date::text, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then (m.session_date::text)::date
  else m.created_at::date
end
`;

// GET /preparations/days  -> last 60 days that have prepare movements
router.get("/days", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
      select
        ${DAY_EXPR} as day,
        count(*) as moves_count
      from movements m
      where m.move_type = 'prepare'
      group by 1
      order by day desc
      limit 60
      `
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /preparations/days error:", e);
    res.status(500).json({ error: e.message });
  }
});

// GET /preparations?date=YYYY-MM-DD  -> aggregated prepared qty by product for that day
router.get("/", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "missing date" });

    const { rows } = await pool.query(
      `
      with prepared as (
        select
          m.product_id,
          abs(m.qty_pieces)::int as qty_abs,
          ${DAY_EXPR} as day
        from movements m
        where m.move_type = 'prepare'
      )
      select
        p.barcode,
        p.name,
        p.category,
        sum(pr.qty_abs)::int as qty_prepared,
        count(*)::int as sessions_count
      from prepared pr
      join products p on p.id = pr.product_id
      where pr.day = $1::date
      group by p.barcode, p.name, p.category
      order by p.name asc
      `,
      [date]
    );

    res.json(rows);
  } catch (e) {
    console.error("GET /preparations error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
