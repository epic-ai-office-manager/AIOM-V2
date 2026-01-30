/**
 * AI COO Scheduler
 * 
 * Manages scheduled monitoring jobs using node-cron
 * For production, this can be replaced with pg_cron for better reliability
 */

import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { getMonitoringJobs, updateJobLastRun } from '~/data-access/ai-coo';
import { runFinancialAnalysis } from '../analyzers/financial';

const activeJobs = new Map<string, ScheduledTask>();

// ============================================================================
// Scheduler Control
// ============================================================================

export async function startAICOOScheduler() {
  console.log('[AI COO Scheduler] Starting...');
  
  try {
    // Load all enabled jobs from database
    const jobs = await getMonitoringJobs();
    
    if (jobs.length === 0) {
      console.log('[AI COO Scheduler] No monitoring jobs found. Run seed script to create initial jobs.');
      return;
    }
    
    for (const job of jobs) {
      await scheduleJob(job);
    }
    
    console.log(`[AI COO Scheduler] Started ${jobs.length} monitoring job(s)`);
  } catch (error) {
    console.error('[AI COO Scheduler] Failed to start:', error);
    throw error;
  }
}

export function stopAICOOScheduler() {
  console.log('[AI COO Scheduler] Stopping...');
  
  for (const [id, task] of activeJobs.entries()) {
    task.stop();
    console.log(`[AI COO Scheduler] Stopped job: ${id}`);
  }
  
  activeJobs.clear();
  console.log('[AI COO Scheduler] Stopped all jobs');
}

export async function reloadScheduler() {
  console.log('[AI COO Scheduler] Reloading...');
  stopAICOOScheduler();
  await startAICOOScheduler();
}

// ============================================================================
// Job Scheduling
// ============================================================================

export async function scheduleJob(job: any) {
  // Stop existing job if running
  if (activeJobs.has(job.id)) {
    activeJobs.get(job.id)?.stop();
    console.log(`[AI COO Scheduler] Stopped existing job: ${job.name}`);
  }
  
  // Validate cron expression
  if (!cron.validate(job.schedule)) {
    console.error(`[AI COO Scheduler] Invalid cron expression for job ${job.name}: ${job.schedule}`);
    return;
  }
  
  // Create new scheduled task
  const task = cron.schedule(job.schedule, async () => {
    await executeJob(job);
  });
  
  activeJobs.set(job.id, task);
  console.log(`[AI COO Scheduler] Scheduled job: ${job.name} (${job.schedule})`);
}

// ============================================================================
// Job Execution
// ============================================================================

async function executeJob(job: any) {
  console.log(`[AI COO] Running job: ${job.name} (${job.analyzerType})`);
  
  try {
    // Calculate next run time
    const nextRun = calculateNextRun(job.schedule);
    await updateJobLastRun(job.id, nextRun);
    
    // Execute analyzer based on type
    switch (job.analyzerType) {
      case 'financial':
        await runFinancialAnalysis(job);
        break;
      
      case 'sales':
        // TODO: Implement in Phase 2
        console.log('[AI COO] Sales analyzer not yet implemented');
        break;
      
      case 'operations':
        // TODO: Implement in Phase 2
        console.log('[AI COO] Operations analyzer not yet implemented');
        break;
      
      case 'customer':
        // TODO: Implement in Phase 5
        console.log('[AI COO] Customer analyzer not yet implemented');
        break;
      
      default:
        console.warn(`[AI COO] Unknown analyzer type: ${job.analyzerType}`);
    }
    
    console.log(`[AI COO] Completed job: ${job.name}`);
  } catch (error) {
    console.error(`[AI COO] Job failed: ${job.name}`, error);
    // Don't throw - let the scheduler continue running
  }
}

// ============================================================================
// Utilities
// ============================================================================

function calculateNextRun(cronExpression: string): Date {
  // Parse cron expression and calculate next run
  // For simplicity, we'll use a basic calculation
  // In production, use a proper cron parser library
  
  const parts = cronExpression.split(' ');
  
  // Handle hourly jobs (0 * * * *)
  if (parts[0] === '0' && parts[1] === '*') {
    const next = new Date();
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
    next.setSeconds(0);
    return next;
  }
  
  // Handle daily jobs (0 6 * * *)
  if (parts[0] !== '*' && parts[1] !== '*' && parts[2] === '*') {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(parseInt(parts[1]));
    next.setMinutes(parseInt(parts[0]));
    next.setSeconds(0);
    return next;
  }
  
  // Default: add 1 hour
  const next = new Date();
  next.setHours(next.getHours() + 1);
  return next;
}

// ============================================================================
// Manual Triggers (for testing)
// ============================================================================

export async function triggerJobManually(jobId: string) {
  const jobs = await getMonitoringJobs();
  const job = jobs.find(j => j.id === jobId);
  
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }
  
  console.log(`[AI COO] Manually triggering job: ${job.name}`);
  await executeJob(job);
}

export async function triggerAnalyzerManually(analyzerType: string) {
  const jobs = await getMonitoringJobs();
  const job = jobs.find(j => j.analyzerType === analyzerType);
  
  if (!job) {
    throw new Error(`No job found for analyzer type: ${analyzerType}`);
  }
  
  console.log(`[AI COO] Manually triggering ${analyzerType} analyzer`);
  await executeJob(job);
}
