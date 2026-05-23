import { RefreshCw } from "lucide-react";
import NodeStatusCard from "../components/NodeStatusCard";
import SecurityAccessPanel from "../components/SecurityAccessPanel";

export default function NodeStatusPage({ mesh }) {
  return (
    <div className="page-grid">
      <section className="section-header">
        <div>
          <p className="eyebrow">RescueMe Node</p>
          <h1>Node Status</h1>
        </div>
        <button className="primary" onClick={mesh.refreshNodeStatus}>
          <RefreshCw size={18} /> Refresh
        </button>
      </section>
      <NodeStatusCard {...mesh} />
      <SecurityAccessPanel />
      <section className="info-panel">
        <h2>Hybrid Sync</h2>
        <p>
          Reports, confirmations, resolutions, and comments are saved in this browser first. When the FastAPI node is reachable, RescueMe uploads queued changes, downloads
          missing reports, and uses WebSockets for live updates from other clients.
        </p>
      </section>
    </div>
  );
}
