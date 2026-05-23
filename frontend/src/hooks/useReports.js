import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addResponderNote,
  confirmReport,
  createSocket,
  deleteAllReports,
  deleteDemoReports,
  getReports,
  getHealth,
  getNodeStatus,
  getReportComments,
  getVerificationConfig,
  postReportComment,
  responderRejectReport,
  responderVerifyReport,
  resolveReport,
  syncReports
} from "../api/client";
import {
  clearIgnoredReports,
  clearComments,
  deleteAllReports as deleteAllLocalReports,
  deleteCommentsByReportIds,
  deleteIgnoredReportIds,
  deleteDemoReports as deleteLocalDemoReports,
  deleteQueuedAction,
  deleteReportsByIds,
  deleteReportsByTitles,
  getAllComments,
  getAllReports,
  getCommentsByReportId,
  getDeviceId,
  getIgnoredReportIds,
  getQueuedActions,
  ignoreReport,
  queueAction,
  saveComment,
  saveComments,
  saveReport,
  saveReports
} from "../storage/indexedDb";
import { DEMO_REPORT_TITLES } from "../utils/demoData";
import {
  DEMO_TIME_OFFSET_KEY,
  estimateLocalVerification,
  findPossibleDuplicate,
  getDemoTimeOffsetHours,
  mergeReport,
  normalizeReport,
  sortByNewest
} from "../utils/reportUtils";

function sameStringList(first = [], second = []) {
  if (first.length !== second.length) return false;
  return first.every((value, index) => value === second[index]);
}

function getVisibleReports(candidateReports, ignoredIds = []) {
  const ignored = new Set(ignoredIds);
  return sortByNewest(candidateReports.filter((report) => !ignored.has(report.report_id)));
}

function normalizeCommentForState(comment) {
  return {
    ...comment,
    body: comment.body || "",
    image_data_url: comment.image_data_url || "",
    sync_state: comment.sync_state || "synced"
  };
}

function commentForApi(comment) {
  return {
    comment_id: comment.comment_id,
    report_id: comment.report_id,
    body: comment.body || "",
    image_data_url: comment.image_data_url || "",
    device_id: comment.device_id,
    timestamp: comment.timestamp
  };
}

