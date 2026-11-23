import { workspaceKey } from "./demo-workspace";
const databaseName = "sales-analyzer-attachments";
function openStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(workspaceKey(databaseName), 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function useStore(mode, apply) {
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("files", mode);
      const request = apply(transaction.objectStore("files"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
export async function storeAttachment(file) {
  const id = crypto.randomUUID();
  await useStore("readwrite", (store) => store.put(file, id));
  return { id, name: file.name, type: file.type };
}
export async function storeDraftFiles(files) {
  const entries = files.map((file) => ({ id: crypto.randomUUID(), file }));
  await useStore("readwrite", (store) => {
    let request;
    for (const entry of entries) request = store.put(entry.file, entry.id);
    return request;
  });
  return entries.map(({ id, file }) => ({
    id,
    name: file.name,
    type: file.type,
    size: file.size,
  }));
}
export const deleteAttachment = (id) =>
  useStore("readwrite", (store) => store.delete(id));
export const messageFiles = (message) =>
  message.attachments?.length
    ? message.attachments
    : message.attachment
      ? [message.attachment]
      : [];
export const readAttachment = (id) =>
  useStore("readonly", (store) => store.get(id));
export const clearAttachments = () =>
  useStore("readwrite", (store) => store.clear());
