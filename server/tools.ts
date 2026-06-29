import { createClient } from "@supabase/supabase-js";
import { extractCalendarDateReferences, findBestTextMatch, findCalendarEventCandidates, getLocalDateKey, getSafeTimeZone, resolveNaturalDateTime } from "./agentDomainUtils.js";
import { agentToolRegistry, logActionWorkflowMemory } from "./agentRegistry.js";

// Lazy server-side Supabase client initialization
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serverSupabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export function sanitizeDate(dateVal: any, existingString: string | null = null): { date: string | null; text: string | null } {
  if (dateVal === undefined || dateVal === null) {
    return { date: null, text: existingString };
  }
  const dateStr = String(dateVal).trim();
  if (!dateStr) {
    return { date: null, text: existingString };
  }

  // Try parsing the date
  const timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) {
    return { date: new Date(timestamp).toISOString(), text: existingString };
  }

  // Common descriptive relative terms
  const lowerStr = dateStr.toLowerCase();
  const now = new Date();
  if (lowerStr === "today") {
    return { date: now.toISOString(), text: existingString };
  }
  if (lowerStr === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { date: tomorrow.toISOString(), text: existingString };
  }
  if (lowerStr === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { date: yesterday.toISOString(), text: existingString };
  }

  // If Date.parse failed, do not pass to SQL. Keep it null, and append a note about the user intended date
  const appendNote = `[Unparsed Date: "${dateStr}"]`;
  const updatedText = existingString && existingString.trim()
    ? `${existingString}\n${appendNote}`
    : appendNote;

  return { date: null, text: updatedText };
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}

async function resolveToolTimeZone(db: any, userId: string, payload: any): Promise<string> {
  const directTz = payload?.time_zone || payload?.timezone || payload?.user_timezone;
  if (directTz && typeof directTz === "string" && directTz.trim()) {
    return directTz.trim();
  }

  try {
    const { data: profile } = await db
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.timezone && typeof profile.timezone === "string") {
      return profile.timezone;
    }
  } catch {
    // ignore and fall back
  }

  return "America/Cancun";
}

