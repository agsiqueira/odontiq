import {
  isEncounterDocument,
  type EncounterDocument,
} from "../../encounter/encounterDocument";

export type EncounterSyncStatus =
  | "idle"
  | "pending"
  | "syncing"
  | "synced"
  | "network-error"
  | "conflict";

export type EncounterSyncState = {
  status: EncounterSyncStatus;
  revision: number;
  pending: boolean;
  lastSuccessfulSync?: string;
};

type EncounterSyncTransport = {
  load(encounterId: string): Promise<{
    revision: number;
    document: EncounterDocument | null;
  }>;
  save(input: {
    encounterId: string;
    revision: number;
    document: EncounterDocument;
  }): Promise<{ revision: number }>;
};

type EncounterSyncServiceOptions = {
  encounterId: string;
  revision: number;
  debounceMs?: number;
  retryMs?: number;
  transport?: EncounterSyncTransport;
  onStateChange?: (state: EncounterSyncState) => void;
};

export class EncounterSyncConflictError extends Error {}

export class EncounterSyncService {
  private readonly debounceMs: number;
  private readonly retryMs: number;
  private readonly transport: EncounterSyncTransport;
  private readonly onStateChange?: (state: EncounterSyncState) => void;
  private timer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private pendingDocument?: EncounterDocument;
  private inFlight?: Promise<void>;
  private lastDocumentFingerprint?: string;
  private state: EncounterSyncState;

  constructor(private readonly options: EncounterSyncServiceOptions) {
    this.debounceMs = options.debounceMs ?? 1_500;
    this.retryMs = options.retryMs ?? 5_000;
    this.transport = options.transport ?? browserEncounterSyncTransport;
    this.onStateChange = options.onStateChange;
    this.state = {
      status: "idle",
      revision: options.revision,
      pending: false,
    };
  }

  getState() {
    return { ...this.state };
  }

  async load() {
    const result = await this.transport.load(this.options.encounterId);
    this.setState({ revision: result.revision });
    return result.document;
  }

  schedule(document: EncounterDocument) {
    const fingerprint = JSON.stringify(document);
    if (fingerprint === this.lastDocumentFingerprint) return;
    this.lastDocumentFingerprint = fingerprint;
    this.pendingDocument = document;
    this.setState({ status: "pending", pending: true });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(
      () => void this.flush().catch(() => undefined),
      this.debounceMs,
    );
  }

  async flush(document?: EncounterDocument) {
    if (document) this.schedule(document);
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.inFlight) {
      await this.inFlight;
      if (!this.pendingDocument) return;
    }
    if (!this.pendingDocument) return;

    const pending = this.pendingDocument;
    this.pendingDocument = undefined;
    this.setState({ status: "syncing", pending: true });
    this.inFlight = this.save(pending);
    try {
      await this.inFlight;
    } finally {
      this.inFlight = undefined;
    }
  }

  async retry() {
    if (this.state.status === "conflict") return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    await this.flush();
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  private async save(document: EncounterDocument) {
    try {
      const result = await this.transport.save({
        encounterId: this.options.encounterId,
        revision: this.state.revision,
        document,
      });
      this.setState({
        status: this.pendingDocument ? "pending" : "synced",
        revision: result.revision,
        pending: Boolean(this.pendingDocument),
        lastSuccessfulSync: new Date().toISOString(),
      });
      if (this.pendingDocument) {
        this.timer = setTimeout(
          () => void this.flush().catch(() => undefined),
          this.debounceMs,
        );
      }
    } catch (error) {
      this.pendingDocument = document;
      if (error instanceof EncounterSyncConflictError) {
        this.setState({ status: "conflict", pending: true });
        throw error;
      }
      this.setState({ status: "network-error", pending: true });
      this.retryTimer = setTimeout(
        () => void this.retry().catch(() => undefined),
        this.retryMs,
      );
      throw error;
    }
  }

  private setState(update: Partial<EncounterSyncState>) {
    this.state = { ...this.state, ...update };
    this.onStateChange?.(this.getState());
  }
}

const browserEncounterSyncTransport: EncounterSyncTransport = {
  async load(encounterId) {
    const response = await fetch(
      `/api/encounters/${encodeURIComponent(encounterId)}`,
    );
    const payload: unknown = await response.json().catch(() => undefined);
    if (
      !response.ok ||
      !payload ||
      typeof payload !== "object" ||
      typeof (payload as { revision?: unknown }).revision !== "number"
    ) {
      throw new Error("encounter_load_failed");
    }
    const document = (payload as { document?: unknown }).document;
    return {
      revision: (payload as { revision: number }).revision,
      document: isEncounterDocument(document) ? document : null,
    };
  },
  async save({ encounterId, revision, document }) {
    const response = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision, document }),
    });
    if (response.status === 409) throw new EncounterSyncConflictError();
    const payload: unknown = await response.json().catch(() => undefined);
    if (
      !response.ok ||
      !payload ||
      typeof payload !== "object" ||
      typeof (payload as { revision?: unknown }).revision !== "number"
    ) {
      throw new Error("encounter_sync_failed");
    }
    return { revision: (payload as { revision: number }).revision };
  },
};
