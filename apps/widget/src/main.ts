type WidgetState = "idle" | "loading" | "in_flow" | "completed" | "error";

type WidgetQuestion = {
  id: string;
  prompt: string;
  field_key: string;
  input_type: string;
  required: boolean;
};

type StartConversationResponse = {
  conversation_id: string;
  bot_messages: string[];
  next_question: WidgetQuestion | null;
  status: string;
};

type SubmitAnswerResponse = {
  conversation_id: string;
  bot_messages: string[];
  next_question: WidgetQuestion | null;
  status: string;
  lead_id: string | null;
};

type ConversationMessage = {
  id: string;
  sender: string;
  text: string;
  created_at: string;
};

type ConversationStateResponse = {
  conversation_id: string;
  status: string;
  current_node_id: string | null;
  next_question: WidgetQuestion | null;
  lead_id: string | null;
  messages: ConversationMessage[];
};

type WidgetConfigResponse = {
  widget: {
    welcomeText?: string;
    primaryColor?: string;
  };
  flow: {
    preview_messages?: string[];
    first_question?: WidgetQuestion | null;
  } | null;
};

const VISITOR_KEY = "csw_visitor_id";
const CONVERSATION_KEY = "csw_conversation_id";
const rootId = "csw-widget-root";

const randomId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const getVisitorId = (): string => {
  const existingId = localStorage.getItem(VISITOR_KEY);
  if (existingId) {
    return existingId;
  }

  const newId = randomId();
  localStorage.setItem(VISITOR_KEY, newId);
  return newId;
};

const getScriptConfig = (): { apiUrl: string; siteKey: string } => {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    (document.querySelector("script[data-csw-widget]") as HTMLScriptElement | null);

  const apiUrl = script?.dataset.apiUrl?.trim() ?? "http://localhost:4000";
  const siteKey = script?.dataset.siteKey?.trim() ?? "demo_site_key";

  return {
    apiUrl: apiUrl.replace(/\/+$/, ""),
    siteKey
  };
};

