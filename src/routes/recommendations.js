import { Router } from "express";
import pool from "../config/db.js";

const router = Router();

/**
 * GET /recommendations?date=YYYY-MM-DD&service=0.95&holiday=0|1&global_mul=1.0
 * اختياريًا: &product_mul[PRODUCT_ID]=1.2 (مررها كـ query مثل product_mul=98cc6029-...:1.2 عدة مرات)
 */
router.get("/", async (req, res) => {
  try {
    const target = req.query.date; // تاريخ الهدف (عادةً غدًا)
    if (!target) return res.status(400).json({ error: "missing date" });

    const service = parseFloat(req.query.service ?? "0.95");
    const holiday = req.query.holiday === "1";
    const globalMul = parseFloat(req.query.global_mul ?? "1.0");

    // خريطة مضاعِفات لكل منتج من الكويري: product_mul=productId:factor
    const productMul = {};
    const q = req.query.product_mul;
    if (q) {
      const arr = Array.isArray(q) ? q : [q];
      for (const entry of arr) {
        const [pid, f] = String(entry).split(":");
        const val = parseFloat(f);
        if (pid && !isNaN(val)) productMul[pid] = val;
      }
    }

    // z لخدمة 90/95/97%
    const z = service >= 0.97 ? 1.88 : service >= 0.95 ? 1.65 : 1.28;

    // weekday للهدف
    const { rows: weekdayRows } = await pool.query(
      `select extract(isodow from $1::date)::int as wd`,
      [target]
    );
    const wd = weekdayRows[0]?.wd ?? 1;

    const { rows } = await pool.query(
      `
      with sales as (
        -- مبيعات يومية = prepared - leftover حسب يوم الإنتاج
        with prep as (
          select
            m.product_id,
            (case
              when nullif(m.session_date::text,'') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                then (m.session_date::text)::date
              else m.created_at::date
            end) as day,
            sum(abs(m.qty_pieces))::int as prepared_qty
          from movements m
          where m.move_type = 'prepare'
          group by 1, 2
        ),
        lo as (
          select product_id, production_date::date as day, sum(leftover_qty)::int as leftover_qty
          from leftover
          group by 1, 2
        )
        select
          p.id as product_id,
          p.barcode,
          p.name,
          p.category,
          pr.day,
          pr.prepared_qty,
          coalesce(lo.leftover_qty, 0) as leftover_qty,
          greatest(pr.prepared_qty - coalesce(lo.leftover_qty, 0), 0)::int as sales_qty
        from prep pr
        join products p on p.id = pr.product_id
        left join lo on lo.product_id = pr.product_id and lo.day = pr.day
      ),
      hist as (
        -- آخر 14 يوم مبيعات (للمتوسط المرجّح)
        select s.*
        from sales s
        where s.day < $1::date
          and s.day >= ($1::date - interval '14 days')
      ),
      same_wd as (
        -- آخر 8 مرات لنفس يوم الأسبوع (isodow: 1=Mon..7=Sun)
        select s.*
        from sales s
        where s.day < $1::date
          and extract(isodow from s.day)::int = $2
        order by s.day desc
        limit 8
      ),
      agg as (
        select
          p.id as product_id,
          p.barcode,
          p.name,
          p.category,
          p.sell_price_cents,
          p.cost_price_cents,
          -- متوسط نفس يوم الأسبوع وانحرافه
          (select coalesce(avg(sales_qty),0) from same_wd sw where sw.product_id = p.id) as avg_swd,
          (select coalesce(stddev_samp(sales_qty),0) from same_wd sw where sw.product_id = p.id) as std_swd,
          -- متوسط مرجّح آخر 14 يوم (ثقّل الأقرب أكثر)
          (select coalesce( sum(sales_qty * w) / nullif(sum(w),0), 0 )
             from (
               select h.product_id, h.sales_qty,
                      case
                        when h.day >= ($1::date - interval '7 days') then 3.0
                        when h.day >= ($1::date - interval '14 days') then 2.0
                        else 1.0
                      end as w
               from hist h
               where h.product_id = p.id
             ) wx
          ) as wavg_recent
        from products p
        where p.is_active = true
      )
      select
        product_id,
        barcode,
        name,
        category,
        sell_price_cents,
        cost_price_cents,
        avg_swd,
        std_swd,
        wavg_recent
      from agg
      `,
      [target, wd]
    );

    // طبّق العوامل والحدود لكل صنف
    const holidayFactor = holiday ? 1.15 : 1.0;
    const out = rows.map(r => {
      const base = 0.5 * (r.avg_swd ?? 0) + 0.5 * (r.wavg_recent ?? 0);
      const mul = (productMul[r.product_id] ?? 1.0) * globalMul * holidayFactor;
      const expected = base * mul;
      const safety = Math.ceil(z * (r.std_swd ?? 0));
      let recommended = Math.round(expected + safety);

      // حدود اختيارية: قص للأطراف لتفادي هدر/نقص غير منطقي
      // تقديرات percentiles ممكن إضافتها لاحقًا لو احتجتها
      if (recommended < 0) recommended = 0;

      // ثقة تقريبية: كلما std أقل نسبتُها أعلى
      const variability = (r.std_swd ?? 0);
      const confidence = variability <= 1 ? 0.9 : variability <= 3 ? 0.75 : 0.6;

      return {
        product_id: r.product_id,
        barcode: r.barcode,
        name: r.name,
        category: r.category,
        day: target,
        avg_same_weekday: Math.round(r.avg_swd ?? 0),
        recent_weighted_avg: Math.round(r.wavg_recent ?? 0),
        safety_stock: safety,
        multipliers: { holiday: holidayFactor, global: globalMul, product: productMul[r.product_id] ?? 1.0 },
        expected_sales: Math.round(expected),
        recommended_qty: recommended,
        confidence
      };
    });

    res.json(out);
  } catch (err) {
    console.error("GET /recommendations", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
