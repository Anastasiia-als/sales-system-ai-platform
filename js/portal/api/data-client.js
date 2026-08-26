import { getSupabase } from "./supabase-client.js";
import { PortalAuth } from "../auth/auth-service.js";

/**
 * DataClient provides a clean, unified API for all persistent data operations
 * in the Client & Project Delivery Platform.
 * All UI components interact ONLY with this client, never making direct raw DB calls.
 */
export const DataClient = {
    // -------------------------------------------------------------------------
    // 1. Organizations (Tenant Scope)
    // -------------------------------------------------------------------------
    async getOrganizations(filter = {}) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        let query = supabase
            .from("organizations")
            .select(`
                *,
                responsible_pm:responsible_pm_id(id, full_name, email, avatar_url),
                contacts:contacts(id, first_name, last_name, position, email, phone, is_primary),
                projects:projects(id, title, name, status, health)
            `);

        if (filter.status && filter.status !== "all") {
            query = query.eq("status", filter.status);
        }
        if (filter.search) {
            query = query.ilike("name", `%${filter.search}%`);
        }

        return await query.order("created_at", { ascending: false });
    },

    async getOrganizationById(orgId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: null };

        return await supabase
            .from("organizations")
            .select(`
                *,
                responsible_pm:responsible_pm_id(id, full_name, email, avatar_url),
                contacts:contacts(*),
                projects:projects(
                    id, title, name, description, project_type, status, health, health_status, 
                    progress_percent, start_date, target_date, target_end_date, responsible_pm_id,
                    project_memberships(id, user_id, project_role, profiles(id, full_name, avatar_url))
                ),
                organization_memberships(id, user_id, org_role, profiles(id, full_name, email, avatar_url))
            `)
            .eq("id", orgId)
            .single();
    },

    async createOrganization(orgData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("organizations")
            .insert([orgData])
            .select()
            .single();
    },

    async updateOrganization(orgId, updateData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("organizations")
            .update(updateData)
            .eq("id", orgId)
            .select()
            .single();
    },

    // -------------------------------------------------------------------------
    // 2. Organization Contacts
    // -------------------------------------------------------------------------
    async getContactsByOrg(orgId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        return await supabase
            .from("contacts")
            .select("*")
            .eq("organization_id", orgId)
            .order("is_primary", { ascending: false })
            .order("created_at", { ascending: true });
    },

    async createContact(contactData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        // If marked primary, unset other primaries in same org
        if (contactData.is_primary) {
            await supabase
                .from("contacts")
                .update({ is_primary: false })
                .eq("organization_id", contactData.organization_id);
        }

        return await supabase
            .from("contacts")
            .insert([contactData])
            .select()
            .single();
    },

    async updateContact(contactId, updateData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        if (updateData.is_primary && updateData.organization_id) {
            await supabase
                .from("contacts")
                .update({ is_primary: false })
                .eq("organization_id", updateData.organization_id);
        }

        return await supabase
            .from("contacts")
            .update(updateData)
            .eq("id", contactId)
            .select()
            .single();
    },

    async deleteContact(contactId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("contacts")
            .delete()
            .eq("id", contactId);
    },

    // -------------------------------------------------------------------------
    // 3. Profiles / Staff List (For PM & Team assignments)
    // -------------------------------------------------------------------------
    async getStaffProfiles() {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        return await supabase
            .from("profiles")
            .select("id, full_name, email, avatar_url, global_role")
            .in("global_role", ["owner", "pm", "specialist"])
            .order("full_name", { ascending: true });
    },

    // -------------------------------------------------------------------------
    // 4. Projects (Canonical fields: name, health, target_date)
    // -------------------------------------------------------------------------
    async getProjects(filter = {}) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        let query = supabase
            .from("projects")
            .select(`
                *,
                organizations:organization_id(id, name, logo_url, status),
                responsible_pm:responsible_pm_id(id, full_name, email, avatar_url),
                project_memberships(
                    id, user_id, project_role, created_at,
                    profiles:user_id(id, full_name, email, avatar_url, global_role)
                ),
                project_stages(id, name, status, sort_order)
            `);

        if (filter.organizationId && filter.organizationId !== "all") {
            query = query.eq("organization_id", filter.organizationId);
        }
        if (filter.status && filter.status !== "all") {
            query = query.eq("status", filter.status);
        }
        if (filter.health && filter.health !== "all") {
            query = query.eq("health", filter.health);
        }
        if (filter.pmId && filter.pmId !== "all") {
            query = query.eq("responsible_pm_id", filter.pmId);
        }
        if (filter.search) {
            query = query.or(`name.ilike.%${filter.search}%,title.ilike.%${filter.search}%`);
        }

        return await query.order("created_at", { ascending: false });
    },

    async getProjectById(projectId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: null };

        return await supabase
            .from("projects")
            .select(`
                *,
                organizations:organization_id(id, name, legal_name, website, logo_url, status),
                responsible_pm:responsible_pm_id(id, full_name, email, avatar_url, global_role),
                project_memberships(
                    id, project_id, user_id, project_role, created_at,
                    profiles:user_id(id, full_name, email, avatar_url, phone, telegram, global_role)
                ),
                project_stages(
                    id, project_id, organization_id, name, description, status, sort_order, 
                    responsible_user_id, start_date, target_date, is_client_visible,
                    responsible_user:responsible_user_id(id, full_name, email, avatar_url, global_role),
                    milestones(id, stage_id, name, description, target_date, status, completed_at, is_client_visible, sort_order)
                )
            `)
            .eq("id", projectId)
            .single();
    },

    async createProject(projectData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        if (!projectData.organization_id) {
            return { data: null, error: new Error("Project must belong to an organization (organization_id is required)") };
        }

        const payload = {
            organization_id: projectData.organization_id,
            name: projectData.name || projectData.title,
            title: projectData.name || projectData.title,
            description: projectData.description || null,
            project_type: projectData.project_type || "custom",
            status: projectData.status || "draft",
            health: projectData.health || "on_track",
            health_status: projectData.health || "on_track",
            start_date: projectData.start_date || null,
            target_date: projectData.target_date || null,
            target_end_date: projectData.target_date || null,
            responsible_pm_id: projectData.responsible_pm_id || null,
            progress_percent: projectData.progress_percent || 0
        };

        const res = await supabase
            .from("projects")
            .insert([payload])
            .select(`
                *,
                organizations:organization_id(id, name, logo_url),
                responsible_pm:responsible_pm_id(id, full_name, email, avatar_url)
            `)
            .single();

        if (res.data && projectData.responsible_pm_id) {
            try {
                await supabase
                    .from("project_memberships")
                    .insert([{
                        project_id: res.data.id,
                        user_id: projectData.responsible_pm_id,
                        project_role: "pm"
                    }]);
            } catch (ignore) {}
        }

        return res;
    },

    async updateProject(projectId, updateData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const payload = { ...updateData };
        if (payload.name && !payload.title) payload.title = payload.name;
        if (payload.health && !payload.health_status) payload.health_status = payload.health;
        if (payload.target_date && !payload.target_end_date) payload.target_end_date = payload.target_date;

        const res = await supabase
            .from("projects")
            .update(payload)
            .eq("id", projectId)
            .select(`
                *,
                organizations:organization_id(id, name, logo_url),
                responsible_pm:responsible_pm_id(id, full_name, email, avatar_url)
            `)
            .single();

        if (res.data && payload.responsible_pm_id) {
            try {
                const { data: existing } = await supabase
                    .from("project_memberships")
                    .select("id")
                    .eq("project_id", projectId)
                    .eq("user_id", payload.responsible_pm_id)
                    .maybeSingle();

                if (!existing) {
                    await supabase
                        .from("project_memberships")
                        .insert([{
                            project_id: projectId,
                            user_id: payload.responsible_pm_id,
                            project_role: "pm"
                        }]);
                }
            } catch (ignore) {}
        }

        return res;
    },

    async deleteProject(projectId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("projects")
            .delete()
            .eq("id", projectId);
    },

    // -------------------------------------------------------------------------
    // 5. Project Memberships
    // -------------------------------------------------------------------------
    async getProjectMembers(projectId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        return await supabase
            .from("project_memberships")
            .select(`
                id, project_id, user_id, project_role, created_at,
                profiles:user_id(id, full_name, email, avatar_url, phone, telegram, global_role)
            `)
            .eq("project_id", projectId)
            .order("created_at", { ascending: true });
    },

    async addProjectMember(projectId, userId, projectRole = "specialist") {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("project_memberships")
            .insert([{
                project_id: projectId,
                user_id: userId,
                project_role: projectRole
            }])
            .select(`
                id, project_id, user_id, project_role, created_at,
                profiles:user_id(id, full_name, email, avatar_url, global_role)
            `)
            .single();
    },

    async updateProjectMemberRole(membershipId, projectRole) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("project_memberships")
            .update({ project_role: projectRole })
            .eq("id", membershipId)
            .select(`
                id, project_id, user_id, project_role, created_at,
                profiles:user_id(id, full_name, email, avatar_url, global_role)
            `)
            .single();
    },

    async removeProjectMember(membershipId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("project_memberships")
            .delete()
            .eq("id", membershipId);
    },

    // -------------------------------------------------------------------------
    // 6. Roadmap: Project Stages & Milestones (Phase 2A)
    // -------------------------------------------------------------------------
    async getProjectRoadmap(projectId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        const { data: stages, error } = await supabase
            .from("project_stages")
            .select(`
                *,
                responsible_user:responsible_user_id(id, full_name, email, avatar_url, global_role),
                milestones(
                    id, stage_id, project_id, organization_id, name, description, 
                    target_date, status, completed_at, is_client_visible, sort_order, created_at
                ),
                tasks:tasks(
                    id, stage_id, title, status, priority, responsibility_type, is_client_visible
                )
            `)
            .eq("project_id", projectId)
            .order("sort_order", { ascending: true });

        if (error || !stages) return { data: [], error };

        // Sort nested milestones by sort_order
        stages.forEach(stage => {
            if (stage.milestones && Array.isArray(stage.milestones)) {
                stage.milestones.sort((a, b) => a.sort_order - b.sort_order);
            } else {
                stage.milestones = [];
            }
        });

        return { data: stages, error: null };
    },

    async createProjectStage(stageData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        // Determine sort order if not provided
        let sort_order = stageData.sort_order;
        if (sort_order === undefined || sort_order === null) {
            const { data: existing } = await supabase
                .from("project_stages")
                .select("sort_order")
                .eq("project_id", stageData.project_id)
                .order("sort_order", { ascending: false })
                .limit(1);

            sort_order = existing && existing.length > 0 ? existing[0].sort_order + 10 : 10;
        }

        const payload = {
            project_id: stageData.project_id,
            organization_id: stageData.organization_id,
            name: stageData.name,
            description: stageData.description || null,
            status: stageData.status || "not_started",
            sort_order,
            responsible_user_id: stageData.responsible_user_id || null,
            start_date: stageData.start_date || null,
            target_date: stageData.target_date || null,
            is_client_visible: stageData.is_client_visible !== false
        };

        return await supabase
            .from("project_stages")
            .insert([payload])
            .select(`
                *,
                responsible_user:responsible_user_id(id, full_name, email, avatar_url)
            `)
            .single();
    },

    async updateProjectStage(stageId, updateData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("project_stages")
            .update(updateData)
            .eq("id", stageId)
            .select(`
                *,
                responsible_user:responsible_user_id(id, full_name, email, avatar_url)
            `)
            .single();
    },

    async deleteProjectStage(stageId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("project_stages")
            .delete()
            .eq("id", stageId);
    },

    async reorderProjectStages(projectId, orderedStageIds) {
        const supabase = await getSupabase();
        if (!supabase) return { error: new Error("Database not connected") };

        const updates = orderedStageIds.map((id, index) => {
            return supabase
                .from("project_stages")
                .update({ sort_order: (index + 1) * 10 })
                .eq("id", id)
                .eq("project_id", projectId);
        });

        const results = await Promise.all(updates);
        const firstError = results.find(r => r.error);
        return { error: firstError ? firstError.error : null };
    },

    async createMilestone(milestoneData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        // Determine sort order
        let sort_order = milestoneData.sort_order;
        if (sort_order === undefined || sort_order === null) {
            const { data: existing } = await supabase
                .from("milestones")
                .select("sort_order")
                .eq("stage_id", milestoneData.stage_id)
                .order("sort_order", { ascending: false })
                .limit(1);

            sort_order = existing && existing.length > 0 ? existing[0].sort_order + 10 : 10;
        }

        const payload = {
            stage_id: milestoneData.stage_id,
            project_id: milestoneData.project_id,
            organization_id: milestoneData.organization_id,
            name: milestoneData.name,
            description: milestoneData.description || null,
            target_date: milestoneData.target_date || null,
            status: milestoneData.status || "pending",
            is_client_visible: milestoneData.is_client_visible !== false,
            sort_order
        };

        return await supabase
            .from("milestones")
            .insert([payload])
            .select()
            .single();
    },

    async updateMilestone(milestoneId, updateData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("milestones")
            .update(updateData)
            .eq("id", milestoneId)
            .select()
            .single();
    },

    async toggleMilestoneStatus(milestoneId, newStatus) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("milestones")
            .update({ status: newStatus })
            .eq("id", milestoneId)
            .select()
            .single();
    },

    async deleteMilestone(milestoneId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("milestones")
            .delete()
            .eq("id", milestoneId);
    },

    // -------------------------------------------------------------------------
    // 7. Tasks & Task Dependencies (Phase 2B)
    // -------------------------------------------------------------------------
    async getTasks(filter = {}) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        let query = supabase
            .from("tasks")
            .select(`
                *,
                stage:stage_id(id, name, status),
                milestone:milestone_id(id, name, status),
                assignee:assignee_user_id(id, full_name, email, avatar_url, global_role),
                client_contact:client_contact_id(id, first_name, last_name, email, phone, position),
                project:project_id(id, name, title)
            `);

        if (filter.projectId && filter.projectId !== "all") {
            query = query.eq("project_id", filter.projectId);
        }
        if (filter.organizationId && filter.organizationId !== "all") {
            query = query.eq("organization_id", filter.organizationId);
        }
        if (filter.stageId && filter.stageId !== "all") {
            query = query.eq("stage_id", filter.stageId);
        }
        if (filter.status && filter.status !== "all") {
            query = query.eq("status", filter.status);
        }
        if (filter.priority && filter.priority !== "all") {
            query = query.eq("priority", filter.priority);
        }
        if (filter.responsibilityType && filter.responsibilityType !== "all") {
            query = query.eq("responsibility_type", filter.responsibilityType);
        }
        if (filter.assigneeUserId && filter.assigneeUserId !== "all") {
            query = query.eq("assignee_user_id", filter.assigneeUserId);
        }
        if (filter.search) {
            query = query.ilike("title", `%${filter.search}%`);
        }

        return await query.order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    },

    async getTaskById(taskId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: null };

        return await supabase
            .from("tasks")
            .select(`
                *,
                stage:stage_id(id, name, status),
                milestone:milestone_id(id, name, status),
                assignee:assignee_user_id(id, full_name, email, avatar_url, global_role),
                client_contact:client_contact_id(id, first_name, last_name, email, phone, position),
                project:project_id(id, name, title, organization_id),
                created_by_profile:created_by(id, full_name, email)
            `)
            .eq("id", taskId)
            .single();
    },

    async createTask(taskData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const payload = {
            project_id: taskData.project_id,
            organization_id: taskData.organization_id,
            stage_id: taskData.stage_id || null,
            milestone_id: taskData.milestone_id || null,
            title: taskData.title,
            description: taskData.description || null,
            status: taskData.status || "backlog",
            priority: taskData.priority || "medium",
            assignee_user_id: taskData.responsibility_type === "client" ? null : (taskData.assignee_user_id || null),
            responsibility_type: taskData.responsibility_type || "internal",
            client_contact_id: taskData.responsibility_type === "client" ? (taskData.client_contact_id || null) : null,
            start_date: taskData.start_date || null,
            due_date: taskData.due_date || null,
            is_client_visible: taskData.responsibility_type === "client" ? true : Boolean(taskData.is_client_visible),
            created_by: taskData.created_by || null,
            sort_order: taskData.sort_order || 0
        };

        return await supabase
            .from("tasks")
            .insert([payload])
            .select(`
                *,
                stage:stage_id(id, name),
                milestone:milestone_id(id, name),
                assignee:assignee_user_id(id, full_name, email, avatar_url),
                client_contact:client_contact_id(id, first_name, last_name, email)
            `)
            .single();
    },

    async updateTask(taskId, updateData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const payload = { ...updateData };
        if (payload.responsibility_type === "client") {
            payload.is_client_visible = true;
            payload.assignee_user_id = null;
        } else if (payload.responsibility_type === "internal") {
            payload.client_contact_id = null;
        }

        return await supabase
            .from("tasks")
            .update(payload)
            .eq("id", taskId)
            .select(`
                *,
                stage:stage_id(id, name),
                milestone:milestone_id(id, name),
                assignee:assignee_user_id(id, full_name, email, avatar_url),
                client_contact:client_contact_id(id, first_name, last_name, email)
            `)
            .single();
    },

    async toggleTaskStatus(taskId, newStatus) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("tasks")
            .update({ status: newStatus })
            .eq("id", taskId)
            .select()
            .single();
    },

    async deleteTask(taskId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("tasks")
            .delete()
            .eq("id", taskId);
    },

    async getMyTasks(userId, filter = {}) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        let query = supabase
            .from("tasks")
            .select(`
                *,
                stage:stage_id(id, name),
                milestone:milestone_id(id, name),
                assignee:assignee_user_id(id, full_name, email, avatar_url),
                project:project_id(id, name, title, organization_id, organizations:organization_id(id, name))
            `)
            .eq("assignee_user_id", userId);

        if (filter.status && filter.status !== "all") {
            query = query.eq("status", filter.status);
        }
        if (filter.priority && filter.priority !== "all") {
            query = query.eq("priority", filter.priority);
        }
        if (filter.search) {
            query = query.ilike("title", `%${filter.search}%`);
        }

        return await query.order("due_date", { ascending: true, nullsFirst: false });
    },

    async getTaskDependencies(projectId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        return await supabase
            .from("task_dependencies")
            .select(`
                id, task_id, depends_on_task_id, project_id, organization_id, created_at,
                task:task_id(id, title, status),
                depends_on_task:depends_on_task_id(id, title, status)
            `)
            .eq("project_id", projectId);
    },

    async addTaskDependency(taskId, dependsOnTaskId, projectId, organizationId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("task_dependencies")
            .insert([{
                task_id: taskId,
                depends_on_task_id: dependsOnTaskId,
                project_id: projectId,
                organization_id: organizationId
            }])
            .select()
            .single();
    },

    async removeTaskDependency(dependencyId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("task_dependencies")
            .delete()
            .eq("id", dependencyId);
    },

    async getProjectTasksMetrics(projectId) {
        const { data: tasks, error } = await this.getTasks({ projectId });
        if (error || !tasks) {
            return {
                total: 0,
                open: 0,
                overdue: 0,
                completed: 0,
                waitingClient: 0,
                nextDeadline: null
            };
        }

        const now = new Date().setHours(0, 0, 0, 0);
        let open = 0;
        let overdue = 0;
        let completed = 0;
        let waitingClient = 0;
        const upcomingDeadlines = [];

        tasks.forEach(t => {
            if (t.status === "done") {
                completed++;
            } else {
                open++;
                if (t.status === "waiting_client" || t.responsibility_type === "client") {
                    waitingClient++;
                }
                if (t.due_date) {
                    const d = new Date(t.due_date).getTime();
                    if (d < now) {
                        overdue++;
                    } else {
                        upcomingDeadlines.push({ title: t.title, due_date: t.due_date });
                    }
                }
            }
        });

        upcomingDeadlines.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

        return {
            total: tasks.length,
            open,
            overdue,
            completed,
            waitingClient,
            nextDeadline: upcomingDeadlines[0] || null
        };
    },

    // -------------------------------------------------------------------------
    // 7. Documents & File Storage (Phase 3A)
    // -------------------------------------------------------------------------
    async getDocuments(filter = {}) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        let query = supabase
            .from("documents")
            .select(`
                *,
                organization:organization_id(id, name, slug),
                project:project_id(id, name, title, status),
                stage:stage_id(id, name, status),
                owner:owner_user_id(id, full_name, email, avatar_url),
                creator:created_by(id, full_name, email),
                versions:document_versions(
                    id, document_id, version_number, storage_path, original_filename,
                    mime_type, size_bytes, uploaded_by, change_note, created_at,
                    uploader:uploaded_by(id, full_name, email)
                )
            `);

        if (filter.projectId) {
            query = query.eq("project_id", filter.projectId);
        }
        if (filter.organizationId) {
            query = query.eq("organization_id", filter.organizationId);
        }
        if (filter.category && filter.category !== "all") {
            query = query.eq("category", filter.category);
        }
        if (filter.status && filter.status !== "all") {
            query = query.eq("status", filter.status);
        }
        if (filter.internalAccessScope && filter.internalAccessScope !== "all") {
            query = query.eq("internal_access_scope", filter.internalAccessScope);
        }
        if (filter.search) {
            query = query.ilike("title", `%${filter.search}%`);
        }

        // Active vs Archived filter
        if (filter.includeArchived === true) {
            if (filter.onlyArchived === true) {
                query = query.not("archived_at", "is", null);
            }
        } else {
            query = query.is("archived_at", null);
        }

        const res = await query.order("updated_at", { ascending: false });
        if (res.data) {
            res.data.forEach(doc => {
                if (doc.versions && doc.versions.length > 0) {
                    doc.versions.sort((a, b) => b.version_number - a.version_number);
                    doc.latest_version = doc.versions[0];
                } else {
                    doc.latest_version = null;
                }
            });
        }
        return res;
    },

    async getDocumentById(docId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: null };

        const res = await supabase
            .from("documents")
            .select(`
                *,
                organization:organization_id(id, name, slug),
                project:project_id(id, name, title, status, responsible_pm_id),
                stage:stage_id(id, name, status),
                owner:owner_user_id(id, full_name, email, avatar_url),
                creator:created_by(id, full_name, email),
                versions:document_versions(
                    id, document_id, version_number, storage_path, original_filename,
                    mime_type, size_bytes, uploaded_by, change_note, is_client_visible,
                    published_to_client_at, published_by, created_at,
                    uploader:uploaded_by(id, full_name, email)
                )
            `)
            .eq("id", docId)
            .single();

        if (res.data) {
            if (res.data.versions && res.data.versions.length > 0) {
                res.data.versions.sort((a, b) => b.version_number - a.version_number);
                res.data.latest_version = res.data.versions[0];
            } else {
                res.data.latest_version = null;
            }
        }
        return res;
    },

    async createDocument(docData, initialFile = null, changeNote = "") {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const docId = crypto.randomUUID();
        const docRecord = {
            id: docId,
            organization_id: docData.organization_id,
            project_id: docData.project_id,
            stage_id: docData.stage_id || null,
            title: docData.title,
            description: docData.description || null,
            category: docData.category,
            status: docData.status || "draft",
            owner_user_id: docData.owner_user_id || null,
            internal_access_scope: docData.internal_access_scope || "project_team",
            is_client_visible: docData.internal_access_scope === "management" ? false : Boolean(docData.is_client_visible),
            created_by: docData.created_by || null
        };

        const { data: createdDoc, error: docError } = await supabase
            .from("documents")
            .insert([docRecord])
            .select()
            .single();

        if (docError) {
            return { data: null, error: docError };
        }

        if (initialFile) {
            const versionRes = await this.uploadDocumentVersion(
                createdDoc.id,
                initialFile,
                changeNote || "Початкова версія документа",
                1,
                createdDoc.organization_id,
                createdDoc.project_id
            );

            if (versionRes.error) {
                console.error("Failed to upload initial version for document:", versionRes.error);
                return { 
                    data: createdDoc, 
                    error: null, 
                    warning: `Документ створено, але не вдалося завантажити файл: ${versionRes.error.message}` 
                };
            }
        }

        return await this.getDocumentById(createdDoc.id);
    },

    async updateDocument(docId, updateData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        if (updateData.internal_access_scope === "management") {
            updateData.is_client_visible = false;
        }

        return await supabase
            .from("documents")
            .update(updateData)
            .eq("id", docId)
            .select()
            .single();
    },

    async archiveDocument(docId, isArchived = true) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("documents")
            .update({ archived_at: isArchived ? new Date().toISOString() : null })
            .eq("id", docId)
            .select()
            .single();
    },

    async uploadDocumentVersion(docId, file, changeNote = "", forcedVersionNumber = null, orgId = null, projId = null) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        if (!file || file.size === 0) {
            return { data: null, error: new Error("Файл порожній або не вибраний") };
        }
        const MAX_BYTES = 50 * 1024 * 1024; // 50MB
        if (file.size > MAX_BYTES) {
            return { data: null, error: new Error("Розмір файлу перевищує ліміт 50 МБ") };
        }

        let organizationId = orgId;
        let projectId = projId;
        if (!organizationId || !projectId) {
            const { data: doc, error: docErr } = await supabase
                .from("documents")
                .select("organization_id, project_id")
                .eq("id", docId)
                .single();

            if (docErr || !doc) {
                return { data: null, error: docErr || new Error("Документ не знайдено") };
            }
            organizationId = doc.organization_id;
            projectId = doc.project_id;
        }

        let nextVer = forcedVersionNumber;
        if (!nextVer) {
            const { data: existingVers } = await supabase
                .from("document_versions")
                .select("version_number")
                .eq("document_id", docId)
                .order("version_number", { ascending: false })
                .limit(1);

            nextVer = (existingVers && existingVers[0]?.version_number ? existingVers[0].version_number : 0) + 1;
        }

        const safeOriginalName = file.name.replace(/[^\w.-]/gi, "_");
        const storagePath = `${organizationId}/${projectId}/${docId}/v${nextVer}_${safeOriginalName}`;

        const { error: uploadError } = await supabase.storage
            .from("project-documents")
            .upload(storagePath, file, {
                cacheControl: "3600",
                upsert: false
            });

        if (uploadError) {
            return { data: null, error: uploadError };
        }

        const sessionRes = await supabase.auth.getSession();
        const currentUserId = sessionRes?.data?.session?.user?.id || null;

        const versionRecord = {
            document_id: docId,
            organization_id: organizationId,
            project_id: projectId,
            version_number: nextVer,
            storage_path: storagePath,
            original_filename: file.name,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            uploaded_by: currentUserId,
            change_note: changeNote || null
        };

        const { data: createdVersion, error: dbError } = await supabase
            .from("document_versions")
            .insert([versionRecord])
            .select(`
                *,
                uploader:uploaded_by(id, full_name, email)
            `)
            .single();

        if (dbError) {
            console.error("DB insert failed, rolling back uploaded storage file:", storagePath);
            await supabase.storage.from("project-documents").remove([storagePath]);
            return { data: null, error: dbError };
        }

        return { data: createdVersion, error: null };
    },

    async getDocumentDownloadUrl(storagePath, expiresInSeconds = 300) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const { data, error } = await supabase.storage
            .from("project-documents")
            .createSignedUrl(storagePath, expiresInSeconds);

        if (error || !data?.signedUrl) {
            return { data: null, error: error || new Error("Не вдалося сформувати посилання для завантаження") };
        }

        return { data: data.signedUrl, error: null };
    },

    async downloadDocumentFile(storagePath, originalFilename) {
        const { data: signedUrl, error } = await this.getDocumentDownloadUrl(storagePath);
        if (error || !signedUrl) {
            throw error || new Error("Не вдалося отримати посилання на файл");
        }

        const link = document.createElement("a");
        link.href = signedUrl;
        link.download = originalFilename || "document";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // -------------------------------------------------------------------------
    // 9. Meetings & Recurring Series (Phase 3B)
    // -------------------------------------------------------------------------
    async getMeetings(filter = {}) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        let query = supabase
            .from("meetings")
            .select(`
                *,
                organization:organization_id(id, name, slug),
                project:project_id(id, title, name, status),
                organizer:organizer_user_id(id, full_name, email, avatar_url),
                recurrence_series:recurrence_series_id(id, frequency, interval),
                participants:meeting_participants(
                    id, participant_type, user_id, contact_id, attendance_status,
                    user:user_id(id, full_name, email, avatar_url),
                    contact:contact_id(id, first_name, last_name, position, email, phone)
                )
            `);

        if (filter.organizationId) {
            query = query.eq("organization_id", filter.organizationId);
        }
        if (filter.projectId) {
            query = query.eq("project_id", filter.projectId);
        }
        if (filter.meetingType && filter.meetingType !== "all") {
            query = query.eq("meeting_type", filter.meetingType);
        }
        if (filter.status && filter.status !== "all") {
            if (filter.status === "upcoming") {
                query = query.eq("status", "scheduled");
            } else if (filter.status === "completed") {
                query = query.eq("status", "completed");
            } else if (filter.status === "cancelled") {
                query = query.eq("status", "cancelled");
            } else {
                query = query.eq("status", filter.status);
            }
        }
        if (filter.search) {
            query = query.ilike("title", `%${filter.search}%`);
        }

        const isAscending = filter.status === "upcoming" || filter.status === "scheduled";
        return await query.order("start_at", { ascending: isAscending });
    },

    async getMeetingById(meetingId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: null };

        const res = await supabase
            .from("meetings")
            .select(`
                *,
                organization:organization_id(id, name, slug, timezone),
                project:project_id(id, title, name, status),
                organizer:organizer_user_id(id, full_name, email, avatar_url),
                recurrence_series:recurrence_series_id(*),
                participants:meeting_participants(
                    id, participant_type, user_id, contact_id, attendance_status, created_at,
                    user:user_id(id, full_name, email, avatar_url),
                    contact:contact_id(id, first_name, last_name, position, email, phone)
                ),
                notes:meeting_notes(
                    id, note_type, body, is_client_visible, created_at, created_by,
                    author:created_by(id, full_name, email, avatar_url)
                ),
                decisions:meeting_decisions(
                    id, decision_text, sort_order, is_client_visible, created_at, created_by,
                    author:created_by(id, full_name, email, avatar_url)
                ),
                documents:meeting_documents(
                    id, document_id, relation_type, created_at,
                    document:document_id(
                        id, title, category, status,
                        latest_versions:document_versions(id, version_number, storage_path, original_filename, size_bytes)
                    )
                ),
                action_items:tasks(
                    id, title, description, status, priority, responsibility_type,
                    assignee_user_id, client_contact_id, due_date, is_client_visible, completed_at,
                    assignee:assignee_user_id(id, full_name, email, avatar_url),
                    client_contact:client_contact_id(id, first_name, last_name, position, email)
                )
            `)
            .eq("id", meetingId)
            .single();

        if (res.data) {
            // Sort notes & decisions
            if (res.data.notes) {
                res.data.notes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            }
            if (res.data.decisions) {
                res.data.decisions.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || new Date(a.created_at) - new Date(b.created_at));
            }
            if (res.data.action_items) {
                res.data.action_items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
        }

        return res;
    },

    async createMeeting(meetingData, participants = []) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const sessionRes = await supabase.auth.getSession();
        const currentUserId = sessionRes?.data?.session?.user?.id || null;

        const payload = {
            ...meetingData,
            created_by: currentUserId
        };

        const { data: meeting, error: meetError } = await supabase
            .from("meetings")
            .insert([payload])
            .select()
            .single();

        if (meetError || !meeting) {
            return { data: null, error: meetError };
        }

        // Insert participants if any
        if (participants && participants.length > 0) {
            const participantRows = participants.map(p => ({
                meeting_id: meeting.id,
                organization_id: meeting.organization_id,
                project_id: meeting.project_id,
                participant_type: p.participant_type,
                user_id: p.user_id || null,
                contact_id: p.contact_id || null,
                attendance_status: p.attendance_status || "invited"
            }));

            const { error: partError } = await supabase
                .from("meeting_participants")
                .insert(participantRows);

            if (partError) {
                console.warn("Could not insert some participants:", partError);
            }
        }

        return { data: meeting, error: null };
    },

    async createMeetingSeries(seriesData, occurrencesCount = 4, participants = []) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const sessionRes = await supabase.auth.getSession();
        const currentUserId = sessionRes?.data?.session?.user?.id || null;

        const seriesPayload = {
            ...seriesData,
            created_by: currentUserId
        };

        const { data: series, error: seriesError } = await supabase
            .from("meeting_series")
            .insert([seriesPayload])
            .select()
            .single();

        if (seriesError || !series) {
            return { data: null, error: seriesError };
        }

        // Generate bounded occurrences
        const occurrences = [];
        const baseDate = new Date(series.start_date + "T" + (series.start_time.length === 5 ? series.start_time + ":00" : series.start_time));
        const durationMinutes = series.duration_minutes || 60;
        const count = Math.min(Math.max(occurrencesCount, 1), 12); // Bound between 1 and 12

        for (let i = 0; i < count; i++) {
            const occStart = new Date(baseDate);
            if (series.frequency === "weekly") {
                occStart.setDate(baseDate.getDate() + i * 7 * (series.interval || 1));
            } else if (series.frequency === "biweekly") {
                occStart.setDate(baseDate.getDate() + i * 14 * (series.interval || 1));
            } else if (series.frequency === "monthly") {
                occStart.setMonth(baseDate.getMonth() + i * (series.interval || 1));
            }

            // Check if beyond end_date
            if (series.end_date) {
                const endDateObj = new Date(series.end_date + "T23:59:59");
                if (occStart > endDateObj) break;
            }

            const occEnd = new Date(occStart.getTime() + durationMinutes * 60 * 1000);

            occurrences.push({
                organization_id: series.organization_id,
                project_id: series.project_id,
                title: series.title + (count > 1 ? ` (Синхронізація #${i + 1})` : ""),
                meeting_type: series.meeting_type,
                status: "scheduled",
                start_at: occStart.toISOString(),
                end_at: occEnd.toISOString(),
                timezone: series.timezone || "Europe/Kyiv",
                location_type: series.location_type || "online",
                meeting_url: series.meeting_url || null,
                location_text: series.location_text || null,
                agenda: series.agenda || null,
                organizer_user_id: currentUserId,
                is_client_visible: series.is_client_visible ?? true,
                recurrence_series_id: series.id,
                created_by: currentUserId
            });
        }

        const { data: createdMeetings, error: occError } = await supabase
            .from("meetings")
            .insert(occurrences)
            .select();

        if (occError) {
            return { data: { series, meetings: [] }, error: occError };
        }

        // Add participants to all occurrences
        if (participants && participants.length > 0 && createdMeetings) {
            const allParticipants = [];
            for (const m of createdMeetings) {
                for (const p of participants) {
                    allParticipants.push({
                        meeting_id: m.id,
                        organization_id: m.organization_id,
                        project_id: m.project_id,
                        participant_type: p.participant_type,
                        user_id: p.user_id || null,
                        contact_id: p.contact_id || null,
                        attendance_status: p.attendance_status || "invited"
                    });
                }
            }
            if (allParticipants.length > 0) {
                await supabase.from("meeting_participants").insert(allParticipants);
            }
        }

        return { data: { series, meetings: createdMeetings }, error: null };
    },

    async updateMeeting(meetingId, updateData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("meetings")
            .update(updateData)
            .eq("id", meetingId)
            .select()
            .single();
    },

    async cancelMeeting(meetingId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("meetings")
            .update({
                status: "cancelled",
                cancelled_at: new Date().toISOString()
            })
            .eq("id", meetingId)
            .select()
            .single();
    },

    async completeMeeting(meetingId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("meetings")
            .update({
                status: "completed"
            })
            .eq("id", meetingId)
            .select()
            .single();
    },

    // Meeting Participants
    async addMeetingParticipant(meetingId, participantData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("meeting_participants")
            .insert([{
                meeting_id: meetingId,
                ...participantData
            }])
            .select(`
                *,
                user:user_id(id, full_name, email, avatar_url),
                contact:contact_id(id, first_name, last_name, position, email, phone)
            `)
            .single();
    },

    async removeMeetingParticipant(participantId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("meeting_participants")
            .delete()
            .eq("id", participantId);
    },

    async updateMeetingParticipantAttendance(participantId, attendanceStatus) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("meeting_participants")
            .update({ attendance_status: attendanceStatus })
            .eq("id", participantId)
            .select()
            .single();
    },

    // Meeting Notes
    async createMeetingNote(noteData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const sessionRes = await supabase.auth.getSession();
        const currentUserId = sessionRes?.data?.session?.user?.id || null;

        return await supabase
            .from("meeting_notes")
            .insert([{
                ...noteData,
                created_by: currentUserId
            }])
            .select(`
                *,
                author:created_by(id, full_name, email, avatar_url)
            `)
            .single();
    },

    async updateMeetingNote(noteId, updateData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("meeting_notes")
            .update(updateData)
            .eq("id", noteId)
            .select(`
                *,
                author:created_by(id, full_name, email, avatar_url)
            `)
            .single();
    },

    async deleteMeetingNote(noteId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("meeting_notes")
            .delete()
            .eq("id", noteId);
    },

    // Meeting Decisions
    async createMeetingDecision(decisionData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const sessionRes = await supabase.auth.getSession();
        const currentUserId = sessionRes?.data?.session?.user?.id || null;

        return await supabase
            .from("meeting_decisions")
            .insert([{
                ...decisionData,
                created_by: currentUserId
            }])
            .select(`
                *,
                author:created_by(id, full_name, email, avatar_url)
            `)
            .single();
    },

    async updateMeetingDecision(decisionId, updateData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("meeting_decisions")
            .update(updateData)
            .eq("id", decisionId)
            .select(`
                *,
                author:created_by(id, full_name, email, avatar_url)
            `)
            .single();
    },

    async deleteMeetingDecision(decisionId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("meeting_decisions")
            .delete()
            .eq("id", decisionId);
    },

    // Meeting -> Task / Action Item
    async createTaskFromMeeting(meetingId, taskData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const isClient = taskData.responsibility_type === "client";
        const taskPayload = {
            ...taskData,
            source_meeting_id: meetingId,
            responsibility_type: isClient ? "client" : "internal",
            is_client_visible: isClient ? true : (taskData.is_client_visible ?? false),
            client_contact_id: isClient ? taskData.client_contact_id : null,
            assignee_user_id: isClient ? null : taskData.assignee_user_id
        };

        return await this.createTask(taskPayload);
    },

    // Meeting Documents
    async linkDocumentToMeeting(meetingId, documentId, relationType = "material") {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const { data: meeting } = await supabase
            .from("meetings")
            .select("organization_id, project_id")
            .eq("id", meetingId)
            .single();

        if (!meeting) return { data: null, error: new Error("Meeting not found") };

        return await supabase
            .from("meeting_documents")
            .insert([{
                meeting_id: meetingId,
                document_id: documentId,
                organization_id: meeting.organization_id,
                project_id: meeting.project_id,
                relation_type: relationType
            }])
            .select(`
                *,
                document:document_id(
                    id, title, category, status,
                    latest_versions:document_versions(id, version_number, storage_path, original_filename, size_bytes)
                )
            `)
            .single();
    },

    async unlinkDocumentFromMeeting(meetingDocId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("meeting_documents")
            .delete()
            .eq("id", meetingDocId);
    },

    // Next Meeting Helpers
    async getNextMeetingForProject(projectId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: null };

        const nowIso = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // current or started within 30 min

        return await supabase
            .from("meetings")
            .select(`
                id, title, meeting_type, status, start_at, end_at, timezone, location_type, meeting_url,
                organizer:organizer_user_id(id, full_name, email, avatar_url),
                participants:meeting_participants(
                    id, participant_type, user_id, contact_id,
                    user:user_id(id, full_name, email),
                    contact:contact_id(id, first_name, last_name, position)
                )
            `)
            .eq("project_id", projectId)
            .eq("status", "scheduled")
            .gte("start_at", nowIso)
            .order("start_at", { ascending: true })
            .limit(1)
            .maybeSingle();
    },

    async getNextMeetingForClient(orgId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: null };

        const nowIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        return await supabase
            .from("meetings")
            .select(`
                id, title, meeting_type, status, start_at, end_at, timezone, location_type, meeting_url, project_id,
                project:project_id(id, title, name),
                organizer:organizer_user_id(id, full_name, email, avatar_url),
                participants:meeting_participants(
                    id, participant_type, user_id, contact_id,
                    user:user_id(id, full_name, email),
                    contact:contact_id(id, first_name, last_name, position)
                )
            `)
            .eq("organization_id", orgId)
            .eq("status", "scheduled")
            .gte("start_at", nowIso)
            .order("start_at", { ascending: true })
            .limit(1)
            .maybeSingle();
    },

    // -------------------------------------------------------------------------
    // 8. Client Portal Access & Invitations (Phase 4A)
    // -------------------------------------------------------------------------
    async getClientPortalAccessByContact(contactId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: null };

        return await supabase
            .from("client_portal_access")
            .select(`
                *,
                user:user_id(id, email, full_name, avatar_url),
                invited_by_profile:invited_by(id, full_name, email)
            `)
            .eq("contact_id", contactId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
    },

    async getClientPortalAccessByOrg(orgId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        return await supabase
            .from("client_portal_access")
            .select(`
                *,
                contact:contact_id(*),
                user:user_id(id, email, full_name, avatar_url)
            `)
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false });
    },

    async inviteClientContact({ organizationId, contactId, projectIds = [] }) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const appOrigin = typeof window !== "undefined" ? window.location.origin : "https://firstwin.io";
        const { data, error } = await supabase.functions.invoke("client-access-admin", {
            body: {
                action: "invite",
                organizationId,
                contactId,
                projectIds,
                appOrigin
            }
        });

        if (error) {
            return { data: null, error: new Error(error.message || "Не вдалося надіслати запрошення") };
        }
        if (data?.error) {
            return { data: null, error: new Error(data.error) };
        }
        return { data: data?.access, error: null };
    },

    async resendClientInvite(accessId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const appOrigin = typeof window !== "undefined" ? window.location.origin : "https://firstwin.io";
        const { data, error } = await supabase.functions.invoke("client-access-admin", {
            body: {
                action: "resend",
                accessId,
                appOrigin
            }
        });

        if (error) {
            return { data: null, error: new Error(error.message || "Не вдалося повторно надіслати запрошення") };
        }
        if (data?.error) {
            return { data: null, error: new Error(data.error) };
        }
        return { data: data?.access, error: null };
    },

    async updateClientProjects(accessId, projectIds) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const { data, error } = await supabase.functions.invoke("client-access-admin", {
            body: {
                action: "update_projects",
                accessId,
                projectIds
            }
        });

        if (error) {
            return { data: null, error: new Error(error.message || "Не вдалося оновити доступ до проєктів") };
        }
        if (data?.error) {
            return { data: null, error: new Error(data.error) };
        }
        return { data: data, error: null };
    },

    async revokeClientAccess(accessId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const { data, error } = await supabase.functions.invoke("client-access-admin", {
            body: {
                action: "revoke",
                accessId
            }
        });

        if (error) {
            return { data: null, error: new Error(error.message || "Не вдалося відкликати доступ") };
        }
        if (data?.error) {
            return { data: null, error: new Error(data.error) };
        }
        return { data: data?.access, error: null };
    },

    // -------------------------------------------------------------------------
    // 9. Client Portal Dashboard & Client Actions (Phase 4A)
    // -------------------------------------------------------------------------
    async getClientOrganizations() {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        return await supabase
            .from("organizations")
            .select("id, name, slug, status, logo_url")
            .order("name", { ascending: true });
    },

    async getClientDashboardData(orgId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        try {
            // 1. Organization info
            const { data: org, error: orgErr } = await supabase
                .from("organizations")
                .select("id, name, slug, status, logo_url")
                .eq("id", orgId)
                .single();

            if (orgErr || !org) {
                return { data: null, error: orgErr || new Error("Організація не знайдена або доступ обмежено.") };
            }

            // 2. Active Projects for this Client
            const { data: projects } = await supabase
                .from("projects")
                .select(`
                    id, title, name, description, project_type, status, health, start_date, target_date, target_end_date,
                    responsible_pm:responsible_pm_id(id, full_name, email, avatar_url)
                `)
                .eq("organization_id", orgId)
                .neq("status", "archived")
                .order("created_at", { ascending: false });

            const projectList = projects || [];
            const projectIds = projectList.map(p => p.id);

            let stages = [];
            let milestones = [];
            let clientActions = [];
            let documents = [];
            let nextMeeting = null;

            if (projectIds.length > 0) {
                // 3. Client-Visible Stages & Milestones
                const [stagesRes, milestonesRes, actionsRes, docsRes, meetingsRes] = await Promise.all([
                    supabase
                        .from("project_stages")
                        .select("id, project_id, name, description, status, sort_order, target_date, is_client_visible")
                        .in("project_id", projectIds)
                        .eq("is_client_visible", true)
                        .order("sort_order", { ascending: true }),

                    supabase
                        .from("milestones")
                        .select("id, project_id, stage_id, name, description, status, sort_order, target_date, completed_at, is_client_visible")
                        .in("project_id", projectIds)
                        .eq("is_client_visible", true)
                        .order("sort_order", { ascending: true }),

                    // 4. Client Actions (responsibility_type = 'client')
                    supabase
                        .from("tasks")
                        .select(`
                            id, project_id, stage_id, milestone_id, title, description, status, priority,
                            start_date, due_date, completed_at, responsibility_type, client_contact_id,
                            project:project_id(id, title, name)
                        `)
                        .in("project_id", projectIds)
                        .eq("responsibility_type", "client")
                        .eq("is_client_visible", true)
                        .order("status", { ascending: true })
                        .order("due_date", { ascending: true, nullsFirst: false }),

                    // 5. Client-Visible Documents with latest version
                    supabase
                        .from("documents")
                        .select(`
                            id, project_id, stage_id, title, description, category, status, internal_access_scope, is_client_visible, updated_at,
                            project:project_id(id, title, name),
                            document_versions(id, version_number, storage_path, original_filename, mime_type, size_bytes, created_at)
                        `)
                        .in("project_id", projectIds)
                        .eq("is_client_visible", true)
                        .eq("internal_access_scope", "project_team")
                        .is("archived_at", null)
                        .order("updated_at", { ascending: false })
                        .limit(10),

                    // 6. Client-Visible Meetings
                    supabase
                        .from("meetings")
                        .select(`
                            id, title, meeting_type, status, start_at, end_at, timezone, location_type, meeting_url, recording_url, agenda, project_id,
                            project:project_id(id, title, name),
                            organizer:organizer_user_id(id, full_name, email, avatar_url)
                        `)
                        .in("project_id", projectIds)
                        .eq("is_client_visible", true)
                        .order("start_at", { ascending: true })
                ]);

                stages = stagesRes.data || [];
                milestones = milestonesRes.data || [];
                
                // Sort client actions: open (todo/in_progress) before completed (done), then overdue first, then nearest due date
                clientActions = (actionsRes.data || []).sort((a, b) => {
                    const aDone = a.status === "done";
                    const bDone = b.status === "done";
                    if (aDone !== bDone) return aDone ? 1 : -1;

                    if (!aDone && !bDone) {
                        const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
                        const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
                        return aDue - bDue;
                    }

                    const aComp = a.completed_at ? new Date(a.completed_at).getTime() : 0;
                    const bComp = b.completed_at ? new Date(b.completed_at).getTime() : 0;
                    return bComp - aComp;
                });

                documents = (docsRes.data || []).slice(0, 5);
                nextMeeting = this.getNextMeeting(meetingsRes.data || []);
            }

            return {
                data: {
                    organization: org,
                    projects: projectList,
                    stages,
                    milestones,
                    clientActions,
                    documents,
                    nextMeeting
                },
                error: null
            };
        } catch (err) {
            console.error("[DataClient] getClientDashboardData error:", err);
            return { data: null, error: err };
        }
    },

    async completeClientAction(taskId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const { data, error } = await supabase.rpc("complete_client_action", {
            p_task_id: taskId
        });
        if (error) {
            return { data: null, error: new Error(error.message || "Не вдалося оновити статус дії.") };
        }
        return { data, error: null };
    },

    async reopenClientAction(taskId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const { data, error } = await supabase.rpc("reopen_client_action", {
            p_task_id: taskId
        });
        if (error) {
            return { data: null, error: new Error(error.message || "Не вдалося повернути дію до виконання.") };
        }
        return { data, error: null };
    },

    async activateClientPortalAccess() {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase.rpc("activate_client_portal_access");
    },

    async getClientDocumentDownloadUrl(storagePath) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase.storage
            .from("project-documents")
            .createSignedUrl(storagePath, 3600);
    },

    // -------------------------------------------------------------------------
    // 10. Client Projects, Roadmap & Detail (Phase 4B)
    // -------------------------------------------------------------------------
    async getClientProjects(orgId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: new Error("Database not connected") };

        try {
            const { data: projects, error: projErr } = await supabase
                .from("projects")
                .select(`
                    id, title, name, description, project_type, status, health, health_status,
                    start_date, target_date, target_end_date, created_at,
                    responsible_pm:responsible_pm_id(id, full_name, email, avatar_url)
                `)
                .eq("organization_id", orgId)
                .neq("status", "archived")
                .order("created_at", { ascending: false });

            if (projErr) return { data: [], error: projErr };
            const projectList = projects || [];
            if (projectList.length === 0) return { data: [], error: null };

            const projectIds = projectList.map(p => p.id);

            const [stagesRes, milestonesRes, actionsRes, meetingsRes] = await Promise.all([
                supabase
                    .from("project_stages")
                    .select("id, project_id, name, status, sort_order, target_date, is_client_visible")
                    .in("project_id", projectIds)
                    .eq("is_client_visible", true)
                    .order("sort_order", { ascending: true }),

                supabase
                    .from("milestones")
                    .select("id, project_id, stage_id, name, status, sort_order, target_date, completed_at, is_client_visible")
                    .in("project_id", projectIds)
                    .eq("is_client_visible", true)
                    .order("sort_order", { ascending: true }),

                supabase
                    .from("tasks")
                    .select("id, project_id, status, responsibility_type, is_client_visible")
                    .in("project_id", projectIds)
                    .eq("responsibility_type", "client")
                    .eq("is_client_visible", true),

                supabase
                    .from("meetings")
                    .select("id, project_id, title, start_at, end_at, status, is_client_visible")
                    .in("project_id", projectIds)
                    .eq("is_client_visible", true)
                    .eq("status", "scheduled")
                    .gte("start_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
                    .order("start_at", { ascending: true })
            ]);

            const allStages = stagesRes.data || [];
            const allMilestones = milestonesRes.data || [];
            const allActions = actionsRes.data || [];
            const allMeetings = meetingsRes.data || [];

            const enrichedProjects = projectList.map(p => {
                const pStages = allStages.filter(s => s.project_id === p.id);
                const pMilestones = allMilestones.filter(m => m.project_id === p.id);
                const pActions = allActions.filter(a => a.project_id === p.id);
                const pMeetings = allMeetings.filter(m => m.project_id === p.id);

                // Calculate confirmed client-facing progress
                let progress = null;
                if (pStages.length > 0) {
                    let totalContribution = 0;
                    pStages.forEach(st => {
                        const stMilestones = pMilestones.filter(m => m.stage_id === st.id);
                        if (stMilestones.length > 0) {
                            const completedCount = stMilestones.filter(m => m.status === "completed").length;
                            totalContribution += Math.round((completedCount / stMilestones.length) * 100);
                        } else if (st.status === "completed") {
                            totalContribution += 100;
                        }
                    });
                    progress = Math.round(totalContribution / pStages.length);
                }

                const currentStage = pStages.find(s => s.status === "in_progress") || 
                                     pStages.find(s => s.status !== "completed") || 
                                     pStages[0] || null;

                const pendingMilestones = pMilestones.filter(m => m.status !== "completed");
                const nextMilestone = pendingMilestones[0] || null;

                const openActionsCount = pActions.filter(a => a.status !== "done").length;
                const nextMeeting = pMeetings[0] || null;

                return {
                    ...p,
                    progress,
                    currentStage,
                    nextMilestone,
                    openActionsCount,
                    nextMeeting,
                    stagesCount: pStages.length,
                    milestonesCount: pMilestones.length
                };
            });

            return { data: enrichedProjects, error: null };
        } catch (err) {
            console.error("[DataClient] getClientProjects error:", err);
            return { data: [], error: err };
        }
    },

    async getClientProjectDetail(projectId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        try {
            // 1. Project Info
            const { data: project, error: projErr } = await supabase
                .from("projects")
                .select(`
                    id, organization_id, title, name, description, project_type, status, health, health_status,
                    start_date, target_date, target_end_date, created_at,
                    organization:organization_id(id, name, slug),
                    responsible_pm:responsible_pm_id(id, full_name, email, avatar_url)
                `)
                .eq("id", projectId)
                .single();

            if (projErr || !project) {
                return { data: null, error: projErr || new Error("Проєкт не знайдено або доступ обмежено.") };
            }

            // 2. Fetch parallel client-visible entities
            const [stagesRes, milestonesRes, actionsRes, docsRes, meetingsRes] = await Promise.all([
                supabase
                    .from("project_stages")
                    .select("id, project_id, name, description, status, sort_order, start_date, target_date, is_client_visible")
                    .eq("project_id", projectId)
                    .eq("is_client_visible", true)
                    .order("sort_order", { ascending: true }),

                supabase
                    .from("milestones")
                    .select("id, project_id, stage_id, name, description, status, sort_order, target_date, completed_at, is_client_visible")
                    .eq("project_id", projectId)
                    .eq("is_client_visible", true)
                    .order("sort_order", { ascending: true }),

                supabase
                    .from("tasks")
                    .select(`
                        id, project_id, stage_id, milestone_id, title, description, status, priority,
                        start_date, due_date, completed_at, responsibility_type, client_contact_id, source_meeting_id,
                        stage:stage_id(id, name),
                        milestone:milestone_id(id, name),
                        meeting:source_meeting_id(id, title)
                    `)
                    .eq("project_id", projectId)
                    .eq("responsibility_type", "client")
                    .eq("is_client_visible", true)
                    .order("status", { ascending: true })
                    .order("due_date", { ascending: true, nullsFirst: false }),

                supabase
                    .from("documents")
                    .select(`
                        id, project_id, stage_id, title, description, category, status, internal_access_scope, is_client_visible, updated_at,
                        document_versions(id, version_number, storage_path, original_filename, mime_type, size_bytes, change_note, published_to_client_at, is_client_visible, created_at)
                    `)
                    .eq("project_id", projectId)
                    .eq("is_client_visible", true)
                    .eq("internal_access_scope", "project_team")
                    .is("archived_at", null)
                    .order("updated_at", { ascending: false }),

                supabase
                    .from("meetings")
                    .select(`
                        id, title, meeting_type, status, start_at, end_at, timezone, location_type, meeting_url, recording_url, agenda, project_id,
                        organizer:organizer_user_id(id, full_name, email, avatar_url)
                    `)
                    .eq("project_id", projectId)
                    .eq("is_client_visible", true)
                    .order("start_at", { ascending: false })
            ]);

            const stages = stagesRes.data || [];
            const milestones = milestonesRes.data || [];
            const clientActions = actionsRes.data || [];
            const rawDocs = docsRes.data || [];
            const meetings = meetingsRes.data || [];

            // Filter document versions to only published ones
            const documents = rawDocs.map(doc => {
                const publishedVersions = (doc.document_versions || [])
                    .filter(v => v.is_client_visible === true)
                    .sort((a, b) => b.version_number - a.version_number);
                return {
                    ...doc,
                    publishedVersions,
                    latestVersion: publishedVersions[0] || null
                };
            });

            // Calculate progress for each stage and project
            let projectProgress = null;
            if (stages.length > 0) {
                let totalContribution = 0;
                stages.forEach(st => {
                    const stMilestones = milestones.filter(m => m.stage_id === st.id);
                    if (stMilestones.length > 0) {
                        const completedCount = stMilestones.filter(m => m.status === "completed").length;
                        st.progress = Math.round((completedCount / stMilestones.length) * 100);
                        totalContribution += st.progress;
                    } else if (st.status === "completed") {
                        st.progress = 100;
                        totalContribution += 100;
                    } else {
                        st.progress = null;
                    }
                });
                projectProgress = Math.round(totalContribution / stages.length);
            }

            const currentStage = stages.find(s => s.status === "in_progress") || 
                                 stages.find(s => s.status !== "completed") || 
                                 stages[0] || null;

            const pendingMilestones = milestones.filter(m => m.status !== "completed");
            const nextMilestone = pendingMilestones[0] || null;

            // Next upcoming meeting via canonical helper
            const nextMeeting = this.getNextMeeting(meetings);

            return {
                data: {
                    project: {
                        ...project,
                        progress: projectProgress,
                        currentStage,
                        nextMilestone,
                        nextMeeting
                    },
                    stages,
                    milestones,
                    clientActions,
                    documents,
                    meetings,
                    nextMeeting
                },
                error: null
            };
        } catch (err) {
            console.error("[DataClient] getClientProjectDetail error:", err);
            return { data: null, error: err };
        }
    },

    // -------------------------------------------------------------------------
    // 11. Client Action Center (Phase 4B)
    // -------------------------------------------------------------------------
    async getClientActions(orgId, filter = {}) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: new Error("Database not connected") };

        try {
            // First get accessible projects for org
            const { data: projects } = await supabase
                .from("projects")
                .select("id, title, name")
                .eq("organization_id", orgId)
                .neq("status", "archived");

            const projectList = projects || [];
            if (projectList.length === 0) return { data: [], error: null };
            const projectIds = projectList.map(p => p.id);

            let query = supabase
                .from("tasks")
                .select(`
                    id, project_id, stage_id, milestone_id, title, description, status, priority,
                    start_date, due_date, completed_at, responsibility_type, client_contact_id, source_meeting_id,
                    project:project_id(id, title, name),
                    stage:stage_id(id, name, is_client_visible),
                    milestone:milestone_id(id, name, is_client_visible),
                    meeting:source_meeting_id(id, title, is_client_visible)
                `)
                .in("project_id", projectIds)
                .eq("responsibility_type", "client")
                .eq("is_client_visible", true);

            if (filter.projectId && filter.projectId !== "all") {
                query = query.eq("project_id", filter.projectId);
            }

            if (filter.search) {
                query = query.ilike("title", `%${filter.search}%`);
            }

            const { data: rawActions, error: actErr } = await query
                .order("status", { ascending: true })
                .order("due_date", { ascending: true, nullsFirst: false });

            if (actErr) return { data: [], error: actErr };

            let actions = rawActions || [];

            // Apply view status filters
            const now = new Date();
            if (filter.view === "active") {
                actions = actions.filter(a => a.status !== "done");
            } else if (filter.view === "overdue") {
                actions = actions.filter(a => a.status !== "done" && a.due_date && new Date(a.due_date) < now);
            } else if (filter.view === "completed") {
                actions = actions.filter(a => a.status === "done");
            }

            return { data: actions, error: null };
        } catch (err) {
            console.error("[DataClient] getClientActions error:", err);
            return { data: [], error: err };
        }
    },

    // -------------------------------------------------------------------------
    // 12. Client Documents Hub & Review (Phase 4B)
    // -------------------------------------------------------------------------
    async getClientDocuments(orgId, filter = {}) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: new Error("Database not connected") };

        try {
            const { data: projects } = await supabase
                .from("projects")
                .select("id, title, name")
                .eq("organization_id", orgId)
                .neq("status", "archived");

            const projectList = projects || [];
            if (projectList.length === 0) return { data: [], error: null };
            const projectIds = projectList.map(p => p.id);

            let query = supabase
                .from("documents")
                .select(`
                    id, project_id, stage_id, title, description, category, status, internal_access_scope, is_client_visible, updated_at, created_at,
                    project:project_id(id, title, name),
                    stage:stage_id(id, name),
                    document_versions(id, version_number, storage_path, original_filename, mime_type, size_bytes, change_note, published_to_client_at, is_client_visible, created_at)
                `)
                .in("project_id", projectIds)
                .eq("is_client_visible", true)
                .eq("internal_access_scope", "project_team")
                .is("archived_at", null);

            if (filter.projectId && filter.projectId !== "all") {
                query = query.eq("project_id", filter.projectId);
            }
            if (filter.category && filter.category !== "all") {
                query = query.eq("category", filter.category);
            }
            if (filter.status && filter.status !== "all") {
                query = query.eq("status", filter.status);
            }
            if (filter.search) {
                query = query.ilike("title", `%${filter.search}%`);
            }

            const { data: rawDocs, error: docErr } = await query.order("updated_at", { ascending: false });
            if (docErr) return { data: [], error: docErr };

            const documents = (rawDocs || []).map(doc => {
                const publishedVersions = (doc.document_versions || [])
                    .filter(v => v.is_client_visible === true)
                    .sort((a, b) => b.version_number - a.version_number);
                return {
                    ...doc,
                    publishedVersions,
                    latestVersion: publishedVersions[0] || null
                };
            });

            return { data: documents, error: null };
        } catch (err) {
            console.error("[DataClient] getClientDocuments error:", err);
            return { data: [], error: err };
        }
    },

    async getClientDocumentDetail(documentId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        try {
            const { data: doc, error: docErr } = await supabase
                .from("documents")
                .select(`
                    id, project_id, stage_id, title, description, category, status, internal_access_scope, is_client_visible, updated_at, created_at,
                    project:project_id(id, title, name, organization_id),
                    stage:stage_id(id, name),
                    owner:owner_user_id(id, full_name, email, avatar_url),
                    document_versions(id, version_number, storage_path, original_filename, mime_type, size_bytes, change_note, published_to_client_at, is_client_visible, created_at)
                `)
                .eq("id", documentId)
                .eq("is_client_visible", true)
                .eq("internal_access_scope", "project_team")
                .is("archived_at", null)
                .single();

            if (docErr || !doc) {
                return { data: null, error: docErr || new Error("Документ не знайдено або доступ обмежено.") };
            }

            const publishedVersions = (doc.document_versions || [])
                .filter(v => v.is_client_visible === true)
                .sort((a, b) => b.version_number - a.version_number);

            // Fetch review events
            const { data: reviewEvents } = await supabase
                .from("document_review_events")
                .select(`
                    id, action, comment, created_at, document_version_id,
                    reviewer_contact:reviewer_contact_id(id, first_name, last_name, email),
                    reviewer_profile:reviewer_user_id(id, full_name, email)
                `)
                .eq("document_id", documentId)
                .order("created_at", { ascending: false });

            return {
                data: {
                    ...doc,
                    publishedVersions,
                    latestVersion: publishedVersions[0] || null,
                    reviewEvents: reviewEvents || []
                },
                error: null
            };
        } catch (err) {
            console.error("[DataClient] getClientDocumentDetail error:", err);
            return { data: null, error: err };
        }
    },

    async publishDocumentVersion(versionId, publish = true) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const { data, error } = await supabase.rpc("publish_document_version", {
            p_version_id: versionId,
            p_publish: publish
        });
        if (error) {
            return { data: null, error: new Error(error.message || "Не вдалося змінити публікацію версії.") };
        }
        return { data, error: null };
    },

    async approveDocumentVersion(documentId, versionId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const { data, error } = await supabase.rpc("approve_document_version", {
            p_document_id: documentId,
            p_version_id: versionId
        });
        if (error) {
            return { data: null, error: new Error(error.message || "Не вдалося погодити версію документа.") };
        }
        return { data, error: null };
    },

    async requestDocumentChanges(documentId, versionId, comment) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const { data, error } = await supabase.rpc("request_document_changes", {
            p_document_id: documentId,
            p_version_id: versionId,
            p_comment: comment
        });
        if (error) {
            return { data: null, error: new Error(error.message || "Не вдалося надіслати запит на зміни.") };
        }
        return { data, error: null };
    },

    async getDocumentReviewEvents(documentId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: new Error("Database not connected") };

        return await supabase
            .from("document_review_events")
            .select(`
                id, action, comment, created_at, document_version_id,
                version:document_version_id(id, version_number, original_filename),
                reviewer_contact:reviewer_contact_id(id, first_name, last_name, email),
                reviewer_profile:reviewer_user_id(id, full_name, email)
            `)
            .eq("document_id", documentId)
            .order("created_at", { ascending: false });
    },

    // -------------------------------------------------------------------------
    // 13. Canonical Client Meetings Helpers & Workspace (Phase 4B.2)
    // -------------------------------------------------------------------------
    getUpcomingMeetings(meetings = []) {
        const nowMs = Date.now() - 30 * 60 * 1000;
        return (meetings || [])
            .filter(m => m.status === "scheduled" && new Date(m.start_at).getTime() >= nowMs)
            .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    },

    getPastMeetings(meetings = []) {
        const nowMs = Date.now() - 30 * 60 * 1000;
        return (meetings || [])
            .filter(m => m.status === "completed" || (m.status === "scheduled" && new Date(m.start_at).getTime() < nowMs))
            .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
    },

    getCancelledMeetings(meetings = []) {
        return (meetings || [])
            .filter(m => m.status === "cancelled")
            .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
    },

    getNextMeeting(meetings = []) {
        const upcoming = this.getUpcomingMeetings(meetings);
        return upcoming[0] || null;
    },

    async getClientMeetings(orgId, filter = {}) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: new Error("Database not connected") };

        try {
            const { data: projects } = await supabase
                .from("projects")
                .select("id, title, name")
                .eq("organization_id", orgId)
                .neq("status", "archived");

            const projectList = projects || [];
            if (projectList.length === 0) return { data: [], error: null };
            const projectIds = projectList.map(p => p.id);

            let query = supabase
                .from("meetings")
                .select(`
                    id, title, meeting_type, status, start_at, end_at, timezone,
                    location_type, meeting_url, recording_url, agenda, project_id,
                    project:project_id(id, title, name),
                    organizer:organizer_user_id(id, full_name, email, avatar_url)
                `)
                .in("project_id", projectIds)
                .eq("is_client_visible", true);

            if (filter.projectId && filter.projectId !== "all") {
                query = query.eq("project_id", filter.projectId);
            }
            if (filter.search) {
                query = query.ilike("title", `%${filter.search}%`);
            }

            const { data: rawMeetings, error: meetErr } = await query.order("start_at", { ascending: true });
            if (meetErr) return { data: [], error: meetErr };

            return { data: rawMeetings || [], error: null };
        } catch (err) {
            console.error("[DataClient] getClientMeetings error:", err);
            return { data: [], error: err };
        }
    },

    async getClientMeetingDetail(meetingId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        try {
            // 1. Meeting Info
            const { data: meeting, error: meetErr } = await supabase
                .from("meetings")
                .select(`
                    id, title, meeting_type, status, start_at, end_at, timezone,
                    location_type, meeting_url, recording_url, agenda, project_id,
                    project:project_id(id, title, name, organization_id),
                    organizer:organizer_user_id(id, full_name, email, avatar_url)
                `)
                .eq("id", meetingId)
                .eq("is_client_visible", true)
                .single();

            if (meetErr || !meeting) {
                return { data: null, error: meetErr || new Error("Зустріч не знайдено або доступ обмежено.") };
            }

            // 2. Client-safe participants, client-visible notes, decisions, attached documents, and client tasks
            const [participantsRes, notesRes, decisionsRes, attachedDocsRes, tasksRes] = await Promise.all([
                supabase
                    .from("meeting_participants")
                    .select(`
                        id, participant_type, attendance_status,
                        user:user_id(id, full_name, avatar_url),
                        contact:contact_id(id, first_name, last_name, position)
                    `)
                    .eq("meeting_id", meetingId),

                supabase
                    .from("meeting_notes")
                    .select("id, note_type, body, created_at, is_client_visible")
                    .eq("meeting_id", meetingId)
                    .eq("is_client_visible", true)
                    .neq("note_type", "internal")
                    .order("created_at", { ascending: true }),

                supabase
                    .from("meeting_decisions")
                    .select("id, decision_text, sort_order, created_at, is_client_visible")
                    .eq("meeting_id", meetingId)
                    .eq("is_client_visible", true)
                    .order("sort_order", { ascending: true }),

                supabase
                    .from("meeting_documents")
                    .select(`
                        id, relation_type,
                        document:document_id(
                            id, title, description, category, status, is_client_visible, internal_access_scope,
                            document_versions(id, version_number, storage_path, original_filename, mime_type, size_bytes, is_client_visible)
                        )
                    `)
                    .eq("meeting_id", meetingId),

                supabase
                    .from("tasks")
                    .select("id, title, description, status, priority, due_date, completed_at, responsibility_type, is_client_visible")
                    .eq("source_meeting_id", meetingId)
                    .eq("responsibility_type", "client")
                    .eq("is_client_visible", true)
                    .order("status", { ascending: true })
            ]);

            // Filter attached docs to only client visible with published version
            const attachedDocuments = (attachedDocsRes.data || [])
                .filter(ad => ad.document && ad.document.is_client_visible && ad.document.internal_access_scope === "project_team")
                .map(ad => {
                    const publishedVersions = (ad.document.document_versions || [])
                        .filter(v => v.is_client_visible === true)
                        .sort((a, b) => b.version_number - a.version_number);
                    return {
                        id: ad.id,
                        relation_type: ad.relation_type,
                        document: {
                            ...ad.document,
                            publishedVersions,
                            latestVersion: publishedVersions[0] || null
                        }
                    };
                })
                .filter(ad => ad.document.latestVersion !== null);

            return {
                data: {
                    meeting,
                    participants: participantsRes.data || [],
                    notes: notesRes.data || [],
                    decisions: decisionsRes.data || [],
                    attachedDocuments,
                    tasks: tasksRes.data || []
                },
                error: null
            };
        } catch (err) {
            console.error("[DataClient] getClientMeetingDetail error:", err);
            return { data: null, error: err };
        }
    },

    // -------------------------------------------------------------------------
    // 14. Phase 5A: Owner Command Center & Portfolio Dashboard Data
    // -------------------------------------------------------------------------
    async getOwnerDashboardData() {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const role = PortalAuth.getGlobalRole();
        if (role === "client") {
            return { data: null, error: new Error("Доступ до операційного дашборду заборонено.") };
        }

        try {
            // Parallel fetch of all core delivery datasets with RLS active
            const [
                orgsRes,
                projsRes,
                stagesRes,
                milestonesRes,
                tasksRes,
                docsRes,
                meetsRes,
                staffRes,
                eventsRes,
                notifsRes
            ] = await Promise.all([
                // 1. Organizations
                supabase
                    .from("organizations")
                    .select(`
                        id, name, slug, status, industry, country, responsible_pm_id, created_at,
                        responsible_pm:responsible_pm_id(id, full_name, email, avatar_url)
                    `)
                    .order("name", { ascending: true }),

                // 2. Projects
                supabase
                    .from("projects")
                    .select(`
                        id, organization_id, title, name, project_type, status, health,
                        progress_percent, target_date, responsible_pm_id, created_at, updated_at,
                        organization:organization_id(id, name, slug, status),
                        responsible_pm:responsible_pm_id(id, full_name, email, avatar_url)
                    `)
                    .order("created_at", { ascending: false }),

                // 3. Stages
                supabase
                    .from("project_stages")
                    .select("id, project_id, name, status, sort_order, target_date, is_client_visible")
                    .order("sort_order", { ascending: true }),

                // 4. Milestones
                supabase
                    .from("milestones")
                    .select("id, project_id, stage_id, name, status, sort_order, target_date, completed_at, is_client_visible")
                    .order("sort_order", { ascending: true }),

                // 5. Tasks
                supabase
                    .from("tasks")
                    .select(`
                        id, organization_id, project_id, stage_id, title, description,
                        status, priority, due_date, completed_at, responsibility_type,
                        assignee_user_id, client_contact_id, source_meeting_id, is_client_visible,
                        created_at, updated_at,
                        assignee:assignee_user_id(id, full_name, email, avatar_url),
                        project:project_id(id, title, name, organization_id)
                    `)
                    .order("due_date", { ascending: true, nullsFirst: false }),

                // 6. Documents
                supabase
                    .from("documents")
                    .select(`
                        id, organization_id, project_id, title, category, status,
                        is_client_visible, internal_access_scope, created_at, updated_at,
                        project:project_id(id, title, name),
                        organization:organization_id(id, name),
                        document_versions(id, version_number, is_client_visible, published_to_client_at, created_at)
                    `)
                    .order("updated_at", { ascending: false }),

                // 7. Meetings
                supabase
                    .from("meetings")
                    .select(`
                        id, organization_id, project_id, title, meeting_type, status,
                        start_at, end_at, timezone, location_type, meeting_url, location_text,
                        agenda, organizer_user_id, is_client_visible, created_at,
                        organizer:organizer_user_id(id, full_name, email, avatar_url),
                        project:project_id(id, title, name),
                        organization:organization_id(id, name)
                    `)
                    .order("start_at", { ascending: true }),

                // 8. Staff Profiles
                supabase
                    .from("profiles")
                    .select("id, full_name, email, avatar_url, global_role")
                    .neq("global_role", "client")
                    .order("full_name", { ascending: true }),

                // 9. Recent Review Events
                supabase
                    .from("document_review_events")
                    .select("id, action, comment, created_at, document_id, project_id, organization_id, reviewer_user_id, reviewer_contact_id")
                    .order("created_at", { ascending: false })
                    .limit(20),

                // 10. Personal Recent Notifications
                supabase
                    .from("notifications")
                    .select("*, organization:organization_id(id, name), project:project_id(id, name, title)")
                    .order("created_at", { ascending: false })
                    .limit(5)
            ]);

            const orgs = orgsRes.data || [];
            const projects = projsRes.data || [];
            const stages = stagesRes.data || [];
            const milestones = milestonesRes.data || [];
            const tasks = tasksRes.data || [];
            const documents = docsRes.data || [];
            const meetings = meetsRes.data || [];
            const staff = staffRes.data || [];
            const reviewEvents = eventsRes.data || [];
            const recentNotifications = notifsRes.data || [];

            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            // -----------------------------------------------------------------
            // A. KPI Header Calculations
            // -----------------------------------------------------------------
            const activeClientsCount = orgs.filter(o => o.status === "active").length;
            const activeProjects = projects.filter(p => !["completed", "archived", "paused"].includes(p.status));
            const activeProjectsCount = activeProjects.length;
            const atRiskProjectsCount = activeProjects.filter(p => ["at_risk", "delayed", "blocked"].includes(p.health)).length;
            
            const openTasks = tasks.filter(t => t.status !== "done");
            const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date) < startOfToday);
            const overdueTasksCount = overdueTasks.length;

            const clientActions = tasks.filter(t => t.responsibility_type === "client" && t.status !== "done");
            const clientActionsCount = clientActions.length;
            const overdueClientActions = clientActions.filter(t => t.due_date && new Date(t.due_date) < startOfToday);

            const pendingReviewDocs = documents.filter(d => d.status === "client_review" && d.is_client_visible);
            const pendingReviewsCount = pendingReviewDocs.length;

            const kpis = {
                activeClientsCount,
                activeProjectsCount,
                atRiskProjectsCount,
                overdueTasksCount,
                clientActionsCount,
                overdueClientActionsCount: overdueClientActions.length,
                pendingReviewsCount
            };

            // -----------------------------------------------------------------
            // B. Enriched Portfolio Projects
            // -----------------------------------------------------------------
            const upcomingScheduledMeetings = this.getUpcomingMeetings(meetings);

            const portfolioProjects = projects.map(proj => {
                const projStages = stages.filter(s => s.project_id === proj.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                const currentStage = projStages.find(s => s.status === "in_progress") || projStages.find(s => s.status !== "completed") || projStages[0] || null;

                const projMilestones = milestones.filter(m => m.project_id === proj.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                const nextMilestone = projMilestones.find(m => m.status === "pending" || m.status === "in_progress") || null;

                const projTasks = tasks.filter(t => t.project_id === proj.id);
                const projOpenTasks = projTasks.filter(t => t.status !== "done");
                const projOverdueTasks = projOpenTasks.filter(t => t.due_date && new Date(t.due_date) < startOfToday);
                const projClientActions = projTasks.filter(t => t.responsibility_type === "client" && t.status !== "done");

                const projNextMeeting = upcomingScheduledMeetings.find(m => m.project_id === proj.id) || null;

                return {
                    ...proj,
                    currentStage,
                    nextMilestone,
                    openTasksCount: projOpenTasks.length,
                    overdueTasksCount: projOverdueTasks.length,
                    clientActionsCount: projClientActions.length,
                    nextMeeting: projNextMeeting
                };
            });

            // -----------------------------------------------------------------
            // C. Attention Center Items (Derived Operational Exceptions)
            // -----------------------------------------------------------------
            const attentionItems = [];

            // Rule 1: Project Blocked (Critical)
            activeProjects.filter(p => p.health === "blocked").forEach(p => {
                attentionItems.push({
                    id: `proj-blocked-${p.id}`,
                    severity: "critical",
                    type: "project_blocked",
                    typeLabel: "Проєкт заблоковано",
                    icon: "alert-octagon",
                    clientName: p.organization?.name || "Клієнт",
                    projectName: p.name || p.title,
                    description: `Проєкт переведено в критичний стан здоров'я: Заблоковано`,
                    responsible: p.responsible_pm?.full_name || "Не призначено",
                    targetUrl: `#/portal/projects/${p.id}`,
                    ctaLabel: "Відкрити проєкт",
                    dateLabel: p.target_date ? `Ціль: ${this.formatDateSimple(p.target_date)}` : null
                });
            });

            // Rule 2: Overdue Urgent/High Priority Tasks (Critical)
            overdueTasks.filter(t => ["urgent", "high"].includes(t.priority)).forEach(t => {
                attentionItems.push({
                    id: `task-crit-overdue-${t.id}`,
                    severity: "critical",
                    type: "overdue_urgent_task",
                    typeLabel: "Критичний дедлайн",
                    icon: "alert-circle",
                    clientName: t.project?.organization_id ? (orgs.find(o => o.id === t.project.organization_id)?.name || "Клієнт") : "Клієнт",
                    projectName: t.project?.title || t.project?.name || "Проєкт",
                    description: `Задача «${t.title}» з високим пріоритетом прострочена`,
                    responsible: t.assignee?.full_name || "Не призначено",
                    targetUrl: `#/portal/projects/${t.project_id}`,
                    ctaLabel: "До задач проєкту",
                    dateLabel: `Дедлайн: ${this.formatDateSimple(t.due_date)}`
                });
            });

            // Rule 3: Overdue Client Actions (High)
            overdueClientActions.forEach(t => {
                attentionItems.push({
                    id: `client-action-overdue-${t.id}`,
                    severity: "high",
                    type: "overdue_client_action",
                    typeLabel: "Очікує клієнта",
                    icon: "user-x",
                    clientName: t.project?.organization_id ? (orgs.find(o => o.id === t.project.organization_id)?.name || "Клієнт") : "Клієнт",
                    projectName: t.project?.title || t.project?.name || "Проєкт",
                    description: `Клієнтська дія «${t.title}» прострочена`,
                    responsible: "Клієнтська команда",
                    targetUrl: `#/portal/projects/${t.project_id}`,
                    ctaLabel: "Переглянути дію",
                    dateLabel: `Термін сплив: ${this.formatDateSimple(t.due_date)}`
                });
            });

            // Rule 4: Projects with health At Risk or Delayed (High)
            activeProjects.filter(p => ["at_risk", "delayed"].includes(p.health)).forEach(p => {
                const isDelayed = p.health === "delayed";
                attentionItems.push({
                    id: `proj-health-${p.id}`,
                    severity: "high",
                    type: isDelayed ? "project_delayed" : "project_at_risk",
                    typeLabel: isDelayed ? "Затримка проєкту" : "Проєкт у зоні ризику",
                    icon: isDelayed ? "clock" : "alert-triangle",
                    clientName: p.organization?.name || "Клієнт",
                    projectName: p.name || p.title,
                    description: isDelayed ? "Проєкт відстає від графіка делівері" : "Потребує уваги PM: ризик зриву строків",
                    responsible: p.responsible_pm?.full_name || "Не призначено",
                    targetUrl: `#/portal/projects/${p.id}`,
                    ctaLabel: "Паспорт проєкту",
                    dateLabel: p.target_date ? `Ціль: ${this.formatDateSimple(p.target_date)}` : null
                });
            });

            // Rule 5: Documents Waiting for Client Approval (High)
            pendingReviewDocs.forEach(d => {
                attentionItems.push({
                    id: `doc-review-${d.id}`,
                    severity: "high",
                    type: "document_pending_review",
                    typeLabel: "Погодження документа",
                    icon: "file-check",
                    clientName: d.organization?.name || "Клієнт",
                    projectName: d.project?.title || d.project?.name || "Проєкт",
                    description: `Документ «${d.title}» очікує погодження клієнтом`,
                    responsible: "Клієнт",
                    targetUrl: `#/portal/documents/${d.id}`,
                    ctaLabel: "Відкрити документ",
                    dateLabel: `Надіслано: ${this.formatDateSimple(d.updated_at || d.created_at)}`
                });
            });

            // Rule 6: Blocked Stages (High)
            stages.filter(s => s.status === "blocked").forEach(s => {
                const proj = projects.find(p => p.id === s.project_id);
                attentionItems.push({
                    id: `stage-blocked-${s.id}`,
                    severity: "high",
                    type: "stage_blocked",
                    typeLabel: "Етап заблоковано",
                    icon: "shield-alert",
                    clientName: proj?.organization?.name || "Клієнт",
                    projectName: proj?.title || proj?.name || "Проєкт",
                    description: `Етап «${s.name}» заблоковано перешкодами`,
                    responsible: proj?.responsible_pm?.full_name || "Команда проєкту",
                    targetUrl: `#/portal/projects/${s.project_id}`,
                    ctaLabel: "До етапів",
                    dateLabel: null
                });
            });

            // Rule 7: Projects Approaching Deadline (< 7 days) (Medium)
            activeProjects.filter(p => p.target_date && new Date(p.target_date) >= startOfToday && new Date(p.target_date) <= in7Days).forEach(p => {
                attentionItems.push({
                    id: `proj-deadline-soon-${p.id}`,
                    severity: "medium",
                    type: "project_deadline_soon",
                    typeLabel: "Наближається дедлайн",
                    icon: "calendar-clock",
                    clientName: p.organization?.name || "Клієнт",
                    projectName: p.name || p.title,
                    description: `Цільова дата завершення проєкту наближається`,
                    responsible: p.responsible_pm?.full_name || "Не призначено",
                    targetUrl: `#/portal/projects/${p.id}`,
                    ctaLabel: "Паспорт проєкту",
                    dateLabel: `Ціль: ${this.formatDateSimple(p.target_date)}`
                });
            });

            // Rule 8: Regular Overdue Tasks (Medium)
            overdueTasks.filter(t => !["urgent", "high"].includes(t.priority) && t.responsibility_type !== "client").forEach(t => {
                attentionItems.push({
                    id: `task-med-overdue-${t.id}`,
                    severity: "medium",
                    type: "overdue_task",
                    typeLabel: "Прострочена задача",
                    icon: "check-circle",
                    clientName: t.project?.organization_id ? (orgs.find(o => o.id === t.project.organization_id)?.name || "Клієнт") : "Клієнт",
                    projectName: t.project?.title || t.project?.name || "Проєкт",
                    description: `Задача «${t.title}» потребує актуалізації строку`,
                    responsible: t.assignee?.full_name || "Не призначено",
                    targetUrl: `#/portal/projects/${t.project_id}`,
                    ctaLabel: "До задач",
                    dateLabel: `Дедлайн: ${this.formatDateSimple(t.due_date)}`
                });
            });

            // Rule 9: Active Project without PM (Medium)
            activeProjects.filter(p => !p.responsible_pm_id && p.status === "in_progress").forEach(p => {
                attentionItems.push({
                    id: `proj-no-pm-${p.id}`,
                    severity: "medium",
                    type: "project_no_pm",
                    typeLabel: "Без PM",
                    icon: "user-plus",
                    clientName: p.organization?.name || "Клієнт",
                    projectName: p.name || p.title,
                    description: `Активний проєкт не має закріпленого відповідального PM`,
                    responsible: "Owner / Призначити PM",
                    targetUrl: `#/portal/projects/${p.id}`,
                    ctaLabel: "Призначити PM",
                    dateLabel: null
                });
            });

            // Sort Attention Items: Critical -> High -> Medium
            const severityRank = { critical: 1, high: 2, medium: 3 };
            attentionItems.sort((a, b) => (severityRank[a.severity] || 99) - (severityRank[b.severity] || 99));

            // -----------------------------------------------------------------
            // D. Team Workload Snapshot
            // -----------------------------------------------------------------
            const teamWorkload = staff.map(member => {
                const memberProjects = projects.filter(p => p.responsible_pm_id === member.id && !["completed", "archived"].includes(p.status));
                const memberTasks = tasks.filter(t => t.assignee_user_id === member.id && t.status !== "done");
                const memberOverdue = memberTasks.filter(t => t.due_date && new Date(t.due_date) < startOfToday);
                const memberHighCrit = memberTasks.filter(t => ["urgent", "high"].includes(t.priority));

                return {
                    id: member.id,
                    fullName: member.full_name,
                    email: member.email,
                    avatarUrl: member.avatar_url,
                    role: member.global_role,
                    activeProjectsCount: memberProjects.length,
                    openTasksCount: memberTasks.length,
                    overdueTasksCount: memberOverdue.length,
                    highCritTasksCount: memberHighCrit.length
                };
            });

            // -----------------------------------------------------------------
            // E. Recent Activity Feed (Lightweight Aggregation)
            // -----------------------------------------------------------------
            const activities = [];

            // 1. Review events
            reviewEvents.forEach(re => {
                const doc = documents.find(d => d.id === re.document_id);
                const actorProfile = staff.find(s => s.id === re.reviewer_user_id);
                const actorName = actorProfile?.full_name || "Клієнт";
                const isApproved = re.action === "approved";
                activities.push({
                    id: `event-rev-${re.id}`,
                    timestamp: new Date(re.created_at).getTime(),
                    dateStr: this.formatDateTimeSimple(re.created_at),
                    icon: isApproved ? "check-check" : "message-square",
                    iconColor: isApproved ? "var(--color-success)" : "var(--color-warning)",
                    title: isApproved ? `Погоджено документ «${doc?.title || 'Документ'}»` : `Запитано правки до «${doc?.title || 'Документ'}»`,
                    actor: actorName,
                    targetUrl: `#/portal/documents/${re.document_id}`,
                    comment: re.comment || null
                });
            });

            // 2. Completed Tasks
            tasks.filter(t => t.status === "done" && t.completed_at).slice(0, 10).forEach(t => {
                activities.push({
                    id: `event-task-${t.id}`,
                    timestamp: new Date(t.completed_at).getTime(),
                    dateStr: this.formatDateTimeSimple(t.completed_at),
                    icon: "check-circle-2",
                    iconColor: "var(--color-success)",
                    title: `Виконано ${t.responsibility_type === 'client' ? 'клієнтську дію' : 'задачу'} «${t.title}»`,
                    actor: t.assignee?.full_name || (t.responsibility_type === 'client' ? "Клієнт" : "Команда"),
                    targetUrl: `#/portal/projects/${t.project_id}`,
                    comment: null
                });
            });

            // 3. Recent/Upcoming Meetings
            meetings.slice(0, 8).forEach(m => {
                const isPast = new Date(m.start_at).getTime() < now.getTime();
                activities.push({
                    id: `event-meet-${m.id}`,
                    timestamp: new Date(m.created_at || m.start_at).getTime(),
                    dateStr: this.formatDateTimeSimple(m.start_at),
                    icon: "video",
                    iconColor: "var(--color-primary)",
                    title: isPast ? `Проведено зустріч «${m.title}»` : `Заплановано зустріч «${m.title}»`,
                    actor: m.organizer?.full_name || "FIRSTWIN Team",
                    targetUrl: `#/portal/meetings/${m.id}`,
                    comment: m.project?.name ? `Проєкт: ${m.project.name}` : null
                });
            });

            // Sort recent activities descending by timestamp
            activities.sort((a, b) => b.timestamp - a.timestamp);
            const recentActivities = activities.slice(0, 15);

            return {
                data: {
                    kpis,
                    portfolioProjects,
                    attentionItems,
                    upcomingMeetings: upcomingScheduledMeetings.slice(0, 7),
                    clientActions: clientActions.sort((a, b) => new Date(a.due_date || '2099-01-01') - new Date(b.due_date || '2099-01-01')),
                    teamWorkload,
                    recentActivities,
                    recentNotifications,
                    organizations: orgs,
                    staff
                },
                error: null
            };
        } catch (err) {
            console.error("[DataClient] getOwnerDashboardData error:", err);
            return { data: null, error: err };
        }
    },

    // -------------------------------------------------------------------------
    // 10. Notifications & Personal Inbox (Phase 5B)
    // -------------------------------------------------------------------------
    async getNotifications(filter = {}) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null, unreadCount: 0, criticalCount: 0, todayCount: 0, totalCount: 0 };

        try {
            let query = supabase
                .from("notifications")
                .select(`
                    *,
                    organization:organization_id(id, name),
                    project:project_id(id, name, title)
                `)
                .order("created_at", { ascending: false });

            // Apply read filter
            if (filter.is_read === true || filter.status === "read") {
                query = query.eq("is_read", true);
            } else if (filter.is_read === false || filter.status === "unread") {
                query = query.eq("is_read", false);
            }

            // Apply severity filter
            if (filter.severity && filter.severity !== "all") {
                query = query.eq("severity", filter.severity);
            }

            // Apply organization / client filter
            if (filter.organization_id && filter.organization_id !== "all") {
                query = query.eq("organization_id", filter.organization_id);
            }

            // Apply project filter
            if (filter.project_id && filter.project_id !== "all") {
                query = query.eq("project_id", filter.project_id);
            }

            // Apply entity type / category filter
            if (filter.category && filter.category !== "all") {
                if (filter.category === "tasks") {
                    query = query.eq("entity_type", "task");
                } else if (filter.category === "projects") {
                    query = query.eq("entity_type", "project");
                } else if (filter.category === "documents") {
                    query = query.eq("entity_type", "document");
                } else if (filter.category === "meetings") {
                    query = query.eq("entity_type", "meeting");
                } else if (filter.category === "clients") {
                    query = query.eq("entity_type", "organization");
                }
            }

            if (filter.limit) {
                query = query.limit(filter.limit);
            }

            const { data, error } = await query;
            if (error) throw error;

            let notifications = data || [];

            // In-memory search filter if provided
            if (filter.search && filter.search.trim()) {
                const q = filter.search.toLowerCase().trim();
                notifications = notifications.filter(n =>
                    (n.title && n.title.toLowerCase().includes(q)) ||
                    (n.message && n.message.toLowerCase().includes(q)) ||
                    (n.organization?.name && n.organization.name.toLowerCase().includes(q)) ||
                    (n.project?.name && n.project.name.toLowerCase().includes(q))
                );
            }

            return { data: notifications, error: null };
        } catch (err) {
            console.error("[DataClient] getNotifications error:", err);
            return { data: [], error: err };
        }
    },

    async getNotificationCounters() {
        const supabase = await getSupabase();
        if (!supabase) return { unread: 0, critical: 0, today: 0, total: 0 };

        try {
            const { data, error } = await supabase
                .from("notifications")
                .select("id, is_read, severity, created_at");

            if (error) throw error;
            const list = data || [];

            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const unread = list.filter(n => !n.is_read).length;
            const critical = list.filter(n => n.severity === "critical" && !n.is_read).length;
            const today = list.filter(n => new Date(n.created_at) >= startOfToday).length;
            const total = list.length;

            return { unread, critical, today, total, error: null };
        } catch (err) {
            console.error("[DataClient] getNotificationCounters error:", err);
            return { unread: 0, critical: 0, today: 0, total: 0, error: err };
        }
    },

    async getUnreadNotificationsCount() {
        const supabase = await getSupabase();
        if (!supabase) return 0;

        try {
            const { data, error } = await supabase.rpc("get_unread_notifications_count");
            if (error) {
                // Fallback to query
                const { count } = await supabase
                    .from("notifications")
                    .select("*", { count: "exact", head: true })
                    .eq("is_read", false);
                return count || 0;
            }
            return data || 0;
        } catch (err) {
            console.error("[DataClient] getUnreadNotificationsCount error:", err);
            return 0;
        }
    },

    async getRecentNotifications(limit = 10) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        try {
            const { data, error } = await supabase
                .from("notifications")
                .select(`
                    *,
                    organization:organization_id(id, name),
                    project:project_id(id, name, title)
                `)
                .order("created_at", { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { data: data || [], error: null };
        } catch (err) {
            console.error("[DataClient] getRecentNotifications error:", err);
            return { data: [], error: err };
        }
    },

    async markNotificationAsRead(notificationId) {
        const supabase = await getSupabase();
        if (!supabase || !notificationId) return { success: false };

        try {
            const { data, error } = await supabase.rpc("mark_notification_as_read", {
                p_notification_id: notificationId
            });
            if (error) {
                // Fallback to direct update
                await supabase
                    .from("notifications")
                    .update({ is_read: true, read_at: new Date().toISOString() })
                    .eq("id", notificationId);
            }
            return { success: true };
        } catch (err) {
            console.error("[DataClient] markNotificationAsRead error:", err);
            return { success: false, error: err };
        }
    },

    async markAllNotificationsAsRead() {
        const supabase = await getSupabase();
        if (!supabase) return { success: false };

        try {
            const { data, error } = await supabase.rpc("mark_all_notifications_as_read");
            if (error) {
                // Fallback
                await supabase
                    .from("notifications")
                    .update({ is_read: true, read_at: new Date().toISOString() })
                    .eq("is_read", false);
            }
            return { success: true };
        } catch (err) {
            console.error("[DataClient] markAllNotificationsAsRead error:", err);
            return { success: false, error: err };
        }
    },

    async evaluateNotifications() {
        const supabase = await getSupabase();
        if (!supabase) return { success: false };

        try {
            const { data, error } = await supabase.rpc("evaluate_notifications");
            if (error) throw error;
            return { success: true, data };
        } catch (err) {
            console.error("[DataClient] evaluateNotifications error:", err);
            return { success: false, error: err };
        }
    },

    formatDateSimple(dateInput) {
        if (!dateInput) return "";
        try {
            const d = new Date(dateInput);
            return d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
        } catch (e) {
            return String(dateInput);
        }
    },

    formatDateTimeSimple(dateInput) {
        if (!dateInput) return "";
        try {
            const d = new Date(dateInput);
            return d.toLocaleDateString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        } catch (e) {
            return String(dateInput);
        }
    },

    formatRelativeTime(dateInput) {
        if (!dateInput) return "";
        try {
            const d = new Date(dateInput);
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHours = Math.floor(diffMin / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffSec < 45) return "щойно";
            if (diffMin < 60) return `${diffMin} хв тому`;
            if (diffHours < 24) return `${diffHours} год тому`;
            if (diffDays === 1) return `вчора, ${d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`;
            if (diffDays < 7) return `${diffDays} дн. тому`;

            return d.toLocaleDateString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        } catch (e) {
            return String(dateInput);
        }
    },

    // -------------------------------------------------------------------------
    // 17. Finance Foundation & Project Economics (Phase 5C.1)
    // -------------------------------------------------------------------------
    formatMoney(amountMinor, currency = "CZK") {
        if (amountMinor === null || amountMinor === undefined || isNaN(amountMinor)) {
            return `0 ${currency}`;
        }
        const majorUnits = amountMinor / 100;
        const formattedNumber = majorUnits.toLocaleString("uk-UA", {
            minimumFractionDigits: majorUnits % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        });
        return `${formattedNumber} ${currency}`;
    },

    async getProjectCommercialTerms(projectId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: null };

        return await supabase
            .from("project_commercial_terms")
            .select("*")
            .eq("project_id", projectId)
            .maybeSingle();
    },

    async upsertProjectCommercialTerms(termsData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        const payload = {
            ...termsData,
            updated_at: new Date().toISOString()
        };

        return await supabase
            .from("project_commercial_terms")
            .upsert(payload, { onConflict: "project_id" })
            .select()
            .single();
    },

    async getProjectPaymentSchedule(projectId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        return await supabase
            .from("project_payment_schedule")
            .select("*")
            .eq("project_id", projectId)
            .order("sort_order", { ascending: true })
            .order("due_date", { ascending: true });
    },

    async createPaymentScheduleTranche(trancheData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("project_payment_schedule")
            .insert(trancheData)
            .select()
            .single();
    },

    async updatePaymentScheduleTranche(trancheId, updates) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("project_payment_schedule")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", trancheId)
            .select()
            .single();
    },

    async deletePaymentScheduleTranche(trancheId) {
        const supabase = await getSupabase();
        if (!supabase) return { error: new Error("Database not connected") };

        return await supabase
            .from("project_payment_schedule")
            .delete()
            .eq("id", trancheId);
    },

    async getProjectPayments(projectId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        return await supabase
            .from("project_payments")
            .select("*")
            .eq("project_id", projectId)
            .order("paid_at", { ascending: false });
    },

    async createProjectPayment(paymentData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("project_payments")
            .insert(paymentData)
            .select()
            .single();
    },

    async getProjectCosts(projectId) {
        const supabase = await getSupabase();
        if (!supabase) return { data: [], error: null };

        return await supabase
            .from("project_costs")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false });
    },

    async createProjectCost(costData) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("project_costs")
            .insert(costData)
            .select()
            .single();
    },

    async updateProjectCost(costId, updates) {
        const supabase = await getSupabase();
        if (!supabase) return { data: null, error: new Error("Database not connected") };

        return await supabase
            .from("project_costs")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", costId)
            .select()
            .single();
    },

    async deleteProjectCost(costId) {
        const supabase = await getSupabase();
        if (!supabase) return { error: new Error("Database not connected") };

        return await supabase
            .from("project_costs")
            .delete()
            .eq("id", costId);
    },

    async getProjectFinanceData(projectId) {
        const [termsRes, scheduleRes, paymentsRes, costsRes] = await Promise.all([
            this.getProjectCommercialTerms(projectId),
            this.getProjectPaymentSchedule(projectId),
            this.getProjectPayments(projectId),
            this.getProjectCosts(projectId)
        ]);

        const terms = termsRes.data || null;
        const schedule = scheduleRes.data || [];
        const payments = paymentsRes.data || [];
        const costs = costsRes.data || [];

        const currency = terms?.currency || (schedule[0]?.currency) || "CZK";
        const contractValueMinor = terms ? Number(terms.contract_value_minor || 0) : 0;
        
        // Sum payments
        const collectedMinor = payments.reduce((sum, p) => sum + Number(p.amount_minor || 0), 0);
        const outstandingMinor = Math.max(contractValueMinor - collectedMinor, 0);

        // Sum overdue schedule items
        const today = new Date().toISOString().split("T")[0];
        let overdueMinor = 0;
        let nextPayment = null;

        schedule.forEach(s => {
            const tranchePayments = payments.filter(p => p.payment_schedule_id === s.id);
            const paidForTranche = tranchePayments.reduce((sum, p) => sum + Number(p.amount_minor || 0), 0);
            const remainder = Math.max(Number(s.amount_minor || 0) - paidForTranche, 0);

            if (s.status !== "cancelled" && remainder > 0) {
                if (s.due_date < today) {
                    overdueMinor += remainder;
                } else {
                    if (!nextPayment || s.due_date < nextPayment.due_date) {
                        nextPayment = { ...s, remainderMinor: remainder };
                    }
                }
            }
        });

        // Costs (Owner only)
        const hasCostRecords = costs.length > 0;
        const plannedCostMinor = costs.filter(c => c.cost_type === "planned").reduce((sum, c) => sum + Number(c.amount_minor || 0), 0);
        const actualCostMinor = costs.filter(c => c.cost_type === "actual").reduce((sum, c) => sum + Number(c.amount_minor || 0), 0);
        const forecastResultMinor = hasCostRecords ? (contractValueMinor - plannedCostMinor) : null;
        const forecastMarginPercent = (hasCostRecords && contractValueMinor > 0) ? ((contractValueMinor - plannedCostMinor) / contractValueMinor) * 100 : null;
        const currentCashResultMinor = collectedMinor - actualCostMinor;

        const kpis = {
            contractValueMinor,
            collectedMinor,
            outstandingMinor,
            overdueMinor,
            plannedCostMinor,
            actualCostMinor,
            forecastResultMinor,
            forecastMarginPercent,
            hasCostRecords,
            currentCashResultMinor,
            nextPayment
        };

        const financialStatus = this.getProjectFinancialStatus(kpis);

        return {
            terms,
            schedule,
            payments,
            costs,
            currency,
            kpis,
            financialStatus
        };
    },

    getProjectFinancialStatus(kpiObj) {
        if (!kpiObj) return { key: "draft", label: "Умови не задані", cls: "portal-badge-neutral" };
        
        if (Number(kpiObj.overdueMinor || 0) > 0) {
            return { key: "overdue", label: "Є прострочка", cls: "portal-badge-danger" };
        }
        if (Number(kpiObj.contractValueMinor || 0) > 0 && Number(kpiObj.collectedMinor || 0) >= Number(kpiObj.contractValueMinor || 0)) {
            return { key: "fully_paid", label: "Оплачено", cls: "portal-badge-success" };
        }
        if (Number(kpiObj.collectedMinor || 0) > 0 && Number(kpiObj.outstandingMinor || 0) > 0) {
            return { key: "partially_paid", label: "Частково оплачено", cls: "portal-badge-warning" };
        }
        if (Number(kpiObj.outstandingMinor || 0) > 0 && kpiObj.nextPayment) {
            return { key: "due_soon", label: "Очікується", cls: "portal-badge-info" };
        }
        if (Number(kpiObj.contractValueMinor || 0) > 0) {
            return { key: "in_norm", label: "Оплати в нормі", cls: "portal-badge-neutral" };
        }
        return { key: "draft", label: "Умови не задані", cls: "portal-badge-neutral" };
    },

    async getPortfolioFinanceSummary() {
        const supabase = await getSupabase();
        if (!supabase) return { projects: [], currencyAggregates: {} };

        const [projRes, termsRes, schedRes, payRes, costRes] = await Promise.all([
            supabase.from("projects").select(`
                id, name, title, status, health, organization_id,
                organization:organization_id(id, name),
                responsible_pm:responsible_pm_id(id, full_name, avatar_url)
            `).order("name"),
            supabase.from("project_commercial_terms").select("*"),
            supabase.from("project_payment_schedule").select("*").order("due_date", { ascending: true }),
            supabase.from("project_payments").select("*"),
            supabase.from("project_costs").select("*")
        ]);

        const projects = projRes.data || [];
        const termsList = termsRes.data || [];
        const schedList = schedRes.data || [];
        const payList = payRes.data || [];
        const costList = costRes.data || [];

        const today = new Date().toISOString().split("T")[0];
        const currencyAggregates = {};

        const projectFinanceRows = projects.map(proj => {
            const terms = termsList.find(t => t.project_id === proj.id) || null;
            const schedules = schedList.filter(s => s.project_id === proj.id);
            const payments = payList.filter(p => p.project_id === proj.id);
            const costs = costList.filter(c => c.project_id === proj.id);

            const currency = terms?.currency || schedules[0]?.currency || "CZK";
            const contractValueMinor = terms ? Number(terms.contract_value_minor || 0) : 0;
            const collectedMinor = payments.reduce((sum, p) => sum + Number(p.amount_minor || 0), 0);
            const outstandingMinor = Math.max(contractValueMinor - collectedMinor, 0);

            let overdueMinor = 0;
            let nextPayment = null;

            schedules.forEach(s => {
                const sPayments = payments.filter(p => p.payment_schedule_id === s.id);
                const sPaid = sPayments.reduce((sum, p) => sum + Number(p.amount_minor || 0), 0);
                const sRemaining = Math.max(Number(s.amount_minor || 0) - sPaid, 0);

                if (s.status !== "cancelled" && sRemaining > 0) {
                    if (s.due_date < today) {
                        overdueMinor += sRemaining;
                    } else if (!nextPayment || s.due_date < nextPayment.due_date) {
                        nextPayment = { ...s, remainderMinor: sRemaining };
                    }
                }
            });

            const hasCostRecords = costs.length > 0;
            const plannedCostMinor = costs.filter(c => c.cost_type === "planned").reduce((sum, c) => sum + Number(c.amount_minor || 0), 0);
            const actualCostMinor = costs.filter(c => c.cost_type === "actual").reduce((sum, c) => sum + Number(c.amount_minor || 0), 0);
            const forecastResultMinor = hasCostRecords ? (contractValueMinor - plannedCostMinor) : null;
            const forecastMarginPercent = (hasCostRecords && contractValueMinor > 0) ? ((contractValueMinor - plannedCostMinor) / contractValueMinor) * 100 : null;

            const financialStatus = this.getProjectFinancialStatus({
                contractValueMinor,
                collectedMinor,
                outstandingMinor,
                overdueMinor,
                nextPayment
            });

            // Multi-currency bucket aggregation (strictly isolated per currency)
            if (!currencyAggregates[currency]) {
                currencyAggregates[currency] = {
                    currency,
                    contractValueMinor: 0,
                    collectedMinor: 0,
                    outstandingMinor: 0,
                    overdueMinor: 0,
                    plannedCostMinor: 0,
                    actualCostMinor: 0,
                    forecastResultMinor: 0,
                    hasCostRecords: false,
                    projectCount: 0
                };
            }

            currencyAggregates[currency].contractValueMinor += contractValueMinor;
            currencyAggregates[currency].collectedMinor += collectedMinor;
            currencyAggregates[currency].outstandingMinor += outstandingMinor;
            currencyAggregates[currency].overdueMinor += overdueMinor;
            currencyAggregates[currency].plannedCostMinor += plannedCostMinor;
            currencyAggregates[currency].actualCostMinor += actualCostMinor;
            if (hasCostRecords) {
                currencyAggregates[currency].forecastResultMinor += (contractValueMinor - plannedCostMinor);
                currencyAggregates[currency].hasCostRecords = true;
            }
            currencyAggregates[currency].projectCount += 1;

            return {
                project: proj,
                terms,
                schedules,
                payments,
                costs,
                currency,
                contractValueMinor,
                collectedMinor,
                outstandingMinor,
                overdueMinor,
                plannedCostMinor,
                actualCostMinor,
                forecastResultMinor,
                forecastMarginPercent,
                hasCostRecords,
                financialStatus,
                nextPayment
            };
        });

        return {
            rows: projectFinanceRows,
            currencyAggregates
        };
    },

    // -------------------------------------------------------------------------
    // Phase 5C.2: Billing, Invoices & Accounts Receivable (AR)
    // -------------------------------------------------------------------------

    async getBillingProfiles() {
        const supabase = await getSupabase();
        if (!supabase) return [];
        const { data, error } = await supabase
            .from("billing_profiles")
            .select("*")
            .order("is_active", { ascending: false })
            .order("created_at", { ascending: true });

        if (error) {
            console.error("[DataClient] Error fetching billing profiles:", error);
            return [];
        }
        return data || [];
    },

    async getInvoices(filters = {}) {
        const supabase = await getSupabase();
        if (!supabase) return [];
        let query = supabase
            .from("invoices")
            .select(`
                *,
                projects(id, title, organization_id, organizations(id, name)),
                billing_profiles(id, name, legal_name, iban, swift),
                project_payment_schedule(id, title, due_date)
            `)
            .order("created_at", { ascending: false });

        if (filters.organization_id) {
            query = query.eq("organization_id", filters.organization_id);
        }
        if (filters.project_id) {
            query = query.eq("project_id", filters.project_id);
        }
        if (filters.currency) {
            query = query.eq("currency", filters.currency);
        }
        if (filters.status && filters.status !== "all") {
            query = query.eq("status", filters.status);
        }
        if (filters.excludeDrafts) {
            query = query.neq("status", "draft");
        }

        const { data, error } = await query;
        if (error) {
            console.error("[DataClient] Error fetching invoices:", error);
            return [];
        }
        return data || [];
    },

    async getInvoiceById(id) {
        if (!id) return null;
        const supabase = await getSupabase();
        if (!supabase) return null;
        const { data: inv, error: invErr } = await supabase
            .from("invoices")
            .select(`
                *,
                projects(id, title, organization_id, organizations(id, name)),
                billing_profiles(id, name, legal_name, legal_address, billing_email, phone, bank_name, bank_account, iban, swift, tax_id, vat_number, registration_number, payment_instructions),
                project_payment_schedule(id, title, due_date, amount_minor)
            `)
            .eq("id", id)
            .single();

        if (invErr || !inv) {
            console.error("[DataClient] Error fetching invoice:", invErr);
            return null;
        }

        // Fetch line items
        const { data: items, error: itemsErr } = await supabase
            .from("invoice_items")
            .select("*")
            .eq("invoice_id", id)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true });

        // Fetch payments linked to this invoice
        const { data: payments, error: payErr } = await supabase
            .from("project_payments")
            .select("*")
            .eq("invoice_id", id)
            .order("paid_at", { ascending: false });

        return {
            ...inv,
            items: items || [],
            payments: payments || []
        };
    },

    async createDraftInvoice(invoiceData, itemsData = []) {
        const supabase = await getSupabase();
        if (!supabase) throw new Error("Database client not available");
        const user = PortalAuth.getUser();
        const payload = {
            organization_id: invoiceData.organization_id,
            project_id: invoiceData.project_id,
            billing_profile_id: invoiceData.billing_profile_id || null,
            payment_schedule_id: invoiceData.payment_schedule_id || null,
            commercial_terms_id: invoiceData.commercial_terms_id || null,
            currency: invoiceData.currency || "CZK",
            status: "draft",
            issue_date: invoiceData.issue_date || new Date().toISOString().split("T")[0],
            due_date: invoiceData.due_date,
            notes: invoiceData.notes || null,
            payment_instructions: invoiceData.payment_instructions || null,
            created_by: user?.id || null
        };

        const { data: invoice, error: invError } = await supabase
            .from("invoices")
            .insert(payload)
            .select()
            .single();

        if (invError) {
            console.error("[DataClient] Error creating invoice:", invError);
            throw invError;
        }

        if (itemsData.length > 0) {
            const formattedItems = itemsData.map((it, idx) => ({
                invoice_id: invoice.id,
                description: it.description || "Консалтингові послуги",
                quantity: Number(it.quantity || 1),
                unit_price_minor: Number(it.unit_price_minor || 0),
                tax_rate: Number(it.tax_rate || 0),
                sort_order: idx + 1
            }));

            const { error: itemsError } = await supabase
                .from("invoice_items")
                .insert(formattedItems);

            if (itemsError) {
                console.error("[DataClient] Error inserting invoice items:", itemsError);
                throw itemsError;
            }
        }

        return this.getInvoiceById(invoice.id);
    },

    async updateDraftInvoice(invoiceId, invoiceData, itemsData = null) {
        const supabase = await getSupabase();
        if (!supabase) throw new Error("Database client not available");
        const updatePayload = {};
        if (invoiceData.issue_date) updatePayload.issue_date = invoiceData.issue_date;
        if (invoiceData.due_date) updatePayload.due_date = invoiceData.due_date;
        if (invoiceData.billing_profile_id) updatePayload.billing_profile_id = invoiceData.billing_profile_id;
        if (invoiceData.payment_schedule_id !== undefined) updatePayload.payment_schedule_id = invoiceData.payment_schedule_id;
        if (invoiceData.notes !== undefined) updatePayload.notes = invoiceData.notes;
        if (invoiceData.payment_instructions !== undefined) updatePayload.payment_instructions = invoiceData.payment_instructions;
        if (invoiceData.currency) updatePayload.currency = invoiceData.currency;

        const { error: invErr } = await supabase
            .from("invoices")
            .update(updatePayload)
            .eq("id", invoiceId)
            .eq("status", "draft");

        if (invErr) {
            console.error("[DataClient] Error updating draft invoice:", invErr);
            throw invErr;
        }

        if (itemsData && Array.isArray(itemsData)) {
            // Delete old items and insert updated items
            await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

            if (itemsData.length > 0) {
                const formattedItems = itemsData.map((it, idx) => ({
                    invoice_id: invoiceId,
                    description: it.description || "Консалтингові послуги",
                    quantity: Number(it.quantity || 1),
                    unit_price_minor: Number(it.unit_price_minor || 0),
                    tax_rate: Number(it.tax_rate || 0),
                    sort_order: idx + 1
                }));

                const { error: itemsError } = await supabase
                    .from("invoice_items")
                    .insert(formattedItems);

                if (itemsError) {
                    console.error("[DataClient] Error updating invoice items:", itemsError);
                    throw itemsError;
                }
            }
        }

        return this.getInvoiceById(invoiceId);
    },

    async issueInvoice(invoiceId) {
        const supabase = await getSupabase();
        if (!supabase) throw new Error("Database client not available");
        const { data, error } = await supabase
            .rpc("issue_invoice", { p_invoice_id: invoiceId });

        if (error) {
            console.error("[DataClient] Error issuing invoice:", error);
            throw error;
        }
        return data;
    },

    async markInvoiceSent(invoiceId) {
        const supabase = await getSupabase();
        if (!supabase) throw new Error("Database client not available");
        const { data, error } = await supabase
            .rpc("mark_invoice_sent", { p_invoice_id: invoiceId });

        if (error) {
            console.error("[DataClient] Error marking invoice as sent:", error);
            throw error;
        }
        return data;
    },

    async markInvoiceViewed(invoiceId) {
        const supabase = await getSupabase();
        if (!supabase) throw new Error("Database client not available");
        const { data, error } = await supabase
            .rpc("mark_invoice_viewed", { p_invoice_id: invoiceId });

        if (error) {
            console.error("[DataClient] Error marking invoice as viewed:", error);
            throw error;
        }
        return data;
    },

    async cancelInvoice(invoiceId, reason = "Скасовано користувачем") {
        const supabase = await getSupabase();
        if (!supabase) throw new Error("Database client not available");
        const { data, error } = await supabase
            .rpc("cancel_invoice", { p_invoice_id: invoiceId, p_reason: reason });

        if (error) {
            console.error("[DataClient] Error cancelling invoice:", error);
            throw error;
        }
        return data;
    },

    async recordInvoicePayment(paymentData) {
        const supabase = await getSupabase();
        if (!supabase) throw new Error("Database client not available");
        const user = PortalAuth.getUser();
        const payload = {
            organization_id: paymentData.organization_id,
            project_id: paymentData.project_id,
            invoice_id: paymentData.invoice_id || null,
            payment_schedule_id: paymentData.payment_schedule_id || null,
            amount_minor: Number(paymentData.amount_minor),
            currency: paymentData.currency,
            paid_at: paymentData.paid_at || new Date().toISOString(),
            payment_method: paymentData.payment_method || "bank_transfer",
            reference: paymentData.reference || null,
            comment: paymentData.comment || null,
            created_by: user?.id || null
        };

        const { data, error } = await supabase
            .from("project_payments")
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error("[DataClient] Error recording invoice payment:", error);
            throw error;
        }
        return data;
    },

    async getAccountsReceivableSummary() {
        const invoices = await this.getInvoices({ excludeDrafts: true });
        const today = new Date().toISOString().split("T")[0];
        const todayDate = new Date(today);

        const currencyAR = {};

        invoices.forEach(inv => {
            if (inv.status === "cancelled") return;

            const curr = inv.currency || "CZK";
            if (!currencyAR[curr]) {
                currencyAR[curr] = {
                    currency: curr,
                    totalInvoicedMinor: 0,
                    totalCollectedMinor: 0,
                    totalOutstandingMinor: 0,
                    totalOverdueMinor: 0,
                    overdueCount: 0,
                    invoiceCount: 0,
                    agingBuckets: {
                        notDueMinor: 0,
                        days1_7Minor: 0,
                        days8_30Minor: 0,
                        days31_60Minor: 0,
                        days61_90Minor: 0,
                        days90PlusMinor: 0
                    },
                    invoices: []
                };
            }

            const total = Number(inv.total_minor || 0);
            const paid = Number(inv.paid_minor || 0);
            const outstanding = Math.max(total - paid, 0);

            currencyAR[curr].totalInvoicedMinor += total;
            currencyAR[curr].totalCollectedMinor += paid;
            currencyAR[curr].totalOutstandingMinor += outstanding;
            currencyAR[curr].invoiceCount += 1;

            let daysOverdue = 0;
            const dueDate = new Date(inv.due_date);
            const diffTime = todayDate - dueDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (outstanding > 0 && diffDays > 0) {
                daysOverdue = diffDays;
                currencyAR[curr].totalOverdueMinor += outstanding;
                currencyAR[curr].overdueCount += 1;

                if (daysOverdue <= 7) {
                    currencyAR[curr].agingBuckets.days1_7Minor += outstanding;
                } else if (daysOverdue <= 30) {
                    currencyAR[curr].agingBuckets.days8_30Minor += outstanding;
                } else if (daysOverdue <= 60) {
                    currencyAR[curr].agingBuckets.days31_60Minor += outstanding;
                } else if (daysOverdue <= 90) {
                    currencyAR[curr].agingBuckets.days61_90Minor += outstanding;
                } else {
                    currencyAR[curr].agingBuckets.days90PlusMinor += outstanding;
                }
            } else if (outstanding > 0) {
                currencyAR[curr].agingBuckets.notDueMinor += outstanding;
            }

            currencyAR[curr].invoices.push({
                ...inv,
                daysOverdue,
                isOverdue: daysOverdue > 0 && outstanding > 0
            });
        });

        return {
            currencyAR,
            rawInvoices: invoices
        };
    },

    async getInvoiceAuditEvents(invoiceId) {
        if (!invoiceId) return [];
        const supabase = await getSupabase();
        if (!supabase) return [];
        const { data, error } = await supabase
            .from("invoice_audit_events")
            .select("*")
            .eq("invoice_id", invoiceId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[DataClient] Error fetching invoice audit events:", error);
            return [];
        }
        return data || [];
    }
};


