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
    case "update_project_status":
    case "add_project_note":
      return "project";
    case "create_task":
      return "task";
    case "create_expense":
      return "expense";
    case "create_contact":
      return "phonebook_contact";
    case "link_email_to_project":
      return "email_project_link";
    case "create_calendar_event":
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
            error_message: failMsg
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
          error_message: failMsg
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

        const isGoogle = String(accountData.provider).toLowerCase() === "google";
        if (isGoogle) {
          try {
            const { data: fnData, error: fnErr } = await db.functions.invoke("google-calendar-create-event", {
              body: {
                calendar_account_id: calendarAccountId,
                title: payload.title,
                description: payload.description || null,
                location: payload.location || null,
                start_at: payload.start_at,
                end_at: payload.end_at,
                all_day: payload.all_day || false
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
        }
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
            caption: payload.caption || null,
            media_asset_ids: payload.media_asset_ids || null,
            status: payload.status || "draft",
            scheduled_at: payload.scheduled_at || null,
            published_at: payload.published_at || null,
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
        resultData = data;
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
        result: resultData || { success: true }
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
        error_message: err.message || String(err)
      }).eq("id", toolCallId).catch(() => {});
    }

    return {
      success: false,
      message: `Tool failure on ${actionType}: ${err.message || String(err)}`
    };
  }
}
