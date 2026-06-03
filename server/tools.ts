import { createClient } from "@supabase/supabase-js";

// Lazy server-side Supabase client initialization
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serverSupabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}

function getRequiredPermissionForAction(actionType: string): string {
  switch (actionType) {
    case "create_project":
    case "update_project_status":
    case "add_project_note":
      return "projects";
    case "create_task":
      return "tasks";
    case "create_expense":
      return "finance";
    case "create_contact":
      return "phonebook";
    case "link_email_to_project":
    case "move_email_to_folder":
      return "emails";
    case "create_calendar_event":
      return "schedule";
    default:
      return "unspecified";
  }
}

export async function executeBackendTool(
  supabaseClient: any,
  agentId: string,
  userId: string,
  actionType: string,
  payload: any,
  runId?: string,
  pendingActionId?: string
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
    const { data: tc } = await db.from("ai_agent_tool_calls").insert({
      user_id: userId,
      agent_id: agentId && agentId !== "default" ? agentId : null,
      run_id: runId || null,
      pending_action_id: pendingActionId || null,
      tool_name: actionType,
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
      } else {
        const failMsg = `Verification Failed: Agent '${agentId}' could not be validated.`;
        if (toolCallId) {
          await db.from("ai_agent_tool_calls").update({
            status: "failed",
            error: failMsg,
            resolved_at: new Date().toISOString()
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
          error: failMsg,
          resolved_at: new Date().toISOString()
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

        const { data, error } = await db
          .from("projects")
          .insert({
            user_id: userId,
            name: payload.name.trim(),
            description: payload.description || null,
            status: payload.status || "planning",
            priority: payload.priority || "medium",
            deadline: payload.deadline || null,
            budget: payload.budget ? Number(payload.budget) : null,
            category: payload.category || "business",
            business_id: payload.business_id || null,
            platform_id: payload.platform_id || null,
            notes: payload.notes || null
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
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

        const { data, error } = await db
          .from("tasks")
          .insert({
            user_id: userId,
            title: payload.title,
            description: payload.description || null,
            status: payload.status || "backlog",
            priority: payload.priority || "medium",
            due_date: payload.due_date || null,
            work_date: payload.work_date || null,
            project_id: payload.project_id || null,
            business_id: payload.business_id || null,
            platform_id: payload.platform_id || null,
            notes: payload.notes || null
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
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
            expense_date: payload.expense_date || new Date().toISOString().split("T")[0],
            due_date: payload.due_date || null,
            business_id: payload.business_id || null,
            project_id: payload.project_id || null,
            financial_account_id: payload.financial_account_id || null,
            counterparty_contact_id: payload.counterparty_contact_id || null,
            notes: payload.notes || null
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
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
        if (!calendarAccountId) {
          const { data: firstAccount } = await db
            .from("calendar_accounts")
            .select("id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
          if (firstAccount) {
            calendarAccountId = firstAccount.id;
          } else {
            return {
              success: false,
              message: "Calendar Execution Error: No calendar account is connected. Please connect your Google Calendar account first in the Calendar settings."
            };
          }
        } else {
          // Verify ownership of the referenced calendar account
          const { data: acc } = await db
            .from("calendar_accounts")
            .select("id")
            .eq("id", calendarAccountId)
            .eq("user_id", userId)
            .maybeSingle();
          if (!acc) return { success: false, message: "Invalid calendar_account_id. Account ownership verification failed." };
        }

        const { data, error } = await db
          .from("calendar_events")
          .insert({
            user_id: userId,
            calendar_account_id: calendarAccountId,
            provider: payload.provider || "google",
            provider_calendar_id: payload.provider_calendar_id || "primary",
            provider_event_id: payload.provider_event_id || Math.random().toString(36).substring(2, 12),
            title: payload.title,
            description: payload.description || null,
            location: payload.location || null,
            start_at: payload.start_at,
            end_at: payload.end_at,
            all_day: payload.all_day || false,
            status: payload.status || "confirmed"
          })
          .select("*")
          .single();

        if (error) throw error;
        resultData = data;
        break;
      }

      case "move_email_to_folder": {
        entityType = "email";
        if (!payload.email_id || !payload.folder_id) {
          return { success: false, message: "email_id and folder_id are required in payload." };
        }

        // Validate emails ownership
        const { data: email } = await db
          .from("emails")
          .select("id")
          .eq("id", payload.email_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!email) return { success: false, message: "Invalid or unauthorized email_id." };

        // Validate folder ownership
        const { data: folder } = await db
          .from("email_folders")
          .select("id")
          .eq("id", payload.folder_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!folder) return { success: false, message: "Invalid or unauthorized folder_id." };

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

      default: {
        return { success: false, message: `Unknown action type '${actionType}'` };
      }
    }

    // Write a real success trace in activity_logs
    await logActivity(`ai_tool_success:${actionType}`, entityType, resultData?.id || null, { agent_id: agentId, action_type: actionType, success: true, timestamp: new Date().toISOString() });

    // Update tool call log status to success dynamically
    if (toolCallId) {
      await db.from("ai_agent_tool_calls").update({
        status: "success",
        result: resultData || { success: true },
        resolved_at: new Date().toISOString()
      }).eq("id", toolCallId).catch(() => {});
    }

    return {
      success: true,
      message: `Successfully executed '${actionType}' on Neth Manager.`,
      data: resultData
    };

  } catch (err: any) {
    console.error(`Error in executor for tool ${actionType}:`, err);
    await logActivity(`ai_tool_error:${actionType}`, "ai_agent", null, { agent_id: agentId, error: err.message || String(err), timestamp: new Date().toISOString() });

    // Update tool call log status to failed dynamically
    if (toolCallId) {
      await db.from("ai_agent_tool_calls").update({
        status: "failed",
        error: err.message || String(err),
        resolved_at: new Date().toISOString()
      }).eq("id", toolCallId).catch(() => {});
    }

    return {
      success: false,
      message: `Tool failure on ${actionType}: ${err.message || String(err)}`
    };
  }
}