function mergeCommentLists(...commentLists) {
  const byId = new Map();
  commentLists.flat().forEach((comment) => {
    const normalized = normalizeCommentForState(comment);
    byId.set(normalized.comment_id, {
      ...(byId.get(normalized.comment_id) || {}),
      ...normalized
    });
  });
  return [...byId.values()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function groupCommentsByReportId(comments = []) {
  return comments.reduce((groups, comment) => {
    const normalized = normalizeCommentForState(comment);
    groups[normalized.report_id] = mergeCommentLists(groups[normalized.report_id] || [], [normalized]);
    return groups;
  }, {});
}

export function useReports() {
  const [reports, setReports] = useState([]);
  const [deviceId] = useState(() => getDeviceId());
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [syncStatus, setSyncStatus] = useState("ready");
  const [nodeStatus, setNodeStatus] = useState(null);
  const [ignoredReportIds, setIgnoredReportIds] = useState([]);
  const [commentsByReportId, setCommentsByReportId] = useState({});
  const [demoTimeOffsetHours, setDemoTimeOffsetHoursState] = useState(() => getDemoTimeOffsetHours());
  const [verificationConfig, setVerificationConfig] = useState(null);
  const clearInProgressRef = useRef(false);
  const demoRemovalInProgressRef = useRef(false);
  const reportsRef = useRef([]);
  const ignoredReportIdsRef = useRef([]);
  const syncPromiseRef = useRef(null);
  const syncQueuedRef = useRef(false);
  const syncPausedRef = useRef(false);
  const syncNowRef = useRef(null);
  const reportIdsKey = useMemo(() => reports.map((report) => report.report_id).sort().join("|"), [reports]);
  const pendingSyncCount = useMemo(() => {
    const pendingReports = reports.filter((report) => (report.sync_state || "synced") !== "synced").length;
    const pendingComments = Object.values(commentsByReportId)
      .flat()
      .filter((comment) => (comment.sync_state || "synced") !== "synced").length;
    return pendingReports + pendingComments;
  }, [commentsByReportId, reports]);
  const syncSummary = useMemo(() => {
    if (syncStatus === "syncing") {
      return {
        status: "syncing",
        label: "Syncing",
        detail: pendingSyncCount ? `${pendingSyncCount} item${pendingSyncCount === 1 ? "" : "s"} queued` : "Checking for updates"
      };
    }
    if (pendingSyncCount > 0) {
      return {
        status: backendOnline ? "pending" : "retrying",
        label: backendOnline ? "Pending upload" : "Saved locally",
        detail: `${pendingSyncCount} item${pendingSyncCount === 1 ? "" : "s"} waiting for the node`
      };
    }
    if (lastSyncTime) {
      return {
        status: "synced",
        label: "Synced",
        detail: new Date(lastSyncTime).toLocaleTimeString()
      };
    }
    return {
      status: "ready",
      label: "Ready",
      detail: "Local save enabled"
    };
  }, [backendOnline, lastSyncTime, pendingSyncCount, syncStatus]);

  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  useEffect(() => {
    ignoredReportIdsRef.current = ignoredReportIds;
  }, [ignoredReportIds]);

  const mergeIntoState = useCallback(async (incomingReports) => {
    if (clearInProgressRef.current) return;
    const activeIncomingReports = demoRemovalInProgressRef.current
      ? incomingReports.filter((report) => !DEMO_REPORT_TITLES.includes(report.title))
      : incomingReports;
    const normalizedReports = activeIncomingReports.map(normalizeReport);
    await saveReports(normalizedReports);

    setReports((currentReports) => {
      if (clearInProgressRef.current) return [];
      const byId = new Map(currentReports.map((report) => [report.report_id, report]));
      normalizedReports.forEach((normalized) => {
        byId.set(normalized.report_id, mergeReport(byId.get(normalized.report_id), normalized));
      });
      const merged = [...byId.values()];
      return getVisibleReports(merged, ignoredReportIdsRef.current);
    });
  }, []);

  const removeFromState = useCallback(async (reportIds) => {
    if (!reportIds.length) return;
    await deleteReportsByIds(reportIds);
    await deleteCommentsByReportIds(reportIds);
    await deleteIgnoredReportIds(reportIds);
    setIgnoredReportIds((currentIds) => {
      const nextIds = currentIds.filter((reportId) => !reportIds.includes(reportId));
      return sameStringList(currentIds, nextIds) ? currentIds : nextIds;
    });
    setCommentsByReportId((currentComments) => {
      const nextComments = { ...currentComments };
      reportIds.forEach((reportId) => delete nextComments[reportId]);
      return nextComments;
    });
    setReports((currentReports) => currentReports.filter((report) => !reportIds.includes(report.report_id)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAllReports(), getIgnoredReportIds(), getAllComments()])
      .then(([localReports, ignoredIds, localComments]) => {
        if (cancelled) return;
        setIgnoredReportIds((currentIds) => (sameStringList(currentIds, ignoredIds) ? currentIds : ignoredIds));
        setReports(getVisibleReports(localReports, ignoredIds));
        setCommentsByReportId(groupCommentsByReportId(localComments));
      })
      .catch((error) => console.error("Unable to read local storage", error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    getVerificationConfig()
      .then(setVerificationConfig)
      .catch(() => setVerificationConfig(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const reportIds = reportIdsKey ? reportIdsKey.split("|") : [];
    if (!reportIds.length) {
      setCommentsByReportId({});
      return () => {
        cancelled = true;
      };
    }

    Promise.all(
      reportIds.map(async (reportId) => {
        const localComments = await getCommentsByReportId(reportId).catch(() => []);
        try {
          const remoteComments = (await getReportComments(reportId)).map((comment) => ({ ...comment, sync_state: "synced" }));
          await saveComments(remoteComments);
          return [reportId, mergeCommentLists(localComments, remoteComments)];
        } catch {
          return [reportId, localComments.map(normalizeCommentForState)];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setCommentsByReportId((currentComments) => {
        const activeReportIds = new Set(reportIds);
        const nextComments = Object.fromEntries(
          Object.entries(currentComments).filter(([reportId]) => activeReportIds.has(reportId))
        );
        entries.forEach(([reportId, comments]) => {
          nextComments[reportId] = mergeCommentLists(nextComments[reportId] || [], comments);
        });
        return nextComments;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [reportIdsKey]);

  const mergeCommentIntoState = useCallback((comment) => {
    const normalizedComment = normalizeCommentForState(comment);
    setCommentsByReportId((currentComments) => {
      const reportComments = currentComments[normalizedComment.report_id] || [];
      const byId = new Map(reportComments.map((item) => [item.comment_id, item]));
      byId.set(normalizedComment.comment_id, {
        ...(byId.get(normalizedComment.comment_id) || {}),
        ...normalizedComment
      });
      return {
        ...currentComments,
        [normalizedComment.report_id]: [...byId.values()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      };
    });
  }, []);

  const socketHandlersRef = useRef({
    mergeIntoState,
    mergeCommentIntoState,
    removeFromState
  });

  useEffect(() => {
    socketHandlersRef.current = {
      mergeIntoState,
      mergeCommentIntoState,
      removeFromState
    };
  }, [mergeIntoState, mergeCommentIntoState, removeFromState]);

  const refreshNodeStatus = useCallback(async () => {
    try {
      const [status] = await Promise.all([getNodeStatus(), getHealth()]);
      setNodeStatus(status);
      setBackendOnline(true);
      return status;
    } catch {
      setBackendOnline(false);
      setNodeStatus((current) => current || { backend_health: "ok", connected_clients: 0, total_reports: reportsRef.current.length });
      return null;
    }
  }, []);

  const replayQueuedActions = useCallback(async () => {
    const actions = await getQueuedActions();
    const localReportIds = new Set((await getAllReports()).map((report) => report.report_id));
    for (const action of actions) {
      if (!localReportIds.has(action.report_id)) {
        await deleteQueuedAction(action.id);
        continue;
      }

      try {
        if (action.type === "confirm") {
          const updated = await confirmReport(action.report_id, action.device_id);
          await mergeIntoState([updated]);
        }
        if (action.type === "resolve") {
          const updated = await resolveReport(action.report_id);
          await mergeIntoState([updated]);
        }
        if (action.type === "comment" && action.comment) {
          const savedComment = await postReportComment(action.report_id, commentForApi(action.comment));
          const syncedComment = { ...savedComment, sync_state: "synced" };
          await saveComment(syncedComment);
          mergeCommentIntoState(syncedComment);
        }
        await deleteQueuedAction(action.id);
      } catch (error) {
        if (error.status === 404) {
          await deleteQueuedAction(action.id);
          continue;
        }
        if (action.type === "comment" && action.comment) {
          const retryingComment = { ...action.comment, sync_state: "retrying" };
          await saveComment(retryingComment);
          mergeCommentIntoState(retryingComment);
        }
        return false;
      }
    }
    return true;
  }, [mergeCommentIntoState, mergeIntoState]);

  const runSyncCycle = useCallback(async () => {
    if (clearInProgressRef.current || demoRemovalInProgressRef.current) return;
    const localReports = await getAllReports();
    const localComments = await getAllComments();
    const queuedActions = await getQueuedActions();
    const knownIds = localReports.map((report) => report.report_id);
    const hasQueuedLocalWork =
      queuedActions.length > 0 ||
      localReports.some((report) => (report.sync_state || "synced") !== "synced") ||
      localComments.some((comment) => (comment.sync_state || "synced") !== "synced");

    try {
      if (hasQueuedLocalWork) setSyncStatus("syncing");
      if (clearInProgressRef.current || demoRemovalInProgressRef.current) return;
      const response = await syncReports(knownIds, localReports);
      if (clearInProgressRef.current || demoRemovalInProgressRef.current) return;
      if (response.deleted_report_ids?.length) {
        await removeFromState(response.deleted_report_ids);
      }
      const deletedIds = new Set(response.deleted_report_ids || []);
      const syncedLocal = localReports.map((report) => ({ ...report, sync_state: "synced" }));
      const activeSyncedLocal = syncedLocal.filter((report) => !deletedIds.has(report.report_id));
      await mergeIntoState([...activeSyncedLocal, ...response.missing_reports, ...response.accepted_reports]);
      const replayedAllActions = await replayQueuedActions();
      await refreshNodeStatus();
      setBackendOnline(true);
      const syncedAt = new Date();
      setLastSyncTime(syncedAt.toISOString());
      setSyncStatus(replayedAllActions ? "synced" : "retrying");
    } catch {
      setBackendOnline(false);
      setSyncStatus("retrying");
    }
  }, [mergeIntoState, refreshNodeStatus, removeFromState, replayQueuedActions]);

  const syncNow = useCallback(async () => {
    if (clearInProgressRef.current || demoRemovalInProgressRef.current) return null;
    if (syncPausedRef.current) {
      syncQueuedRef.current = true;
      return null;
    }

    if (syncPromiseRef.current) {
      syncQueuedRef.current = true;
      return syncPromiseRef.current;
    }

    const runQueuedSyncs = async () => {
      do {
        syncQueuedRef.current = false;
        if (!syncPausedRef.current) {
          await runSyncCycle();
        }
      } while (syncQueuedRef.current && !syncPausedRef.current);
    };

    syncPromiseRef.current = runQueuedSyncs().finally(() => {
      syncPromiseRef.current = null;
    });
    return syncPromiseRef.current;
  }, [runSyncCycle]);

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  useEffect(() => {
    const runCurrentSync = () => syncNowRef.current?.();
    runCurrentSync();
    const interval = window.setInterval(runCurrentSync, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let socket;
    let retryTimer;
    let stopped = false;

    function connect() {
      if (stopped) return;
      try {
        socket = createSocket();
        socket.onopen = () => {
          if (!stopped) setBackendOnline(true);
        };
        socket.onmessage = (event) => {
          if (stopped) return;
          const message = JSON.parse(event.data);
          if (message.report) {
            socketHandlersRef.current.mergeIntoState([message.report]);
          }
          if (message.type === "reports:deleted" && message.report_ids) {
            socketHandlersRef.current.removeFromState(message.report_ids);
          }
          if (message.type === "comment:new" && message.comment) {
            socketHandlersRef.current.mergeCommentIntoState(message.comment);
          }
        };
        socket.onclose = () => {
          if (stopped) return;
          setBackendOnline(false);
          retryTimer = window.setTimeout(connect, 5000);
        };
      } catch {
        if (!stopped) retryTimer = window.setTimeout(connect, 5000);
      }
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  const createLocalReport = useCallback(
    async (report) => {
      const duplicate = findPossibleDuplicate(report, reports);
      const locallyVerifiedReport = estimateLocalVerification(
        { ...report, sync_state: "pending" },
        reports,
        verificationConfig
      );
      setSyncStatus("pending");
      await saveReport(locallyVerifiedReport);
      await mergeIntoState([locallyVerifiedReport]);
      try {
        const response = await syncReports([report.report_id], [locallyVerifiedReport]);
        if (response.deleted_report_ids?.includes(report.report_id)) {
          await removeFromState([report.report_id]);
          throw new Error("This report was already deleted on the RescueMe Node.");
        }
        await mergeIntoState([
          ...response.accepted_reports,
          ...response.missing_reports
        ]);
        const serverReports = await getReports();
        await saveReports(serverReports);
        await mergeIntoState(serverReports);
        await refreshNodeStatus();
        setBackendOnline(true);
        setLastSyncTime(new Date().toISOString());
        setSyncStatus("synced");
      } catch (error) {
        console.warn("Report was saved locally but could not sync immediately.", error);
        setSyncStatus("retrying");
        syncNow();
      }
      return duplicate;
    },
    [mergeIntoState, refreshNodeStatus, removeFromState, reports, syncNow, verificationConfig]
  );

  const createLocalReports = useCallback(
    async (nextReports) => {
      const existingReports = reportsRef.current;
      const locallyVerifiedReports = nextReports.map((report) =>
        estimateLocalVerification({ ...report, sync_state: "pending" }, existingReports, verificationConfig)
      );
      setSyncStatus("pending");
      await mergeIntoState(locallyVerifiedReports);
      syncNow();
    },
    [mergeIntoState, syncNow, verificationConfig]
  );

  const confirmLocalReport = useCallback(
    async (reportId) => {
      const report = reports.find((item) => item.report_id === reportId);
      if (!report || report.confirmed_by_device_ids?.includes(deviceId)) return;

      const confirmedBy = [...(report.confirmed_by_device_ids || []), deviceId];
      const localCount = Math.max(report.confirmation_count || 0, confirmedBy.length);
      const localReport = {
        ...report,
        confirmed_by_device_ids: confirmedBy,
        confirmation_count: localCount,
        status: localCount >= 2 && report.status !== "Resolved" ? "Confirmed" : report.status,
        sync_state: "pending"
      };
      setSyncStatus("pending");
      await saveReport(localReport);
      await mergeIntoState([localReport]);

      try {
        const updated = await confirmReport(reportId, deviceId);
        await mergeIntoState([{ ...updated, confirmed_by_device_ids: confirmedBy }]);
      } catch {
        await queueAction({ type: "confirm", report_id: reportId, device_id: deviceId });
        syncNow();
      }
    },
    [deviceId, mergeIntoState, reports, syncNow]
  );

  const resolveLocalReport = useCallback(
    async (reportId) => {
      const report = reports.find((item) => item.report_id === reportId);
      if (!report) return;

      const localReport = { ...report, status: "Resolved", sync_state: "pending" };
      setSyncStatus("pending");
      await saveReport(localReport);
      await mergeIntoState([localReport]);

      try {
        const updated = await resolveReport(reportId);
        await mergeIntoState([updated]);
      } catch {
        await queueAction({ type: "resolve", report_id: reportId });
        syncNow();
      }
    },
    [mergeIntoState, reports, syncNow]
  );

  const responderVerifyLocalReport = useCallback(
    async (reportId) => {
      try {
        const updated = await responderVerifyReport(reportId);
        await mergeIntoState([updated]);
      } catch (error) {
        if (error.status === 403) window.alert("Responder token required. Add it on the Node Status page.");
        throw error;
      }
    },
    [mergeIntoState]
  );

  const responderRejectLocalReport = useCallback(
    async (reportId) => {
      try {
        const updated = await responderRejectReport(reportId);
        await mergeIntoState([updated]);
      } catch (error) {
        if (error.status === 403) window.alert("Responder token required. Add it on the Node Status page.");
        throw error;
      }
    },
    [mergeIntoState]
  );

  const addResponderNoteToReport = useCallback(
    async (reportId, note) => {
      try {
        const updated = await addResponderNote(reportId, note);
        await mergeIntoState([updated]);
      } catch (error) {
        if (error.status === 403) window.alert("Responder token required. Add it on the Node Status page.");
        throw error;
      }
    },
    [mergeIntoState]
  );

  const addCommentToReport = useCallback(
    async (reportId, body, imageDataUrl = "") => {
      const comment = {
        comment_id: `comment-${deviceId}-${Date.now()}-${crypto.randomUUID()}`,
        report_id: reportId,
        body,
        image_data_url: imageDataUrl,
        device_id: deviceId,
        timestamp: new Date().toISOString(),
        sync_state: "pending"
      };
      setSyncStatus("pending");
      await saveComment(comment);
      mergeCommentIntoState(comment);
      try {
        const savedComment = await postReportComment(reportId, commentForApi(comment));
        const syncedComment = { ...savedComment, sync_state: "synced" };
        await saveComment(syncedComment);
        mergeCommentIntoState(syncedComment);
      } catch (error) {
        await queueAction({ type: "comment", report_id: reportId, comment });
        console.warn("Comment was saved locally and will sync later.", error);
        setSyncStatus("retrying");
        syncNow();
      }
    },
    [deviceId, mergeCommentIntoState, syncNow]
  );

  const ignoreLocalReport = useCallback(
    async (reportId) => {
      await ignoreReport(reportId);
      setIgnoredReportIds((currentIds) => (currentIds.includes(reportId) ? currentIds : [...currentIds, reportId]));
      setReports((currentReports) => currentReports.filter((report) => report.report_id !== reportId));
    },
    []
  );

  const removeDemoReports = useCallback(async () => {
    demoRemovalInProgressRef.current = true;
    syncPausedRef.current = true;
    syncQueuedRef.current = false;
    if (syncPromiseRef.current) {
      await syncPromiseRef.current.catch(() => {});
    }

    const demoReportIds = reportsRef.current
      .filter((report) => DEMO_REPORT_TITLES.includes(report.title))
      .map((report) => report.report_id);
    let localDeletedIds = [];
    try {
      localDeletedIds = await deleteLocalDemoReports();
      if (!localDeletedIds.length) {
        localDeletedIds = await deleteReportsByTitles(DEMO_REPORT_TITLES);
      }
      const localDeleted = new Set([...demoReportIds, ...localDeletedIds]);
      setReports((currentReports) =>
        currentReports.filter((report) => !localDeleted.has(report.report_id) && !DEMO_REPORT_TITLES.includes(report.title))
      );
      const response = await deleteDemoReports([...localDeleted]);
      await removeFromState(response.deleted_report_ids || [...localDeleted]);
      await refreshNodeStatus();
    } catch (error) {
      if (error.status === 403) window.alert("Admin token required. Add it on the Node Status page.");
      console.warn(`Removed ${localDeletedIds.length} local demo reports. Node cleanup will need a connection.`);
    } finally {
      demoRemovalInProgressRef.current = false;
      syncPausedRef.current = false;
      syncQueuedRef.current = false;
      await syncNow();
    }
  }, [refreshNodeStatus, removeFromState, syncNow]);

  const clearAllReports = useCallback(async () => {
    const localReportIds = reports.map((report) => report.report_id);
    let backendCleared = false;
    clearInProgressRef.current = true;
    syncPausedRef.current = true;
    syncQueuedRef.current = false;
    if (syncPromiseRef.current) {
      await syncPromiseRef.current.catch(() => {});
    }
    setReports([]);
    setIgnoredReportIds([]);
    setNodeStatus((current) => (current ? { ...current, total_reports: 0 } : current));

    try {
      await deleteAllLocalReports();
      await clearIgnoredReports();
      await clearComments();
      setCommentsByReportId({});
      const response = await deleteAllReports();
      backendCleared = true;
      await removeFromState(response.deleted_report_ids || localReportIds);
      await refreshNodeStatus();
    } catch (error) {
      await deleteAllLocalReports();
      await clearIgnoredReports();
      await clearComments();
      setCommentsByReportId({});
      if (error.status === 403) window.alert("Admin token required. Add it on the Node Status page.");
      console.warn(`Cleared ${localReportIds.length} local reports. Node cleanup will need a connection.`);
    } finally {
      clearInProgressRef.current = false;
      syncPausedRef.current = false;
      syncQueuedRef.current = false;
      if (backendCleared) {
        await syncNow();
      }
    }
  }, [refreshNodeStatus, removeFromState, reports, syncNow]);

  const setDemoTimeOffsetHours = useCallback((hours) => {
    const nextHours = Number(hours);
    localStorage.setItem(DEMO_TIME_OFFSET_KEY, String(nextHours));
    setDemoTimeOffsetHoursState(nextHours);
  }, []);

  const value = useMemo(
    () => ({
      reports,
      deviceId,
      lastSyncTime,
      backendOnline,
      syncSummary,
      pendingSyncCount,
      nodeStatus,
      commentsByReportId,
      demoTimeOffsetHours,
      createLocalReport,
      createLocalReports,
      confirmLocalReport,
      resolveLocalReport,
      responderVerifyLocalReport,
      responderRejectLocalReport,
      addResponderNoteToReport,
      addCommentToReport,
      ignoreLocalReport,
      removeDemoReports,
      clearAllReports,
      setDemoTimeOffsetHours,
      syncNow,
      refreshNodeStatus,
      mergeIntoState
    }),
    [
      reports,
      deviceId,
      lastSyncTime,
      backendOnline,
      syncSummary,
      pendingSyncCount,
      nodeStatus,
      commentsByReportId,
      demoTimeOffsetHours,
      createLocalReport,
      createLocalReports,
      confirmLocalReport,
      resolveLocalReport,
      responderVerifyLocalReport,
      responderRejectLocalReport,
      addResponderNoteToReport,
      addCommentToReport,
      ignoreLocalReport,
      removeDemoReports,
      clearAllReports,
      setDemoTimeOffsetHours,
      syncNow,
      refreshNodeStatus,
      mergeIntoState
    ]
  );

  return value;
}
