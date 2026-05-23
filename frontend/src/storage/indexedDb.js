import { normalizeReport } from "../utils/reportUtils";

const DB_NAME = "rescueme-db";
const DB_VERSION = 3;
const REPORT_STORE = "reports";
const ACTION_STORE = "queuedActions";
const IGNORED_REPORT_STORE = "ignoredReports";
const COMMENT_STORE = "comments";

function normalizeComment(comment) {
  return {
    ...comment,
    body: comment.body || "",
    image_data_url: comment.image_data_url || "",
    sync_state: comment.sync_state || "synced"
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REPORT_STORE)) {
        const reports = db.createObjectStore(REPORT_STORE, { keyPath: "report_id" });
        reports.createIndex("timestamp", "timestamp");
        reports.createIndex("category", "category");
      }
      if (!db.objectStoreNames.contains(ACTION_STORE)) {
        db.createObjectStore(ACTION_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(IGNORED_REPORT_STORE)) {
        db.createObjectStore(IGNORED_REPORT_STORE, { keyPath: "report_id" });
      }
      if (!db.objectStoreNames.contains(COMMENT_STORE)) {
        const comments = db.createObjectStore(COMMENT_STORE, { keyPath: "comment_id" });
        comments.createIndex("report_id", "report_id");
        comments.createIndex("timestamp", "timestamp");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeTransaction(storeName, mode = "readonly") {
  return openDatabase().then((db) => {
    const transaction = db.transaction(storeName, mode);
    return { db, transaction, store: transaction.objectStore(storeName) };
  });
}

export async function getAllReports() {
  const { db, store } = await storeTransaction(REPORT_STORE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result.map(normalizeReport));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveReport(report) {
  const { db, transaction, store } = await storeTransaction(REPORT_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.put(normalizeReport(report));
    request.onsuccess = () => resolve(report);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function saveReports(reports) {
  if (!reports.length) return;
  const { db, transaction, store } = await storeTransaction(REPORT_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    reports.forEach((report) => store.put(normalizeReport(report)));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteReportsByIds(reportIds) {
  const { db, transaction, store } = await storeTransaction(REPORT_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    reportIds.forEach((reportId) => store.delete(reportId));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllComments() {
  const { db, store } = await storeTransaction(COMMENT_STORE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result.map(normalizeComment));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getCommentsByReportId(reportId) {
  const { db, store } = await storeTransaction(COMMENT_STORE);
  return new Promise((resolve, reject) => {
    const index = store.index("report_id");
    const request = index.getAll(reportId);
    request.onsuccess = () => {
      db.close();
      resolve(request.result.map(normalizeComment));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveComment(comment) {
  const { db, transaction, store } = await storeTransaction(COMMENT_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const normalized = normalizeComment(comment);
    const request = store.put(normalized);
    request.onsuccess = () => resolve(normalized);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function saveComments(comments) {
  if (!comments.length) return;
  const { db, transaction, store } = await storeTransaction(COMMENT_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    comments.forEach((comment) => store.put(normalizeComment(comment)));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteCommentsByReportIds(reportIds) {
  if (!reportIds.length) return;
  const comments = await getAllComments();
  const reportIdSet = new Set(reportIds);
  const commentIds = comments
    .filter((comment) => reportIdSet.has(comment.report_id))
    .map((comment) => comment.comment_id);
  if (!commentIds.length) return;

  const { db, transaction, store } = await storeTransaction(COMMENT_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    commentIds.forEach((commentId) => store.delete(commentId));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearComments() {
  const { db, transaction, store } = await storeTransaction(COMMENT_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function ignoreReport(reportId) {
  const { db, transaction, store } = await storeTransaction(IGNORED_REPORT_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.put({ report_id: reportId, ignored_at: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function getIgnoredReportIds() {
  const { db, store } = await storeTransaction(IGNORED_REPORT_STORE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result.map((item) => item.report_id));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteIgnoredReportIds(reportIds) {
  const { db, transaction, store } = await storeTransaction(IGNORED_REPORT_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    reportIds.forEach((reportId) => store.delete(reportId));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearIgnoredReports() {
  const { db, transaction, store } = await storeTransaction(IGNORED_REPORT_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function deleteReportsByTitles(titles) {
  const reports = await getAllReports();
  const titleSet = new Set(titles);
  const reportIds = reports.filter((report) => titleSet.has(report.title)).map((report) => report.report_id);
  await deleteReportsByIds(reportIds);
  return reportIds;
}

export async function deleteDemoReports() {
  const reports = await getAllReports();
  const reportIds = reports.filter((report) => report.isDemo || report.is_demo).map((report) => report.report_id);
  await deleteReportsByIds(reportIds);
  return reportIds;
}

export async function deleteAllReports() {
  const { db, transaction, store } = await storeTransaction(REPORT_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function queueAction(action) {
  const { db, transaction, store } = await storeTransaction(ACTION_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.add({ ...action, created_at: new Date().toISOString() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function getQueuedActions() {
  const { db, store } = await storeTransaction(ACTION_STORE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteQueuedAction(id) {
  const { db, transaction, store } = await storeTransaction(ACTION_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export function getDeviceId() {
  const key = "rescueme-device-id";
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = `device-${crypto.randomUUID()}`;
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}
