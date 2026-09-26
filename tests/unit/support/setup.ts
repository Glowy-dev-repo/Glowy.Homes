import "dotenv/config";

// Unit tests never send email or talk to external services.
process.env.EMAIL_TRANSPORT = "log";
process.env.DATABASE_URL ??= "postgres://glowy:glowy@localhost:5433/glowy";
