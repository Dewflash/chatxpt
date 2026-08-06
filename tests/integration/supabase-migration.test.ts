import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608030001_chatxpt_foundation.sql"),
  "utf8",
);
const voteLedgerMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608050001_vote_ledger_identity.sql"),
  "utf8",
);
const voteCloseSchedulerMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608050002_vote_close_scheduler.sql"),
  "utf8",
);
const environmentExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

describe("Supabase migration security regression", () => {
  it("contains every approved durable record without a raw-chat table", () => {
    for (const table of [
      "streamer_profiles",
      "stream_sessions",
      "quest_cycles",
      "quest_candidate_batches",
      "command_receipts",
      "quest_events",
      "accepted_participation",
      "public_session_snapshots",
      "realtime_access_grants",
      "session_operations",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
    }
    expect(migration).not.toMatch(/create table public\.raw_chat/i);
  });

  it("enforces active-session, room-code, revision, and lifecycle constraints", () => {
    expect(migration).toContain("stream_sessions_one_active_broadcaster");
    expect(migration).toContain("where status in ('preparing', 'live')");
    expect(migration).toContain("room_code ~ '^[A-HJ-NP-Z2-9]{8}$'");
    expect(migration).toContain("committed_revision = expected_revision + 1");
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("interval '2 hours'");
    expect(migration).toContain("interval '10 minutes'");
  });

  it("enforces one private accepted vote per viewer and cycle across all MVP surfaces", () => {
    expect(voteLedgerMigration).toContain(
      "accepted_participation_one_vote_per_voter_cycle",
    );
    expect(voteLedgerMigration).toContain("payload #>> '{voterKey}'");
    expect(voteLedgerMigration).toContain(
      "('twitch-extension', 'hosted-board', 'twitch-chat')",
    );
  });

  it("denies direct client table writes and restricts server RPC execution", () => {
    expect(migration.match(/enable row level security/g)).toHaveLength(10);
    expect(migration.match(/revoke all on table public\./g)).toHaveLength(10);
    expect(migration).toContain(
      "revoke all on function public.commit_authoritative_state",
    );
    expect(migration).toContain(
      "grant execute on function public.commit_authoritative_state",
    );
    expect(migration).not.toMatch(/grant (insert|update|delete|all).* to (anon|authenticated)/i);
  });

  it("keeps due vote-cycle lookup behind service-role execution", () => {
    expect(voteCloseSchedulerMigration).toContain("create or replace function public.due_vote_cycle_states");
    expect(voteCloseSchedulerMigration).toContain("where status = 'live'");
    expect(voteCloseSchedulerMigration).toContain("current_state #>> '{questCycle,status}' = 'voting'");
    expect(voteCloseSchedulerMigration).toContain("revoke all on function public.due_vote_cycle_states");
    expect(voteCloseSchedulerMigration).toContain("grant execute on function public.due_vote_cycle_states(bigint) to service_role");
    expect(voteCloseSchedulerMigration).not.toMatch(/grant execute.* to (anon|authenticated)/i);
  });

  it("broadcasts only private role snapshots authorised by short-lived server grants", () => {
    expect(migration).toContain("perform realtime.send(");
    expect(migration).toContain("'chatxpt:' || new.session_id || ':' || new.view_role");
    expect(migration).toContain("chatxpt_private_snapshot_read");
    expect(migration).toContain("can_receive_chatxpt_snapshot");
    expect(migration).toContain("access.expires_at > now()");
    expect(migration).toContain("access.revoked_at is null");
    expect(migration).not.toMatch(/for insert\s+to authenticated/i);
  });

  it("keeps secret configuration server-only in the committed environment template", () => {
    expect(environmentExample).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=");
    expect(environmentExample).toContain("SUPABASE_SECRET_KEY=");
    expect(environmentExample).toContain("CHATXPT_OBS_OVERLAY_SETUP_KEY=");
    expect(environmentExample).not.toContain("NEXT_PUBLIC_SUPABASE_SECRET_KEY");
    expect(environmentExample).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
    expect(environmentExample).not.toContain("NEXT_PUBLIC_CHATXPT_OBS_OVERLAY_SETUP_KEY");
  });
});
