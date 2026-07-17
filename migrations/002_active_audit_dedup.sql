CREATE UNIQUE INDEX IF NOT EXISTS audit_runs_one_active_hostname
  ON audit_runs (hostname)
  WHERE status IN ('queued', 'running');