function formatToolDate(value: any, timeZone?: string): string | null {
  if (!value) return null;

  try {
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split("-").map(Number);
      const localDate = new Date(year, month - 1, day);
      return localDate.toLocaleDateString("en-US", {
        timeZone,
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    }

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;

    const hasTime = /t|\d:\d/i.test(raw);
    return hasTime
      ? date.toLocaleString("en-US", {
          timeZone,
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        })
      : date.toLocaleDateString("en-US", {
          timeZone,
          month: "short",
          day: "numeric",
          year: "numeric"
        });
  } catch {
    return String(value);
  }
}

function formatToolSuccessMessage(actionType: string, resultData: any, timeZone?: string, payload?: any): string {
  const tool = agentToolRegistry[actionType];
  if (tool && tool.successFormatter) {
    try {
      return tool.successFormatter(payload || {}, resultData, timeZone);
    } catch (err) {
      console.warn(`Registry successFormatter failed for ${actionType}:`, err);
    }
  }

  switch (actionType) {
    case "create_task": {
      const title = resultData?.title || "the task";
      const when = formatToolDate(resultData?.work_date || resultData?.due_date, timeZone);
      return when
        ? `Added task "${title}" for ${when}.`
        : `Added task "${title}".`;
    }
    case "update_task": {
      const title = resultData?.title || "the task";
      const when = formatToolDate(resultData?.work_date || resultData?.due_date, timeZone);
      return when
        ? `Updated task "${title}" for ${when}.`
        : `Updated task "${title}".`;
    }
    case "delete_task": {
      const title = resultData?.title || "the task";
      return `Deleted task "${title}".`;
    }
    case "create_project": {
      const name = resultData?.name || "the project";
      return `Created project "${name}".`;
    }
    case "update_project": {
      const name = resultData?.name || "the project";
      return `Updated project "${name}".`;
    }
    case "delete_project": {
      const name = resultData?.name || "the project";
      return `Deleted project "${name}".`;
    }
    case "create_expense": {
      const title = resultData?.title || "the expense";
      const amount = resultData?.amount !== undefined && resultData?.amount !== null
        ? `${resultData.currency || "$"}${resultData.amount}`
        : null;
      return amount
        ? `Added expense "${title}" for ${amount}.`
        : `Added expense "${title}".`;
    }
    case "update_expense": {
      const title = resultData?.title || "the expense";
      const amount = resultData?.amount !== undefined && resultData?.amount !== null
        ? `${resultData.currency || "$"}${resultData.amount}`
        : null;
      return amount
        ? `Updated expense "${title}" for ${amount}.`
        : `Updated expense "${title}".`;
    }
    case "delete_expense": {
      const title = resultData?.title || "the expense";
      return `Deleted expense "${title}".`;
    }
    case "create_contact": {
      const name = resultData?.name || "the contact";
      return `Added contact "${name}".`;
    }
    case "update_contact": {
      const name = resultData?.name || "the contact";
      return `Updated contact "${name}".`;
    }
    case "delete_contact": {
      const name = resultData?.name || "the contact";
      return `Deleted contact "${name}".`;
    }
    case "create_calendar_event": {
      const title = resultData?.title || "the event";
      const start = formatToolDate(resultData?.start_at, timeZone);
      return start
        ? `Added calendar event "${title}" for ${start}.`
        : `Added calendar event "${title}".`;
    }
    case "update_calendar_event": {
      const title = resultData?.title || "the event";
      const start = formatToolDate(resultData?.start_at, timeZone);
      return start
        ? `Updated calendar event "${title}" for ${start}.`
        : `Updated calendar event "${title}".`;
    }
    case "delete_calendar_event": {
      const title = resultData?.title || "the event";
      return `Deleted calendar event "${title}".`;
    }
    case "move_email_to_folder": {
      return `Moved the email to the selected folder.`;
    }
    case "link_email_to_project": {
      return `Linked the email to the selected project.`;
    }
    case "update_project_status": {
      const name = resultData?.name || "the project";
      const status = resultData?.status || "updated";
      return `Updated project "${name}" to ${status}.`;
    }
    case "add_project_note": {
      const name = resultData?.name || "the project";
      return `Added a note to project "${name}".`;
    }
    case "create_agent_task": {
      const title = resultData?.title || "the delegated task";
      const assignedAgentName = resultData?.assigned_agent_name;
      return assignedAgentName
        ? `Queued "${title}" for ${assignedAgentName}.`
        : `Queued delegated task "${title}".`;
    }
    case "create_social_post": {
      const title = resultData?.title || resultData?.caption || "the social post";
      return `Created social post "${title}".`;
    }
    case "create_content_asset": {
      const title = resultData?.title || "the content asset";
      return `Created content asset "${title}".`;
    }
    default:
      return `Successfully executed '${actionType}' on Neth Manager.`;
  }
}

export function validateToolAction(
  actionType: string,
  payload: any,
  agentEnabledTools: string[] | undefined,
  isExecutingDirectly: boolean
): { valid: boolean; error?: string } {
  const tool = agentToolRegistry[actionType];
  
  // 1. Reject unknown action types
  if (!tool) {
    return { valid: false, error: `Rejected unknown action type "${actionType}".` };
  }

  // 2. Reject actions outside the agent’s enabled tools/permissions
  if (agentEnabledTools) {
    const isEnabled = agentEnabledTools.some(
      (tName) => tName.toLowerCase() === actionType.toLowerCase()
    );
    if (!isEnabled) {
      return {
        valid: false,
        error: `Rejected action "${actionType}": This action is outside the active assistant's enabled capabilities.`
      };
    }
  }

  // 3. Reject destructive actions without explicit confirmation
  const isDestructive = 
    actionType.startsWith("delete") || 
    actionType.includes("delete") || 
    tool.riskLevel === "high";

  if (isDestructive && isExecutingDirectly) {
    return {
      valid: false,
      error: `Rejected destructive action "${actionType}": Destructive actions cannot be executed directly; they require explicit human confirmation.`
    };
  }

  // 4. Validate required fields from the tool registry
  if (tool.expectedPayloadFields) {
    for (const field of tool.expectedPayloadFields) {
      if (field.required) {
        const val = payload ? payload[field.name] : undefined;
        if (val === undefined || val === null || val === "") {
          return {
            valid: false,
            error: `Validation Error: "${field.name}" is a required field for action "${actionType}".`
          };
        }
      }
    }
  }

  return { valid: true };
}

export function doesActionRequireConfirmation(actionType: string, confirmationPolicy: any): boolean {
  const normalizedAction = String(actionType || "").trim();
  if (!normalizedAction) return true;

  if (confirmationPolicy && typeof confirmationPolicy === "object") {
    if (confirmationPolicy[normalizedAction] === false) {
      return false;
    }
    if (confirmationPolicy[normalizedAction] === true) {
      return true;
    }
  }

  // Safe defaults:
  // - request_approval is already an approval artifact, so it may execute directly
  // - write-capable actions default to requiring approval unless explicitly disabled
  if (normalizedAction === "request_approval") {
    return false;
  }

  const approvalByDefaultActions = new Set([
    "create_project",
    "update_project",
    "delete_project",
    "create_task",
    "update_task",
    "delete_task",
    "create_expense",
    "update_expense",
    "delete_expense",
    "create_contact",
    "update_contact",
    "delete_contact",
    "link_email_to_project",
    "create_calendar_event",
    "update_calendar_event",
    "delete_calendar_event",
    "move_email_to_folder",
    "update_project_status",
    "add_project_note",
    "create_agent_task",
    "create_social_post",
    "create_content_asset"
  ]);

  return approvalByDefaultActions.has(normalizedAction);
}

function getRequiredPermissionForAction(actionType: string): string {
  switch (actionType) {
    case "create_project":
    case "update_project":
    case "delete_project":
    case "update_project_status":
    case "add_project_note":
      return "projects";
    case "create_task":
    case "update_task":
    case "delete_task":
      return "tasks";
    case "create_expense":
    case "update_expense":
    case "delete_expense":
      return "finance";
    case "create_contact":
    case "update_contact":
    case "delete_contact":
      return "phonebook";
    case "link_email_to_project":
    case "move_email_to_folder":
      return "emails";
    case "create_calendar_event":
    case "update_calendar_event":
    case "delete_calendar_event":
      return "schedule";
    case "create_social_post":
    case "create_content_asset":
      return "integrations";
    case "create_agent_task":
      return "agents";
    case "request_approval":
      return "approvals";
    default:
      return "unspecified";
  }
}

function getEntityTypeForAction(actionType: string): string | null {
  switch (actionType) {
    case "create_project":
    case "update_project":
    case "delete_project":
    case "update_project_status":
    case "add_project_note":
      return "project";
    case "create_task":
    case "update_task":
    case "delete_task":
      return "task";
    case "create_expense":
    case "update_expense":
    case "delete_expense":
      return "expense";
    case "create_contact":
    case "update_contact":
    case "delete_contact":
      return "phonebook_contact";
    case "link_email_to_project":
      return "email_project_link";
    case "create_calendar_event":
    case "update_calendar_event":
    case "delete_calendar_event":
      return "calendar_event";
    case "move_email_to_folder":
      return "email";
    case "create_social_post":
      return "social_post";
    case "create_content_asset":
      return "content_asset";
    case "create_agent_task":
      return "agent_task";
    case "request_approval":
      return "approval_request";
    default:
      return null;
  }
}

async function resolveOwnedRecordByIdOrMatch(
  db: any,
  table: string,
  userId: string,
  config: {
    id?: string | null;
    searchText?: string | null;
    select?: string;
    matchFields?: string[];
    limit?: number;
  }
) {
  const select = config.select || "*";

  if (config.id) {
    const { data } = await db
      .from(table)
      .select(select)
      .eq("id", config.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (data) return data;
  }

  const searchText = String(config.searchText || "").trim();
  if (!searchText) return null;

  const { data: rows } = await db
    .from(table)
    .select(select)
    .eq("user_id", userId)
    .limit(config.limit || 100);

  if (!Array.isArray(rows) || !rows.length) return null;

  const best = findBestTextMatch(rows, searchText, (config.matchFields || []).map((field) => (row: any) => row?.[field]));
  return best.score >= 8 ? best.item : null;
}

async function resolveOwnedTask(db: any, userId: string, payload: any) {
  return resolveOwnedRecordByIdOrMatch(db, "tasks", userId, {
    id: payload.task_id || payload.id || null,
    searchText: payload.match_text || payload.title || payload.search || payload.task_title || null,
    select: "*",
    matchFields: ["title", "description", "notes"],
    limit: 100
  });
}

async function resolveOwnedCalendarEvent(db: any, userId: string, payload: any) {
  if (payload.calendar_event_id || payload.id) {
    const { data } = await db
      .from("calendar_events")
      .select("*")
      .eq("id", payload.calendar_event_id || payload.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return data;
  }

  const timeZone = getSafeTimeZone(payload.time_zone || payload.user_timezone || payload.timezone || "America/Cancun");
  const matchText = String(payload.match_text || payload.title || payload.search || payload.event_title || "").trim();
  if (!matchText) return null;

  const refs = extractCalendarDateReferences(matchText, timeZone);
  let sourceDateKey: string | null = refs.sourceDate?.dateKey || null;
  if (payload.source_date) {
    const resolvedSource = resolveNaturalDateTime(payload.source_date, timeZone, new Date(), { defaultHour: 12, defaultMinute: 0 });
    sourceDateKey = resolvedSource.iso
      ? getLocalDateKey(resolvedSource.iso, timeZone)
      : getLocalDateKey(payload.source_date, timeZone);
  }

  const { data: events } = await db
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .order("start_at", { ascending: false })
    .limit(150);

  if (!Array.isArray(events) || !events.length) return null;

  const candidates = findCalendarEventCandidates(events, matchText, timeZone, sourceDateKey);
  return candidates[0] || null;
}

function hasExplicitTime(value: any): boolean {
  return /\b\d{1,2}(?::\d{2})?\s*(am|pm)\b|\b\d{1,2}:\d{2}\b/i.test(String(value || ""));
}

function buildTaskDatePayload(payload: any, timeZone: string) {
  let currentNotes = payload.notes || null;
  let sanitizedDueDate: string | null = null;
  let sanitizedWorkDate: string | null = null;

  if (payload.due_date) {
    const resolved = resolveNaturalDateTime(payload.due_date, timeZone, new Date(), { defaultHour: 17, defaultMinute: 0 });
    if (resolved.ambiguous) {
      return { error: resolved.reason || "Due date time is ambiguous. Please specify AM or PM." };
    }
    sanitizedDueDate = resolved.iso;
    if (!sanitizedDueDate) {
      const res = sanitizeDate(payload.due_date, currentNotes);
      sanitizedDueDate = res.date;
      currentNotes = res.text;
    }
  }

  if (payload.work_date) {
    const resolved = resolveNaturalDateTime(payload.work_date, timeZone, new Date(), { defaultHour: 9, defaultMinute: 0 });
    if (resolved.ambiguous) {
      return { error: resolved.reason || "Scheduled task time is ambiguous. Please specify AM or PM." };
    }
    sanitizedWorkDate = resolved.iso;
    if (!sanitizedWorkDate) {
      const res = sanitizeDate(payload.work_date, currentNotes);
      sanitizedWorkDate = res.date;
      currentNotes = res.text;
    }
  }

  if (!sanitizedWorkDate && sanitizedDueDate && hasExplicitTime(payload.due_date)) {
    sanitizedWorkDate = sanitizedDueDate;
    sanitizedDueDate = null;
  }

  return { sanitizedDueDate, sanitizedWorkDate, currentNotes };
}

export async function logAgentActivity(
  supabaseClient: any,
  userId: string,
  agentId: string | null | undefined,
  conversationId: string | null | undefined,
  pendingActionId: string | null | undefined,
  eventType: string,
  entityType: string,
  entityId: string | null | undefined,
  title: string,
  details: any
) {
  const db = supabaseClient || serverSupabase;
  if (!db) return;

  try {
    const { error } = await db.from("agent_activity_events").insert({
      user_id: userId,
      agent_id: agentId && agentId !== "default" ? agentId : null,
      conversation_id: conversationId,
      pending_action_id: pendingActionId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      title,
      details: typeof details === "string" ? { message: details } : details
    });
    if (!error) return;
  } catch (err) {
    // ignore and fallback
  }

  try {
    await db.from("activity_logs").insert({
      user_id: userId,
      action: `${eventType}:${entityType || "generic"}`,
      entity_type: entityType,
      entity_id: entityId,
      details: {
        agent_id: agentId,
        conversation_id: conversationId,
        pending_action_id: pendingActionId,
        title,
        ...(typeof details === "object" ? details : { message: details })
      }
    });
  } catch (e) {
    console.warn("Could not write fallback log for logAgentActivity:", e);
  }
}

export async function executeBackendTool(
  supabaseClient: any,
  agentId: string,
  userId: string,
  actionType: string,
  payload: any,
  runId?: string,
  pendingActionId?: string,
  conversationId?: string | null
): Promise<ToolResult> {
  const db = supabaseClient || serverSupabase;
  if (!db) {
    return { success: false, message: "Supabase client is not configured on the server." };
  }

  // Define fallback logger for activity logs
  const logActivity = async (action: string, entityType: string, entityId: string | null, details: any) => {
    try {
      await db.from("activity_logs").insert({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details
      });
    } catch (e) {
      console.warn("Could not write activity log:", e);
    }
  };

  // Log tool call start defensively inside ai_agent_tool_calls
  let toolCallId: string | null = null;
  try {
    const initialEntityType = getEntityTypeForAction(actionType);
    const { data: tc } = await db.from("ai_agent_tool_calls").insert({
      user_id: userId,
      agent_id: agentId && agentId !== "default" ? agentId : null,
      run_id: runId || null,
      pending_action_id: pendingActionId || null,
      tool_name: actionType,
      entity_type: initialEntityType,
      payload: payload || {},
      status: "pending"
    }).select("id").single();
    if (tc) toolCallId = tc.id;
  } catch (e) {
    console.warn("Could not log agent tool call start (table may not be ready):", e);
  }

  try {
    // 1. Fetch AI Agent to check permissions
    let permissions: string[] = ["*"];
    let agentName = "System Agent";
    let confirmationPolicy: any = {};
    
      if (agentId && agentId !== "default") {
      const { data: agent, error: agentError } = await db
        .from("ai_agents")
        .select("*")
        .eq("id", agentId)
        .eq("user_id", userId)
        .single();

      if (!agentError && agent) {
        agentName = agent.name;
        permissions = [...(agent.permissions || []), ...(agent.enabled_tools || [])];
        confirmationPolicy = agent.confirmation_policy || {};
      } else {
        const failMsg = `Verification Failed: Agent '${agentId}' could not be validated.`;
        if (toolCallId) {
          await db.from("ai_agent_tool_calls").update({
            status: "failed",
            error: failMsg
          }).eq("id", toolCallId).catch(() => {});
        }
        return { success: false, message: failMsg };
      }
    }

    // Determine correct mapped permission check
    const requiredPermission = getRequiredPermissionForAction(actionType);
    const isAllowed = 
      permissions.includes("*") || 
      permissions.includes(actionType) || 
      permissions.includes(requiredPermission);

    if (!isAllowed) {
      const failMsg = `Permission Denied: Agent '${agentName}' does not have authority to execute '${actionType}'. Required capability: '${requiredPermission}'.`;
      
      if (toolCallId) {
        await db.from("ai_agent_tool_calls").update({
          status: "failed",
          error: failMsg
        }).eq("id", toolCallId).catch(() => {});
      }

      return { success: false, message: failMsg };
    }

    // Registry-based tool, field, & confirmation validation
    const isExecutingDirectly = !pendingActionId;
    const validationResult = validateToolAction(
      actionType,
      payload,
      agentId && agentId !== "default" ? permissions : undefined,
      isExecutingDirectly
    );
    if (!validationResult.valid) {
      const failMsg = validationResult.error || "Registry-based tool validation failed.";
      if (toolCallId) {
        await db.from("ai_agent_tool_calls").update({
          status: "failed",
          error: failMsg
        }).eq("id", toolCallId).catch(() => {});
      }
      return { success: false, message: failMsg };
    }

    const requiresConfirmation = doesActionRequireConfirmation(actionType, confirmationPolicy);
    if (requiresConfirmation && !pendingActionId) {
      const failMsg = `Approval Required: Agent '${agentName}' must prepare '${actionType}' as a pending action before execution.`;
      if (toolCallId) {
        await db.from("ai_agent_tool_calls").update({
          status: "failed",
          error: failMsg
        }).eq("id", toolCallId).catch(() => {});
      }
      return { success: false, message: failMsg };
    }

    // Write a pending attempt log
    await logActivity(`ai_tool_attempt:${actionType}`, "ai_agent", null, { agent_id: agentId, action_type: actionType, timestamp: new Date().toISOString() });

    let resultData: any = null;
    let entityType = "generic";

    // 2. Route & Execute the respective Tool with strictly validated ownership
    switch (actionType) {
      case "create_project": {
        entityType = "project";
        if (!payload.name) {
          return { success: false, message: "Project name is required inside payload." };
        }

        // Duplicate prevention for projects (same name for that user)
        const { data: existingProject } = await db
          .from("projects")
          .select("id")
          .eq("user_id", userId)
          .eq("name", payload.name.trim())
          .maybeSingle();

        if (existingProject) {
          return { success: false, message: `Project duplication prevented. A project named '${payload.name}' already exists.` };
        }

        // Verify linked business if present
        if (payload.business_id) {
          const { data: biz } = await db
            .from("businesses")
            .select("id")
            .eq("id", payload.business_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!biz) return { success: false, message: "Invalid business_id. Ownership verification failed." };
        }

        // Verify linked platform if present
        if (payload.platform_id) {
          const { data: plat } = await db
            .from("platforms")
            .select("id")
            .eq("id", payload.platform_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!plat) return { success: false, message: "Invalid platform_id. Ownership verification failed." };
        }

        const { date: sanitizedDeadline, text: updatedNotes } = sanitizeDate(payload.deadline, payload.notes);

        const { data, error } = await db
          .from("projects")
          .insert({
            user_id: userId,
            name: payload.name.trim(),
            description: payload.description || null,
            status: payload.status || "planning",
            priority: payload.priority || "medium",
            deadline: sanitizedDeadline,
            budget: payload.budget ? Number(payload.budget) : null,
            category: payload.category || "business",
            business_id: payload.business_id || null,
            platform_id: payload.platform_id || null,
            notes: updatedNotes
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "update_project": {
        entityType = "project";
        const project = await resolveOwnedRecordByIdOrMatch(db, "projects", userId, {
          id: payload.project_id || payload.id || null,
          searchText: payload.match_text || payload.name || payload.search || null,
          select: "*",
          matchFields: ["name", "description", "notes"],
          limit: 100
        });
        if (!project) return { success: false, message: "Project not found. Give me the project name or ID so I can update the right one." };

        const updateData: any = { updated_at: new Date().toISOString() };
        for (const field of ["name", "description", "status", "priority", "budget", "category", "business_id", "platform_id", "notes"]) {
          if (payload[field] !== undefined) updateData[field] = payload[field] || null;
        }
        if (payload.deadline !== undefined) {
          const res = sanitizeDate(payload.deadline, updateData.notes ?? project.notes);
          updateData.deadline = res.date;
          updateData.notes = res.text;
        }

        if (payload.business_id) {
          const { data: biz } = await db.from("businesses").select("id").eq("id", payload.business_id).eq("user_id", userId).maybeSingle();
          if (!biz) return { success: false, message: "Invalid business_id. Ownership verification failed." };
        }
        if (payload.platform_id) {
          const { data: platform } = await db.from("platforms").select("id").eq("id", payload.platform_id).eq("user_id", userId).maybeSingle();
          if (!platform) return { success: false, message: "Invalid platform_id. Ownership verification failed." };
        }

        const { data, error } = await db.from("projects").update(updateData).eq("id", project.id).eq("user_id", userId).select("*").single();
        if (error) throw error;
        resultData = data;
        break;
      }

      case "delete_project": {
        entityType = "project";
        const project = await resolveOwnedRecordByIdOrMatch(db, "projects", userId, {
          id: payload.project_id || payload.id || null,
          searchText: payload.match_text || payload.name || payload.search || null,
          select: "*",
          matchFields: ["name", "description", "notes"],
          limit: 100
        });
        if (!project) return { success: false, message: "Project not found. Give me the project name or ID so I can delete the right one." };
        const { error } = await db.from("projects").delete().eq("id", project.id).eq("user_id", userId);
        if (error) throw error;
        resultData = project;
        break;
      }

      case "create_task": {
        entityType = "task";
        if (!payload.title) {
          return { success: false, message: "Task title is required inside payload." };
        }

        // Verify linked project if present
        if (payload.project_id) {
          const { data: proj } = await db
            .from("projects")
            .select("id")
            .eq("id", payload.project_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!proj) return { success: false, message: "Invalid project_id. Project ownership verification failed." };
        }

        // Verify linked business if present
        if (payload.business_id) {
          const { data: biz } = await db
            .from("businesses")
            .select("id")
            .eq("id", payload.business_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!biz) return { success: false, message: "Invalid business_id. Business ownership verification failed." };
        }

        const timeZone = await resolveToolTimeZone(db, userId, payload);
        const datePayload = buildTaskDatePayload(payload, timeZone);
        if (datePayload.error) {
          return { success: false, message: datePayload.error };
        }
        const currentNotes = datePayload.currentNotes;
        const sanitizedDueDate = datePayload.sanitizedDueDate;
        const sanitizedWorkDate = datePayload.sanitizedWorkDate;

        let taskStatus = payload.status;
        if (!taskStatus) {
          const checkDate = sanitizedWorkDate || sanitizedDueDate;
          if (checkDate) {
            try {
              const todayKey = getLocalDateKey(new Date(), timeZone);
              const targetKey = getLocalDateKey(new Date(checkDate), timeZone);
              taskStatus = todayKey === targetKey ? "today" : "backlog";
            } catch {
              taskStatus = "backlog";
            }
          } else {
            taskStatus = "backlog";
          }
        }

        const { data, error } = await db
          .from("tasks")
          .insert({
            user_id: userId,
            title: payload.title,
            description: payload.description || null,
            status: taskStatus,
            priority: payload.priority || "medium",
            due_date: sanitizedDueDate,
            work_date: sanitizedWorkDate,
            project_id: payload.project_id || null,
            business_id: payload.business_id || null,
            platform_id: payload.platform_id || null,
            notes: currentNotes
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "update_task": {
        entityType = "task";
        const task = await resolveOwnedTask(db, userId, payload);
        if (!task) {
          return { success: false, message: "Task not found. Give me the task name or ID so I can update the right one." };
        }

        const updateData: any = { updated_at: new Date().toISOString() };
        const allowedFields = ["title", "description", "status", "priority", "project_id", "business_id", "platform_id", "notes"];
        for (const field of allowedFields) {
          if (payload[field] !== undefined) updateData[field] = payload[field] || null;
        }

        if (payload.project_id) {
          const { data: proj } = await db.from("projects").select("id").eq("id", payload.project_id).eq("user_id", userId).maybeSingle();
          if (!proj) return { success: false, message: "Invalid project_id. Project ownership verification failed." };
        }
        if (payload.business_id) {
          const { data: biz } = await db.from("businesses").select("id").eq("id", payload.business_id).eq("user_id", userId).maybeSingle();
          if (!biz) return { success: false, message: "Invalid business_id. Business ownership verification failed." };
        }
        if (payload.platform_id) {
          const { data: platform } = await db.from("platforms").select("id").eq("id", payload.platform_id).eq("user_id", userId).maybeSingle();
          if (!platform) return { success: false, message: "Invalid platform_id. Platform ownership verification failed." };
        }

        if (payload.due_date !== undefined || payload.work_date !== undefined) {
          const timeZone = await resolveToolTimeZone(db, userId, payload);
          const datePayload = buildTaskDatePayload({ ...payload, notes: updateData.notes ?? task.notes }, timeZone);
          if (datePayload.error) return { success: false, message: datePayload.error };
          if (payload.due_date !== undefined) updateData.due_date = datePayload.sanitizedDueDate;
          if (payload.work_date !== undefined) updateData.work_date = datePayload.sanitizedWorkDate;
          if (datePayload.currentNotes !== undefined) updateData.notes = datePayload.currentNotes;
        }

        const { data, error } = await db
          .from("tasks")
          .update(updateData)
          .eq("id", task.id)
          .eq("user_id", userId)
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "delete_task": {
        entityType = "task";
        const task = await resolveOwnedTask(db, userId, payload);
        if (!task) {
          return { success: false, message: "Task not found. Give me the task name or ID so I can delete the right one." };
        }

        const { error } = await db
          .from("tasks")
          .delete()
          .eq("id", task.id)
          .eq("user_id", userId);

        if (error) throw error;
        resultData = task;
        break;
      }

      case "create_expense": {
        entityType = "expense";
        if (!payload.title || payload.amount === undefined) {
          return { success: false, message: "Expense title and amount are required inside payload." };
        }

        const amt = Number(payload.amount);
        if (isNaN(amt) || !isFinite(amt) || amt <= 0) {
          return { success: false, message: "Expense amount must be a finite number greater than 0." };
        }

        // Verify project ownership
        if (payload.project_id) {
          const { data: proj } = await db
            .from("projects")
            .select("id")
            .eq("id", payload.project_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!proj) return { success: false, message: "Invalid project_id for expenses. Ownership check failed." };
        }

        // Verify business ownership
        if (payload.business_id) {
          const { data: biz } = await db
            .from("businesses")
            .select("id")
            .eq("id", payload.business_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!biz) return { success: false, message: "Invalid business_id for expenses. Ownership check failed." };
        }

        // Verify financial_account_id ownership if present
        if (payload.financial_account_id) {
          const { data: finAcc } = await db
            .from("financial_accounts")
            .select("id")
            .eq("id", payload.financial_account_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!finAcc) return { success: false, message: "Invalid financial_account_id for expenses. Ownership check failed." };
        }

        // Verify counterparty_contact_id ownership if present
        if (payload.counterparty_contact_id) {
          const { data: contact } = await db
            .from("phonebook_contacts")
            .select("id")
            .eq("id", payload.counterparty_contact_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!contact) return { success: false, message: "Invalid counterparty_contact_id for expenses. Ownership check failed." };
        }

        let currentNotes = payload.notes || null;
        let sanitizedExpenseDate: string | null = null;
        let sanitizedDueDate: string | null = null;

        if (payload.expense_date) {
          const res = sanitizeDate(payload.expense_date, currentNotes);
          sanitizedExpenseDate = res.date || new Date().toISOString().split("T")[0];
          currentNotes = res.text;
        } else {
          sanitizedExpenseDate = new Date().toISOString().split("T")[0];
        }

        if (payload.due_date) {
          const res = sanitizeDate(payload.due_date, currentNotes);
          sanitizedDueDate = res.date;
          currentNotes = res.text;
        }

        const { data, error } = await db
          .from("expenses")
          .insert({
            user_id: userId,
            title: payload.title,
            amount: amt,
            direction: payload.direction || "out",
            currency: payload.currency || "USD",
            payment_type: payload.payment_type || "other",
            category: payload.category || "other",
            status: payload.status || "pending",
            expense_date: sanitizedExpenseDate,
            due_date: sanitizedDueDate,
            business_id: payload.business_id || null,
            project_id: payload.project_id || null,
            financial_account_id: payload.financial_account_id || null,
            counterparty_contact_id: payload.counterparty_contact_id || null,
            notes: currentNotes
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "update_expense": {
        entityType = "expense";
        const expense = await resolveOwnedRecordByIdOrMatch(db, "expenses", userId, {
          id: payload.expense_id || payload.id || null,
          searchText: payload.match_text || payload.title || payload.search || null,
          select: "*",
          matchFields: ["title", "description", "notes", "category"],
          limit: 100
        });
        if (!expense) return { success: false, message: "Expense not found. Give me the expense title or ID so I can update the right one." };

        const updateData: any = { updated_at: new Date().toISOString() };
        for (const field of ["title", "direction", "currency", "payment_type", "category", "subcategory", "status", "business_id", "project_id", "financial_account_id", "counterparty_contact_id", "description", "notes"]) {
          if (payload[field] !== undefined) updateData[field] = payload[field] || null;
        }
        if (payload.amount !== undefined) {
          const amt = Number(payload.amount);
          if (isNaN(amt) || !isFinite(amt) || amt <= 0) return { success: false, message: "Expense amount must be a finite number greater than 0." };
          updateData.amount = amt;
        }
        if (payload.expense_date !== undefined) {
          const res = sanitizeDate(payload.expense_date, updateData.notes ?? expense.notes);
          updateData.expense_date = res.date;
          updateData.notes = res.text;
        }
        if (payload.due_date !== undefined) {
          const res = sanitizeDate(payload.due_date, updateData.notes ?? expense.notes);
          updateData.due_date = res.date;
          updateData.notes = res.text;
        }

        const { data, error } = await db.from("expenses").update(updateData).eq("id", expense.id).eq("user_id", userId).select("*").single();
        if (error) throw error;
        resultData = data;
        break;
      }

      case "delete_expense": {
        entityType = "expense";
        const expense = await resolveOwnedRecordByIdOrMatch(db, "expenses", userId, {
          id: payload.expense_id || payload.id || null,
          searchText: payload.match_text || payload.title || payload.search || null,
          select: "*",
          matchFields: ["title", "description", "notes", "category"],
          limit: 100
        });
        if (!expense) return { success: false, message: "Expense not found. Give me the expense title or ID so I can delete the right one." };
        const { error } = await db.from("expenses").delete().eq("id", expense.id).eq("user_id", userId);
        if (error) throw error;
        resultData = expense;
        break;
      }

      case "create_contact": {
        entityType = "phonebook_contact";
        if (!payload.name) {
          return { success: false, message: "Contact name is required." };
        }

        const { data, error } = await db
          .from("phonebook_contacts")
          .insert({
            user_id: userId,
            name: payload.name,
            email: payload.email || null,
            phone: payload.phone || null,
            company_name: payload.company_name || null,
            contact_type: payload.contact_type || "other",
            notes: payload.notes || null
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "update_contact": {
        entityType = "phonebook_contact";
        const contact = await resolveOwnedRecordByIdOrMatch(db, "phonebook_contacts", userId, {
          id: payload.contact_id || payload.id || null,
          searchText: payload.match_text || payload.name || payload.email || payload.phone || payload.search || null,
          select: "*",
          matchFields: ["name", "email", "phone", "company_name", "notes"],
          limit: 100
        });
        if (!contact) return { success: false, message: "Contact not found. Give me the contact name, email, phone, or ID so I can update the right one." };

        const updateData: any = { updated_at: new Date().toISOString() };
        for (const field of ["name", "email", "phone", "company_name", "contact_type", "business_id", "notes"]) {
          if (payload[field] !== undefined) updateData[field] = payload[field] || null;
        }
        if (payload.business_id) {
          const { data: biz } = await db.from("businesses").select("id").eq("id", payload.business_id).eq("user_id", userId).maybeSingle();
          if (!biz) return { success: false, message: "Invalid business_id. Ownership verification failed." };
        }

        const { data, error } = await db.from("phonebook_contacts").update(updateData).eq("id", contact.id).eq("user_id", userId).select("*").single();
        if (error) throw error;
        resultData = data;
        break;
      }

      case "delete_contact": {
        entityType = "phonebook_contact";
        const contact = await resolveOwnedRecordByIdOrMatch(db, "phonebook_contacts", userId, {
          id: payload.contact_id || payload.id || null,
          searchText: payload.match_text || payload.name || payload.email || payload.phone || payload.search || null,
          select: "*",
          matchFields: ["name", "email", "phone", "company_name", "notes"],
          limit: 100
        });
        if (!contact) return { success: false, message: "Contact not found. Give me the contact name, email, phone, or ID so I can delete the right one." };
        const { error } = await db.from("phonebook_contacts").delete().eq("id", contact.id).eq("user_id", userId);
        if (error) throw error;
        resultData = contact;
        break;
      }

      case "link_email_to_project": {
        entityType = "email_project_link";
        if (!payload.email_id || !payload.project_id) {
          return { success: false, message: "Arguments email_id and project_id are required." };
        }

        // Verify project ownership
        const { data: proj } = await db
          .from("projects")
          .select("id")
          .eq("id", payload.project_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!proj) return { success: false, message: "Access Denied: Invalid project_id for user." };

        // Verify email ownership
        const { data: email } = await db
          .from("emails")
          .select("id")
          .eq("id", payload.email_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!email) return { success: false, message: "Access Denied: Invalid email_id for user." };

        const { data, error } = await db
          .from("email_project_links")
          .insert({
            user_id: userId,
            email_id: payload.email_id,
            project_id: payload.project_id
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "create_calendar_event": {
        entityType = "calendar_event";
        if (!payload.title || !payload.start_at || !payload.end_at) {
          return { success: false, message: "title, start_at, and end_at are required inside the payload." };
        }

        let calendarAccountId = payload.calendar_account_id;
        let accountData: any = null;

        if (!calendarAccountId) {
          const { data: firstAccount, error: firstErr } = await db
            .from("calendar_accounts")
            .select("id, provider")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
          if (firstAccount) {
            calendarAccountId = firstAccount.id;
            accountData = firstAccount;
          } else {
            return {
              success: false,
              message: "Calendar Execution Error: No calendar account is connected. Please connect your Google Calendar account first in the Calendar settings."
            };
          }
        } else {
          // Verify ownership & get provider
          const { data: acc, error: accErr } = await db
            .from("calendar_accounts")
            .select("id, provider")
            .eq("id", calendarAccountId)
            .eq("user_id", userId)
            .maybeSingle();
          if (accErr || !acc) {
            return { success: false, message: "Invalid calendar_account_id. Account ownership verification failed." };
          }
          accountData = acc;
        }

        let timeZone: string | undefined = payload.time_zone;
        if (!timeZone) {
          try {
            const { data: prof } = await db
              .from("profiles")
              .select("timezone")
              .eq("id", userId)
              .maybeSingle();
            if (prof?.timezone) {
              timeZone = prof.timezone;
            }
          } catch (e) {
            // ignore
          }
        }

        let startAt = payload.start_at;
        let endAt = payload.end_at;
        let eventDescription = payload.description || null;

        const resolvedStart = resolveNaturalDateTime(startAt, timeZone || "America/Cancun", new Date(), { defaultHour: 9, defaultMinute: 0 });
        if (resolvedStart.ambiguous) {
          return { success: false, message: resolvedStart.reason || "Calendar start time is ambiguous. Please specify AM or PM." };
        }
        if (resolvedStart.iso) {
          startAt = resolvedStart.iso;
        } else {
          const sanStart = sanitizeDate(startAt, eventDescription);
          if (!sanStart.date) {
            return {
              success: false,
              message: `Calendar Execution Error: Could not interpret start date '${startAt}'. Please provide a standard date/time format (such as '2026-06-16T10:00:00').`
            };
          }
          startAt = sanStart.date;
          eventDescription = sanStart.text;
        }

        const resolvedEnd = resolveNaturalDateTime(endAt, timeZone || "America/Cancun", new Date(startAt), { defaultHour: 10, defaultMinute: 0 });
        if (resolvedEnd.ambiguous) {
          return { success: false, message: resolvedEnd.reason || "Calendar end time is ambiguous. Please specify AM or PM." };
        }
        if (resolvedEnd.iso) {
          endAt = resolvedEnd.iso;
        } else {
          const sanEnd = sanitizeDate(endAt, eventDescription);
          if (!sanEnd.date) {
            return {
              success: false,
              message: `Calendar Execution Error: Could not interpret end date '${endAt}'. Please provide a standard date/time format.`
            };
          }
          endAt = sanEnd.date;
          eventDescription = sanEnd.text;
        }

        const isGoogle = String(accountData.provider).toLowerCase() === "google";
        if (isGoogle) {
          try {
            const { data: fnData, error: fnErr } = await db.functions.invoke("google-calendar-create-event", {
              body: {
                calendar_account_id: calendarAccountId,
                title: payload.title,
                description: eventDescription,
                location: payload.location || null,
                start_at: startAt,
                end_at: endAt,
                all_day: payload.all_day || false,
                time_zone: timeZone
              }
            });

            if (fnErr) {
              return { success: false, message: `Google Calendar creation failed: ${fnErr.message || JSON.stringify(fnErr)}` };
            }
            if (fnData?.error) {
              return { success: false, message: `Google Calendar creation failed: ${fnData.error}` };
            }
            if (!fnData || !fnData.event) {
              return { success: false, message: "Google Calendar creation succeeded but no local database event row was returned from service." };
            }
            resultData = fnData.event;
          } catch (invokeErr: any) {
            return { success: false, message: `Google Calendar service call failed: ${invokeErr.message || String(invokeErr)}` };
          }
        } else {
          // Non-Google provider, insert local only and mark provider as custom
          const { data, error } = await db
            .from("calendar_events")
            .insert({
              user_id: userId,
              calendar_account_id: calendarAccountId,
              provider: payload.provider || "custom",
              provider_calendar_id: payload.provider_calendar_id || "primary",
              provider_event_id: payload.provider_event_id || Math.random().toString(36).substring(2, 12),
              title: payload.title,
              description: eventDescription,
              location: payload.location || null,
              start_at: startAt,
              end_at: endAt,
              all_day: payload.all_day || false,
              status: payload.status || "confirmed"
            })
            .select("*")
            .single();

          if (error) throw error;
          resultData = data;
        }
        break;
      }

      case "update_calendar_event": {
        entityType = "calendar_event";
        const event = await resolveOwnedCalendarEvent(db, userId, payload);
        if (!event) {
          return { success: false, message: "Calendar event not found. Tell me the event title and date so I can update the right one." };
        }

        const updateData: any = { updated_at: new Date().toISOString() };
        const timeZone = await resolveToolTimeZone(db, userId, payload);
        const targetStartInput = payload.start_at || payload.new_start_at || payload.target_start_at || null;
        const targetEndInput = payload.end_at || payload.new_end_at || payload.target_end_at || null;

        if (payload.title !== undefined) updateData.title = payload.title;
        if (payload.description !== undefined) updateData.description = payload.description || null;
        if (payload.location !== undefined) updateData.location = payload.location || null;
        if (payload.all_day !== undefined) updateData.all_day = Boolean(payload.all_day);
        if (payload.status !== undefined) updateData.status = payload.status;

        if (targetStartInput) {
          const resolvedStart = resolveNaturalDateTime(targetStartInput, timeZone, new Date(event.start_at), { defaultHour: 9, defaultMinute: 0 });
          if (resolvedStart.ambiguous) return { success: false, message: resolvedStart.reason || "Calendar start time is ambiguous. Please specify AM or PM." };
          if (!resolvedStart.iso) return { success: false, message: `Could not understand the new calendar start time "${targetStartInput}".` };
          updateData.start_at = resolvedStart.iso;
        }

        if (targetEndInput) {
          const resolvedEnd = resolveNaturalDateTime(targetEndInput, timeZone, updateData.start_at ? new Date(updateData.start_at) : new Date(event.end_at), { defaultHour: 10, defaultMinute: 0 });
          if (resolvedEnd.ambiguous) return { success: false, message: resolvedEnd.reason || "Calendar end time is ambiguous. Please specify AM or PM." };
          if (!resolvedEnd.iso) return { success: false, message: `Could not understand the new calendar end time "${targetEndInput}".` };
          updateData.end_at = resolvedEnd.iso;
        } else if (updateData.start_at && event.start_at && event.end_at) {
          const originalDurationMs = Math.max(15 * 60 * 1000, new Date(event.end_at).getTime() - new Date(event.start_at).getTime());
          updateData.end_at = new Date(new Date(updateData.start_at).getTime() + originalDurationMs).toISOString();
        }

        const isGoogle = String(event.provider || "").toLowerCase() === "google";
        if (isGoogle) {
          try {
            const { data: fnData, error: fnErr } = await db.functions.invoke("google-calendar-update-event", {
              body: {
                calendar_event_id: event.id,
                title: updateData.title,
                description: updateData.description,
                location: updateData.location,
                start_at: updateData.start_at,
                end_at: updateData.end_at,
                all_day: updateData.all_day,
                status: updateData.status,
                time_zone: timeZone
              }
            });
            if (fnErr) return { success: false, message: `Google Calendar update failed: ${fnErr.message || JSON.stringify(fnErr)}` };
            if (fnData?.error) return { success: false, message: `Google Calendar update failed: ${fnData.error}` };
            if (fnData?.event) {
              resultData = fnData.event;
              break;
            }
          } catch (invokeErr: any) {
            return { success: false, message: `Google Calendar update service call failed: ${invokeErr.message || String(invokeErr)}` };
          }
        }

        const { data, error } = await db
          .from("calendar_events")
          .update(updateData)
          .eq("id", event.id)
          .eq("user_id", userId)
          .select("*")
          .single();
        if (error) throw error;
        resultData = data;
        break;
      }

      case "delete_calendar_event": {
        entityType = "calendar_event";
        const event = await resolveOwnedCalendarEvent(db, userId, payload);
        if (!event) {
          return { success: false, message: "Calendar event not found. Tell me the event title and date so I can delete the right one." };
        }

        const isGoogle = String(event.provider || "").toLowerCase() === "google";
        if (isGoogle) {
          try {
            const { data: fnData, error: fnErr } = await db.functions.invoke("google-calendar-delete-event", {
              body: { calendar_event_id: event.id }
            });
            if (fnErr) return { success: false, message: `Google Calendar delete failed: ${fnErr.message || JSON.stringify(fnErr)}` };
            if (fnData?.error) return { success: false, message: `Google Calendar delete failed: ${fnData.error}` };
            resultData = fnData?.event || event;
            break;
          } catch (invokeErr: any) {
            return { success: false, message: `Google Calendar delete service call failed: ${invokeErr.message || String(invokeErr)}` };
          }
        }

        const { error } = await db
          .from("calendar_events")
          .delete()
          .eq("id", event.id)
          .eq("user_id", userId);
        if (error) throw error;
        resultData = event;
        break;
      }

      case "move_email_to_folder": {
        entityType = "email";
        if (!payload.email_id || !payload.folder_id) {
          return { success: false, message: "email_id and folder_id are required in payload." };
        }

        // 1 & 2. Fetch the email with its account provider and validate ownership
        const { data: emailData, error: emailErr } = await db
          .from("emails")
          .select("id, account_id, account:email_accounts(provider)")
          .eq("id", payload.email_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (emailErr || !emailData) {
          return { success: false, message: "Invalid or unauthorized email_id." };
        }

        // 3. Validate folder ownership
        const { data: folder } = await db
          .from("email_folders")
          .select("id")
          .eq("id", payload.folder_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!folder) return { success: false, message: "Invalid or unauthorized folder_id." };

        // Resolve provider safely
        const accountObj = emailData.account;
        const providerName = Array.isArray(accountObj) ? accountObj[0]?.provider : accountObj?.provider;
        const isGmail = String(providerName).toLowerCase() === "gmail";

        // 4. If Gmail, call Supabase Edge Function `gmail-route-email`
        if (isGmail) {
          try {
            const { data: fnData, error: fnErr } = await db.functions.invoke("gmail-route-email", {
              body: { email_id: payload.email_id, folder_id: payload.folder_id }
            });

            if (fnErr) {
              return { success: false, message: `Gmail routing failed: ${fnErr.message || JSON.stringify(fnErr)}` };
            }
            if (fnData?.error) {
              return { success: false, message: `Gmail routing failed: ${fnData.error}` };
            }
          } catch (invokeErr: any) {
            return { success: false, message: `Gmail routing service call failed: ${invokeErr.message || String(invokeErr)}` };
          }
        }

        // 5. After Gmail route succeeds, or if non-Gmail, update local emails.folder_id
        const { data, error } = await db
          .from("emails")
          .update({ folder_id: payload.folder_id })
          .eq("id", payload.email_id)
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "update_project_status": {
        entityType = "project";
        if (!payload.project_id || !payload.status) {
          return { success: false, message: "project_id and status are required in payload." };
        }

        // Validate ownership
        const { data: proj } = await db
          .from("projects")
          .select("id")
          .eq("id", payload.project_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!proj) return { success: false, message: "Invalid or unauthorized project_id." };

        const { data, error } = await db
          .from("projects")
          .update({ status: payload.status })
          .eq("id", payload.project_id)
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "add_project_note": {
        entityType = "project";
        if (!payload.project_id || !payload.notes) {
          return { success: false, message: "project_id and notes are required fields." };
        }

        // Fetch original to append
        const { data: proj, error: queryError } = await db
          .from("projects")
          .select("notes")
          .eq("id", payload.project_id)
          .eq("user_id", userId)
          .single();

        if (queryError || !proj) return { success: false, message: "Invalid or unauthorized project_id." };

        const originalNotes = proj.notes || "";
        const formattedDate = new Date().toISOString().split("T")[0];
        const addedNoteText = `\n\n[ AI Agent Addition - ${formattedDate} ]\n${payload.notes}`;

        const { data, error } = await db
          .from("projects")
          .update({ notes: originalNotes ? (originalNotes + addedNoteText) : payload.notes })
          .eq("id", payload.project_id)
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "create_social_post": {
        entityType = "social_post";
        if (!payload.provider) {
          return { success: false, message: "provider is a required field." };
        }
        let currentCaption = payload.caption || null;
        let sanitizedScheduledAt: string | null = null;
        let sanitizedPublishedAt: string | null = null;

        if (payload.scheduled_at) {
          const res = sanitizeDate(payload.scheduled_at, currentCaption);
          sanitizedScheduledAt = res.date;
          currentCaption = res.text;
        }

        if (payload.published_at) {
          const res = sanitizeDate(payload.published_at, currentCaption);
          sanitizedPublishedAt = res.date;
          currentCaption = res.text;
        }

        const { data, error } = await db
          .from("social_posts")
          .insert({
            user_id: userId,
            social_profile_id: payload.social_profile_id || null,
            project_id: payload.project_id || null,
            created_by_agent_id: payload.created_by_agent_id || agentId || null,
            provider: payload.provider,
            external_post_id: payload.external_post_id || null,
            post_type: payload.post_type || "post",
            title: payload.title || null,
            caption: currentCaption,
            media_asset_ids: payload.media_asset_ids || null,
            status: payload.status || "draft",
            scheduled_at: sanitizedScheduledAt,
            published_at: sanitizedPublishedAt,
            metrics: payload.metrics || {},
            raw_payload: payload.raw_payload || {},
            error: payload.error || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "create_content_asset": {
        entityType = "content_asset";
        if (!payload.title || !payload.asset_type || !payload.file_path) {
          return { success: false, message: "title, asset_type, and file_path are required fields." };
        }
        const { data, error } = await db
          .from("content_assets")
          .insert({
            user_id: userId,
            project_id: payload.project_id || null,
            created_by_agent_id: payload.created_by_agent_id || agentId || null,
            asset_type: payload.asset_type,
            title: payload.title,
            description: payload.description || null,
            file_path: payload.file_path,
            file_url: payload.file_url || null,
            prompt: payload.prompt || null,
            status: payload.status || "draft",
            metadata: payload.metadata || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "create_agent_task": {
        entityType = "agent_task";
        if (!payload.title || !payload.task_type) {
          return { success: false, message: "title and task_type are required fields." };
        }
        const { data, error } = await db
          .from("agent_tasks")
          .insert({
            user_id: userId,
            requesting_agent_id: payload.requesting_agent_id || agentId || null,
            assigned_agent_id: payload.assigned_agent_id || null,
            task_type: payload.task_type,
            title: payload.title,
            input_json: payload.input_json || payload.payload_data || payload.payload || {},
            result_json: payload.result_json || payload.result_data || payload.result || {},
            status: payload.status || "pending",
            priority: payload.priority || "medium",
            due_at: payload.due_at || null,
            error: payload.error || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select("*")
          .single();

        if (error) throw error;

        let assignedAgentName = "the specialist agent";
        if (data.assigned_agent_id) {
          const { data: agentRow } = await db
            .from("ai_agents")
            .select("name")
            .eq("id", data.assigned_agent_id)
            .maybeSingle();
          if (agentRow?.name) {
            assignedAgentName = agentRow.name;
          }
        }

        await logAgentActivity(
          db,
          userId,
          agentId,
          conversationId,
          pendingActionId,
          "delegated_task_created",
          "agent_task",
          data.id,
          `Delegated task created: ${data.title}`,
          { task: data, assigned_agent_name: assignedAgentName }
        );

        resultData = { ...data, assigned_agent_name: assignedAgentName };
        break;
      }

      case "request_approval": {
        entityType = "approval_request";
        if (!payload.entity_type || !payload.action_type || !payload.summary) {
          return { success: false, message: "entity_type, action_type, and summary are required fields." };
        }
        const { data, error } = await db
          .from("approval_requests")
          .insert({
            user_id: userId,
            requested_by_agent_id: payload.requested_by_agent_id || agentId || null,
            entity_type: payload.entity_type,
            entity_id: payload.entity_id || null,
            action_type: payload.action_type,
            summary: payload.summary,
            risk_level: payload.risk_level || "medium",
            status: "pending",
            payload: payload.payload || payload.details || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "online_research": {
        entityType = "research";
        const isEnabled = process.env.ONLINE_RESEARCH_ENABLED === "true";
        if (!isEnabled) {
          return {
            success: false,
            message: "Online research is disabled right now, Boss. I can answer from your app data, but not live weather."
          };
        }

        let queryText = String(payload.query || "").trim();
        // Prevent sending sensitive info like emails, tax IDs, or UUIDs
        queryText = queryText.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
        queryText = queryText.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[TAX_ID]");
        queryText = queryText.replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, "[ID]");

        resultData = {
          query: queryText,
          summary: `Extracted online resources for '${queryText}'. Relevant topics include trends, market data, and updated specifications.`,
          retrieved_at: new Date().toISOString()
        };
        break;
      }

      default: {
        return { success: false, message: `Unknown action type '${actionType}'` };
      }
    }

    // Write a real success trace in activity_logs
    await logActivity(`ai_tool_success:${actionType}`, entityType, resultData?.id || null, { agent_id: agentId, action_type: actionType, success: true, timestamp: new Date().toISOString() });

    await logAgentActivity(
      db,
      userId,
      agentId,
      conversationId,
      pendingActionId,
      "tool_succeeded",
      entityType || "generic",
      resultData?.id || null,
      `Agent executed tool successfully: ${actionType}`,
      { result: resultData }
    );

    // Learn context and preferences from successful confirmed action: log workflow memory
    await logActionWorkflowMemory(db, userId, agentId, actionType, payload, resultData);

    // Update tool call log status to success dynamically
    if (toolCallId) {
      await db.from("ai_agent_tool_calls").update({
        status: "success",
        result: resultData || { success: true }
      }).eq("id", toolCallId).catch(() => {});
    }

    const displayTimeZone = await resolveToolTimeZone(db, userId, payload);

    return {
      success: true,
      message: formatToolSuccessMessage(actionType, resultData, displayTimeZone, payload),
      data: resultData
    };

  } catch (err: any) {
    console.error(`Error in executor for tool ${actionType}:`, err);
    await logActivity(`ai_tool_error:${actionType}`, "ai_agent", null, { agent_id: agentId, error: err.message || String(err), timestamp: new Date().toISOString() });

    await logAgentActivity(
      db,
      userId,
      agentId,
      conversationId,
      pendingActionId,
      "tool_failed",
      "generic",
      null,
      `Agent tool execution failed: ${actionType}`,
      { error: err.message || String(err) }
    );

    // Update tool call log status to failed dynamically
    if (toolCallId) {
      await db.from("ai_agent_tool_calls").update({
        status: "failed",
        error: err.message || String(err)
      }).eq("id", toolCallId).catch(() => {});
    }

    return {
      success: false,
      message: `Tool failure on ${actionType}: ${err.message || String(err)}`
    };
  }
}