const createRoot = (): HTMLDivElement => {
  const existingRoot = document.getElementById(rootId) as HTMLDivElement | null;
  if (existingRoot) {
    return existingRoot;
  }

  const root = document.createElement("div");
  root.id = rootId;
  root.style.position = "fixed";
  root.style.right = "16px";
  root.style.bottom = "16px";
  root.style.width = "320px";
  root.style.maxWidth = "calc(100vw - 24px)";
  root.style.zIndex = "9999";
  root.style.fontFamily = "Segoe UI, Tahoma, Geneva, Verdana, sans-serif";
  document.body.appendChild(root);
  return root;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

class CSWWidget {
  private readonly apiUrl: string;
  private readonly siteKey: string;
  private readonly visitorId: string;
  private readonly root: HTMLDivElement;
  private state: WidgetState = "idle";
  private isOpen = false;
  private conversationId: string | null = localStorage.getItem(CONVERSATION_KEY);
  private currentQuestion: WidgetQuestion | null = null;
  private messages: string[] = [];
  private primaryColor = "#111111";
  private welcomeText = "Lead widget is ready";
  private leadId: string | null = null;

  constructor(apiUrl: string, siteKey: string) {
    this.apiUrl = apiUrl;
    this.siteKey = siteKey;
    this.visitorId = getVisitorId();
    this.root = createRoot();
  }

  async init(): Promise<void> {
    this.render();
    try {
      const config = await this.fetchConfig();
      this.primaryColor = config.widget?.primaryColor ?? this.primaryColor;
      this.welcomeText = config.widget?.welcomeText ?? "Lead widget is ready";
      this.messages = config.flow?.preview_messages ?? [];
      this.currentQuestion = config.flow?.first_question ?? null;
      if (this.conversationId) {
        await this.restoreConversation(this.conversationId);
      }
      this.render();
    } catch {
      this.state = "error";
      this.messages = ["Failed to load widget config from API"];
      this.render();
    }
  }

  private normalizeMessage(sender: string, text: string): string {
    if (sender === "visitor") {
      return `You: ${text}`;
    }
    if (sender === "operator") {
      return `Operator: ${text}`;
    }
    if (sender === "system") {
      return `System: ${text}`;
    }
    return text;
  }

  private async restoreConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/v1/widget/conversations/${encodeURIComponent(conversationId)}`);

    if (!response.ok) {
      localStorage.removeItem(CONVERSATION_KEY);
      this.conversationId = null;
      return;
    }

    const payload = (await response.json()) as ConversationStateResponse;
    this.messages = payload.messages.map((message) => this.normalizeMessage(message.sender, message.text));
    this.currentQuestion = payload.next_question;
    this.leadId = payload.lead_id;
    this.state = payload.status === "COMPLETED" ? "completed" : "in_flow";
  }

  private async fetchConfig(): Promise<WidgetConfigResponse> {
    const response = await fetch(`${this.apiUrl}/v1/widget/config?site_key=${encodeURIComponent(this.siteKey)}`);
    if (!response.ok) {
      throw new Error("config_request_failed");
    }
    return (await response.json()) as WidgetConfigResponse;
  }

  private async startConversation(): Promise<void> {
    this.state = "loading";
    this.render();

    const idempotencyKey = `conv_${this.visitorId}`;
    const response = await fetch(`${this.apiUrl}/v1/widget/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_key: this.siteKey,
        visitor_id: this.visitorId,
        idempotency_key: idempotencyKey
      })
    });

    if (!response.ok) {
      this.state = "error";
      this.messages = ["Cannot start conversation"];
      this.render();
      return;
    }

    const payload = (await response.json()) as StartConversationResponse;
    this.conversationId = payload.conversation_id;
    localStorage.setItem(CONVERSATION_KEY, this.conversationId);
    this.messages = (payload.bot_messages ?? []).map((message) => this.normalizeMessage("bot", message));
    this.currentQuestion = payload.next_question;
    this.state = payload.status === "COMPLETED" ? "completed" : "in_flow";
    this.render();
  }

  private async submitAnswer(answer: string): Promise<void> {
    if (!this.conversationId || !this.currentQuestion) {
      return;
    }

    this.state = "loading";
    this.messages.push(this.normalizeMessage("visitor", answer));
    this.render();

    const response = await fetch(`${this.apiUrl}/v1/widget/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: this.conversationId,
        answer
      })
    });

    if (!response.ok) {
      this.state = "error";
      this.messages.push("Failed to submit answer");
      this.render();
      return;
    }

    const payload = (await response.json()) as SubmitAnswerResponse;
    this.messages.push(...(payload.bot_messages ?? []).map((message) => this.normalizeMessage("bot", message)));
    this.currentQuestion = payload.next_question;
    this.leadId = payload.lead_id;
    this.state = payload.status === "COMPLETED" ? "completed" : "in_flow";
    this.render();
  }

  private toggleOpen(): void {
    this.isOpen = !this.isOpen;
    this.render();
    if (this.isOpen && !this.conversationId && this.state !== "error") {
      void this.startConversation();
    }
  }

  private renderMessages(): string {
    if (this.messages.length === 0) {
      return `<div style="font-size:13px;color:#666">No messages yet</div>`;
    }

    return this.messages
      .map(
        (message) =>
          `<div style="margin:0 0 8px 0;padding:8px;background:#f3f4f6;border-radius:8px;font-size:13px;color:#111">${escapeHtml(message)}</div>`
      )
      .join("");
  }

  private renderQuestion(): string {
    if (!this.currentQuestion || this.state === "completed") {
      return "";
    }

    return `
      <form id="csw-answer-form" style="margin-top:12px;display:flex;gap:8px;align-items:center">
        <input id="csw-answer-input" type="text" placeholder="${escapeHtml(this.currentQuestion.prompt)}" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:13px" />
        <button type="submit" style="border:none;background:${this.primaryColor};color:#fff;padding:8px 10px;border-radius:8px;cursor:pointer">Send</button>
      </form>
    `;
  }

  private renderCompleted(): string {
    if (this.state !== "completed") {
      return "";
    }

    return `<div style="margin-top:12px;padding:8px;background:#e8f7ed;border-radius:8px;font-size:13px;color:#14532d">Lead captured${this.leadId ? ` (ID: ${escapeHtml(this.leadId)})` : ""}.</div>`;
  }

  private bindEvents(): void {
    const toggleButton = document.getElementById("csw-toggle-btn");
    const answerForm = document.getElementById("csw-answer-form") as HTMLFormElement | null;
    const answerInput = document.getElementById("csw-answer-input") as HTMLInputElement | null;

    toggleButton?.addEventListener("click", () => this.toggleOpen());

    answerForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const answer = answerInput?.value?.trim() ?? "";
      if (!answer) {
        return;
      }
      if (answerInput) {
        answerInput.value = "";
      }
      void this.submitAnswer(answer);
    });
  }

  private render(): void {
    const panelDisplay = this.isOpen ? "block" : "none";
    const stateLabel =
      this.state === "loading"
        ? "Loading..."
        : this.state === "completed"
          ? "Completed"
          : this.state === "error"
            ? "Error"
            : "Online";

    this.root.innerHTML = `
      <button id="csw-toggle-btn" style="width:100%;border:none;background:${this.primaryColor};color:#fff;padding:12px;border-radius:10px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.2)">
        ${escapeHtml(this.welcomeText)}
      </button>
      <div style="display:${panelDisplay};margin-top:10px;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.16);overflow:hidden">
        <div style="padding:10px 12px;background:#f8f8f8;border-bottom:1px solid #eee;font-size:12px;color:#444">Status: ${stateLabel}</div>
        <div style="padding:12px;max-height:320px;overflow:auto">
          ${this.renderMessages()}
          ${this.renderQuestion()}
          ${this.renderCompleted()}
        </div>
      </div>
    `;

    this.bindEvents();
  }
}

const boot = (): void => {
  const { apiUrl, siteKey } = getScriptConfig();
  const widget = new CSWWidget(apiUrl, siteKey);
  void widget.init();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
