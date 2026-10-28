CREATE TABLE "pro_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"accepted_pro_id" uuid
);
--> statement-breakpoint
ALTER TABLE "pros" ADD COLUMN "agreement_version" text;--> statement-breakpoint
ALTER TABLE "pros" ADD COLUMN "agreement_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pros" ADD COLUMN "status_log" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "close_price" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "close_date" date;--> statement-breakpoint
ALTER TABLE "pro_invites" ADD CONSTRAINT "pro_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_invites" ADD CONSTRAINT "pro_invites_accepted_pro_id_pros_id_fk" FOREIGN KEY ("accepted_pro_id") REFERENCES "public"."pros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pro_invites_email_key" ON "pro_invites" USING btree (lower("email"));--> statement-breakpoint
-- DRE numbers are 8 digits: store them the same way however they were typed ("1364089", "DRE# 01364089").
update pros set license_number = lpad(regexp_replace(license_number, '\D', '', 'g'), 8, '0')
  where pro_type = 'agent' and license_number ~ '\d' and length(regexp_replace(license_number, '\D', '', 'g')) <= 8;--> statement-breakpoint
-- One working account per license: keep the oldest, suspend the rest with a note in their history.
update pros set status = 'suspended', updated_at = now(),
  status_log = status_log || jsonb_build_array(jsonb_build_object('at', now(), 'from', status, 'to', 'suspended', 'action', 'suspend', 'reason', 'duplicate license', 'admin_user_id', null))
  where id in (
    select id from (
      select id, row_number() over (partition by license_region, license_number order by created_at, id) as n
      from pros where pro_type = 'agent' and status <> 'suspended' and license_number is not null
    ) d where n > 1
  );--> statement-breakpoint
CREATE UNIQUE INDEX "pros_agent_license_key" ON "pros" USING btree ("license_region","license_number") WHERE "pros"."pro_type" = 'agent' and "pros"."status" <> 'suspended' and "pros"."license_number" is not null;