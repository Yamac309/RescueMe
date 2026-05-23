import { Activity, Cloud, Database, RadioTower, RefreshCw, UsersRound } from "lucide-react";

export default function NodeStatusCard({ nodeStatus, lastSyncTime, syncSummary, pendingSyncCount = 0, syncNow }) {
  const status = nodeStatus || {};
  const sync = syncSummary || {
    status: "ready",
    label: lastSyncTime ? "Synced" : "Ready",
    detail: lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : "Local save enabled"
  };

  return (
    <section className="node-card">
      <div className="node-card-header">
        <div className="node-card-heading">
          <RadioTower size={26} />
          <div>
            <p className="eyebrow">Response Node</p>
            <h2>{status.node_name || "RescueMe Local Node"}</h2>
          </div>
        </div>
        {syncNow && (
          <button className="secondary compact-button" onClick={syncNow} disabled={sync.status === "syncing"}>
            <RefreshCw size={15} /> {sync.status === "syncing" ? "Syncing" : "Sync Now"}
          </button>
        )}
      </div>
      <div className="status-grid">
        <div>
          <Activity size={20} />
          <span>Backend Health</span>
          <strong>{status.backend_health || "ok"}</strong>
        </div>
        <div>
          <UsersRound size={20} />
          <span>Connected Clients</span>
          <strong>{status.connected_clients ?? 0}</strong>
        </div>
        <div>
          <Database size={20} />
          <span>Total Reports</span>
          <strong>{status.total_reports ?? 0}</strong>
        </div>
        <div>
          <Activity size={20} />
          <span>Last Sync</span>
          <strong>{lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : "Not yet"}</strong>
        </div>
        <div className={`sync-status-tile sync-${sync.status}`}>
          <Cloud size={20} />
          <span>Sync Queue</span>
          <strong>{sync.label}</strong>
          <small>{pendingSyncCount ? `${pendingSyncCount} queued` : sync.detail}</small>
        </div>
      </div>
    </section>
  );
}
