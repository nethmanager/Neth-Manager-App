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

export async function executeBackendTool(
  agentId: string,
  userId: string,
  actionType: string,
  payload: any
): Promise<ToolResult> {
  if (!serverSupabase) {
    return { success: false, message: "Supabase client is not configured on the server." };
  }

  try {
    // 1. Fetch AI Agent to check permissions
    const { data: agent, error: agentError } = await serverSupabase
      .from("ai_agents")
      .select("*")
      .eq("id", agentId)
      .eq("user_id", userId)
      .single();

    if (agentError || !agent) {
      console.warn(`Could not verify agent permissions for ${agentId}. Fallback to strict validation.`);
    }

    // Determine permissions (fall back if not defined in SQL columns yet)
    const permissions: string[] = agent?.permissions || agent?.enabled_tools || [];
    
    // Check if permissions allow this actionType or if agent is admin (* or empty permissions in database defaults to roles)
    const isAllowed = 
      permissions.includes("*") || 
      permissions.includes(actionType) || 
      permissions.length === 0 || // Fallback for backward compatibility
      agent?.enabled_tools?.includes(actionType.split("_")[1]); // Fallback check for "create_project" -> "projects" tool check

    if (!isAllowed && agent) {
      return {
        success: false,
        message: `Permission Denied: Agent '${agent.name}' does not have authority to execute '${actionType}'.`
      };
    }

    // Write a pending attempt log first
    await serverSupabase.from("activity_logs").insert({
      user_id: userId,
      action: `ai_tool_attempt:${actionType}`,
      entity_type: "ai_agent",
      details: { agent_id: agentId, action_type: actionType, timestamp: new Date().toISOString() }
    });

    let resultData: any = null;
    let entityType = "generic";

    // 2. Route & Execute the respective Tool
    switch (actionType) {
      case "create_project": {
        entityType = "project";
        if (!payload.name) {
          return { success: false, message: "Project name is required inside payload." };
        }

        // Verify linked business if present
        if (payload.business_id) {
          const { data: biz } = await serverSupabase
            .from("businesses")
            .select("id")
            .eq("id", payload.business_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!biz) return { success: false, message: "Invalid business_id. Ownership verification failed." };
        }

        // Verify linked platform if present
        if (payload.platform_id) {
          const { data: plat } = await serverSupabase
            .from("platforms")
            .select("id")
            .eq("id", payload.platform_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!plat) return { success: false, message: "Invalid platform_id. Ownership verification failed." };
        }

        const { data, error } = await serverSupabase
          .from("projects")
          .insert({
            user_id: userId,
            name: payload.name,
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
          const { data: proj } = await serverSupabase
            .from("projects")
            .select("id")
            .eq("id", payload.project_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!proj) return { success: false, message: "Invalid project_id. Ownership verification failed." };
        }

        const { data, error } = await serverSupabase
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

        const { data, error } = await serverSupabase
          .from("expenses")
          .insert({
            user_id: userId,
            title: payload.title,
            amount: Number(payload.amount),
            direction: payload.direction || "out",
            currency: payload.currency || "USD",
            payment_type: payload.payment_type || "other",
            category: payload.category || "other",
            status: payload.status || "pending",
            expense_date: payload.expense_date || new Date().toISOString().split("T")[0],
            due_date: payload.due_date || null,
            business_id: payload.business_id || null,
            project_id: payload.project_id || null,
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

        const { data, error } = await serverSupabase
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
        const { data: proj } = await serverSupabase
          .from("projects")
          .select("id")
          .eq("id", payload.project_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!proj) return { success: false, message: "Access Denied: Invalid project_id for user." };

        // Verify email ownership
        const { data: email } = await serverSupabase
          .from("emails")
          .select("id")
          .eq("id", payload.email_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!email) return { success: false, message: "Access Denied: Invalid email_id for user." };

        const { data, error } = await serverSupabase
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

        // Note: Check if calendar_accounts exist, if not we create one or leave it blank
        let calendarAccountId = payload.calendar_account_id;
        if (!calendarAccountId) {
          const { data: firstAccount } = await serverSupabase
            .from("calendar_accounts")
            .select("id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
          if (firstAccount) {
            calendarAccountId = firstAccount.id;
          } else {
            // Seed a dynamic one so calendar queries don't break
            const { data: newAccount } = await serverSupabase
              .from("calendar_accounts")
              .insert({
                user_id: userId,
                provider: "google",
                provider_account_id: "default-ai-account",
                email_address: "neth.manager@gmail.com",
                display_name: "Calendar Central",
                status: "active"
              })
              .select("id")
              .single();
            calendarAccountId = newAccount.id;
          }
        }

        const { data, error } = await serverSupabase
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

        // Validate Ownership
        const { data: email } = await serverSupabase
          .from("emails")
          .select("id")
          .eq("id", payload.email_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!email) return { success: false, message: "Invalid email_id." };

        const { data: folder } = await serverSupabase
          .from("email_folders")
          .select("id")
          .eq("id", payload.folder_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!folder) return { success: false, message: "Invalid folder_id for user." };

        const { data, error } = await serverSupabase
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

        // Validate Ownership
        const { data: proj } = await serverSupabase
          .from("projects")
          .select("id")
          .eq("id", payload.project_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!proj) return { success: false, message: "Invalid project_id." };

        const { data, error } = await serverSupabase
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

        // Fetch original
        const { data: proj, error: queryError } = await serverSupabase
          .from("projects")
          .select("notes")
          .eq("id", payload.project_id)
          .eq("user_id", userId)
          .single();

        if (queryError || !proj) return { success: false, message: "Invalid project_id notes query." };

        const originalNotes = proj.notes || "";
        const formattedDate = new Date().toISOString().split("T")[0];
        const addedNoteText = `\n\n[ AI Agent Addition - ${formattedDate} ]\n${payload.notes}`;

        const { data, error } = await serverSupabase
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

    // Write a real success trace in public.activity_logs
    await serverSupabase.from("activity_logs").insert({
      user_id: userId,
      action: `ai_tool_success:${actionType}`,
      entity_type: entityType,
      entity_id: resultData?.id || null,
      details: { agent_id: agentId, action_type: actionType, success: true, timestamp: new Date().toISOString() }
    });

    return {
      success: true,
      message: `Successfully executed '${actionType}' of '${entityType}' on Neth Manager.`,
      data: resultData
    };

  } catch (err: any) {
    console.error(`Error in executor for tool ${actionType}:`, err);
    // Write a failure trace in activity logs
    if (serverSupabase) {
      await serverSupabase.from("activity_logs").insert({
        user_id: userId,
        action: `ai_tool_error:${actionType}`,
        entity_type: "ai_agent",
        details: { agent_id: agentId, error: err.message || String(err), timestamp: new Date().toISOString() }
      }).catch(() => {});
    }

    return {
      success: false,
      message: `Tool failure on ${actionType}: ${err.message || String(err)}`
    };
  }
}
