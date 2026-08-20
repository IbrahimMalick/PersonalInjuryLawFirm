import { claimNext, completeJob, failJob, recoverStuckJobs } from "./queue";
import { markLeadNeedsAttention, runProcessLead, runSendMessage } from "./pipeline";
import { runTranscribeVoicemail } from "./channels/twilio";
import type { JobRow } from "./db/schema";

// In-process background worker, started once per server from
// instrumentation.ts. Polls the jobs table; serial execution is deliberate —
// per-firm volumes are small and ordering beats parallel surprises.

const POLL_MS = 2000;

declare global {
  var __nightshiftWorker: { running: boolean } | undefined;
}

async function handle(job: JobRow): Promise<void> {
  switch (job.type) {
    case "process_lead":
      await runProcessLead(String(job.payload.leadId));
      break;
    case "send_message":
      await runSendMessage(Number(job.payload.messageId));
      break;
    case "transcribe_voicemail":
      await runTranscribeVoicemail(job.payload as { callSid: string; recordingUrl: string });
      break;
  }
}

async function onDead(job: JobRow, error: Error): Promise<void> {
  if (job.type === "process_lead") {
    await markLeadNeedsAttention(String(job.payload.leadId), error.message);
  }
  // Failed sends stay visible on the message row + audit log; no extra action.
}

async function tick(): Promise<void> {
  const job = await claimNext();
  if (!job) return;
  try {
    await handle(job);
    await completeJob(job.id);
  } catch (e) {
    const error = e as Error;
    console.error(`[worker] job ${job.id} (${job.type}) failed:`, error.message);
    const dead = await failJob(job, error);
    if (dead) {
      console.error(`[worker] job ${job.id} is dead after ${job.maxAttempts} attempts`);
      await onDead(job, error).catch((err) =>
        console.error(`[worker] onDead handler failed:`, err)
      );
    }
  }
}

export function startWorker(): void {
  if (globalThis.__nightshiftWorker?.running) return;
  globalThis.__nightshiftWorker = { running: true };
  console.log("[worker] Nightshift background worker started");

  recoverStuckJobs().catch(() => {});
  setInterval(() => recoverStuckJobs().catch(() => {}), 5 * 60_000);

  const loop = async () => {
    while (globalThis.__nightshiftWorker?.running) {
      try {
        await tick();
      } catch (e) {
        console.error("[worker] tick error:", e);
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  };
  void loop();
}
