-- Stop the new worker, preserving all completed matches and queue progress.
-- Restoring the old job reintroduces its known timeout; keep stopped until resolved.
select cron.unschedule(jobid) from cron.job where jobname='match-lic-items-lotes';
