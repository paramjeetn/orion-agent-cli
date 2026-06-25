import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

// Enable WebSocket for Neon
neonConfig.webSocketConstructor = ws;

// Connection string from environment variable
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

// Create adapter with connectionString directly (NOT Pool!)
const adapter = new PrismaNeon({ connectionString });

// Create Prisma client with adapter
const prisma = new PrismaClient({ adapter });

export default prisma;
