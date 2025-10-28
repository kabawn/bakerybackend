import { Router } from "express";
import pool from "../config/db.js";

const router = Router();

router.get("/daily", async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let where = "where 1=1";
    if (from) { params.push(from); where += ` and d.day >= $${params.length}`; }
    if (to)   { params.push(to);   where += ` and d.day <= $${params.length}`; }

    const { rows } = await pool.query(
      `with prep as (
         select p.id as product_id, p.sell_price_cents, p.cost_price_cents, m.session_date as day,
                sum(abs(m.qty_pieces))::int as prepared_qty
         from movements m
         join products p on p.id = m.product_id
         where m.move_type = 'prepare'
         group by p.id, p.sell_price_cents, p.cost_price_cents, m.session_date
       ),
       lo as (
         select product_id, production_date as day, leftover_qty from leftover
       ),
       d as (
         select pr.product_id, pr.day, pr.prepared_qty,
                coalesce(lo.leftover_qty,0) as leftover_qty,
                greatest(pr.prepared_qty - coalesce(lo.leftover_qty,0),0) as sold,
                pr.sell_price_cents, pr.cost_price_cents
         from prep pr
         left join lo on lo.product_id = pr.product_id and lo.day = pr.day
       )
       select d.day,
              sum(d.sold * d.sell_price_cents)::int as revenue_cents,
              sum(d.sold * d.cost_price_cents)::int as cogs_cents,
              sum((d.prepared_qty - d.sold) * d.cost_price_cents)::int as waste_cost_cents
       from d
       ${where}
       group by d.day
       order by d.day desc`,
      params
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
