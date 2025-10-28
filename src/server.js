import dotenv from "dotenv";
import app from "./app.js";
import pool from "./config/db.js"; // ✅ import DB pool

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const HOST = "0.0.0.0";

// ✅ TEST database connection once at bootstrap
pool.connect()
  .then((client) => {
    return client.query("SELECT NOW() AS now")
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
