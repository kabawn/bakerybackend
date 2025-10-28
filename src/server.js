import dotenv from "dotenv";
import app from "./app.js";
import pool from "./config/db.js"; // ✅ import DB pool

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const HOST = "0.0.0.0";

// ✅ TEST database connection once at bootstrap
pool
   .connect()
   .then((client) => {
      return client
         .query("SELECT NOW() AS now")
         .then((res) => {
            console.log("✅ DB connected. now:", res.rows[0].now);
            client.release();
         })
         .catch((err) => {
            console.error("❌ DB test query failed:", err.message);
         });
   })
   .catch((err) => {
      console.error("❌ DB connection failed:", err.message);
   });

// DEBUG: confirm what env we actually got on Railway
try {
   const raw = (process.env.DATABASE_URL || "").trim();
   console.log("DEBUG DB_URL startsWith:", raw.slice(0, 20));
   const u = new URL(raw);
   console.log("DEBUG DB_URL protocol:", u.protocol);
   console.log("DEBUG DB_URL host:", u.hostname);
} catch (e) {
   console.log("DEBUG DB_URL parse error:", e.message);
}

// ✅ start server
const server = app.listen(PORT, HOST, () => {
   console.log(`API listening on :${PORT}`);
});

// ✅ handle SIGTERM for Railway restarts
process.on("SIGTERM", () => {
   console.log("Received SIGTERM, shutting down gracefully…");
   server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
   });
});
