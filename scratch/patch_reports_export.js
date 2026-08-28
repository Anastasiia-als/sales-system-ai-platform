const fs = require('fs');
let code = fs.readFileSync('js/portal/ui/portal-reports-view.js', 'utf8');

// Replace the CSV logic
const csvLogicReplace = `
    document.getElementById("btn-export-report-csv")?.addEventListener("click", () => {
        const text = document.getElementById("report-render-card")?.innerText || "";
        const blob = new Blob(["\\uFEFF" + text], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", \`firstwin_report_\${reportsState.reportType}_\${new Date().toISOString().slice(0, 10)}.csv\`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });`;

const newCsvLogic = `
    document.getElementById("btn-export-report-csv")?.addEventListener("click", () => {
        let csvContent = "\\uFEFF";
        const rows = generateReportAoA(reportsState.reportType, reportData);
        rows.forEach(rowArray => {
            const row = rowArray.map(cell => {
                let text = cell === null || cell === undefined ? "" : String(cell);
                if (cell instanceof Date) {
                    text = cell.toISOString().slice(0, 10);
                }
                return \`"\${text.replace(/"/g, '""')}"\`;
            });
            csvContent += row.join(",") + "\\n";
        });
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", \`firstwin_report_\${reportsState.reportType}_\${new Date().toISOString().slice(0, 10)}.csv\`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
`;

// Replace the XLSX logic
const xlsxLogicReplace = `
    document.getElementById("btn-export-report-xlsx")?.addEventListener("click", () => {
        if (typeof XLSX === "undefined") {
            alert("XLSX generator is loading, please try CSV export.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const table = document.querySelector("#report-render-card table");
        if (table) {
            const ws = XLSX.utils.table_to_sheet(table);
            XLSX.utils.book_append_sheet(wb, ws, "Report");
        } else {
            const lines = (document.getElementById("report-render-card")?.innerText || "").split("\\n").map(l => [l]);
            const ws = XLSX.utils.aoa_to_sheet(lines);
            XLSX.utils.book_append_sheet(wb, ws, "Report");
        }
        XLSX.writeFile(wb, \`firstwin_report_\${reportsState.reportType}_\${new Date().toISOString().slice(0, 10)}.xlsx\`, { bookType: "xlsx" });
    });`;

const newXlsxLogic = `
    document.getElementById("btn-export-report-xlsx")?.addEventListener("click", () => {
        if (typeof XLSX === "undefined") {
            alert("XLSX generator is loading, please try CSV export.");
            return;
        }

        const rows = generateReportAoA(reportsState.reportType, reportData);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true, dateNF: "yyyy-mm-dd" });
        
        // Add number formatting for financial columns
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = {c:C, r:R};
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                const cell = ws[cell_ref];
                if (cell && cell.t === 'n') {
                    cell.z = '#,##0.00'; // Standard numeric format
                }
            }
        }
        
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, \`firstwin_report_\${reportsState.reportType}_\${new Date().toISOString().slice(0, 10)}.xlsx\`, { bookType: "xlsx" });
    });
}

function parseDate(dStr) {
    if (!dStr) return null;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
}

function generateReportAoA(reportType, reportData) {
    const rows = [];
    if (reportType === "client_report") {
        rows.push(["Клієнт / Організація", "Статус", "Проєкти (Активні)", "Проєкти (Завершені)", "Прострочені задачі", "Дії клієнта", "Документи на погодженні", "Наступна зустріч"]);
        (reportData.clients || []).forEach(c => {
            rows.push([
                c.name, c.status || 'active', c.active_projects_count || 0, c.completed_projects_count || 0,
                c.overdue_tasks_count || 0, c.client_actions_pending || 0, c.docs_awaiting_approval || 0,
                parseDate(c.next_meeting_date)
            ]);
        });
    } else if (reportType === "projects_status") {
        rows.push(["Проєкт", "Клієнт", "Керівник (PM)", "Статус", "Стан (Health)", "Етапи (Завершено)", "Етапи (Всього)", "Задачі (Відкриті)", "Задачі (Прострочені)", "Дедлайн"]);
        (reportData.projects || []).forEach(p => {
            rows.push([
                p.title, p.organization_name, p.pm_name || '—', p.status, p.health,
                p.completed_milestones || 0, p.total_milestones || 0, p.open_tasks || 0, p.overdue_tasks || 0,
                parseDate(p.target_end_date)
            ]);
        });
    } else if (reportType === "delivery_performance") {
        const rates = reportData.delivery_rates || {};
        rows.push(["Metric", "Rate (%)"]);
        rows.push(["Відсоток етапів", rates.milestone_completion_rate]);
        rows.push(["Відсоток задач", rates.tasks_completion_rate]);
        rows.push(["Відсоток прострочень", rates.overdue_task_rate]);
        rows.push(["Вчасна здача (OTD)", rates.on_time_delivery_rate]);
        rows.push(["Відсоток завершених", rates.project_completion_rate]);
        rows.push([]);
        rows.push(["Проєкт", "Клієнт", "Статус", "Стан", "Прогрес (%)", "Прострочені задачі"]);
        (reportData.projects || []).forEach(p => {
            rows.push([p.title, p.organization_name, p.status, p.health, p.progress_percent || 0, p.overdue_tasks || 0]);
        });
    } else if (reportType === "finance_summary") {
        rows.push(["Валюта", "Контракт", "Виставлено", "Отримано", "Очікується", "Планові витрати", "Прогнозний результат", "Прострочено (Overdue)", "Маржа (%)"]);
        const finances = reportData.financial_analytics || {};
        Object.keys(finances).forEach(curr => {
            const f = finances[curr] || {};
            rows.push([
                curr, (f.contract_value_minor || 0) / 100, (f.invoiced_minor || 0) / 100, (f.received_minor || 0) / 100,
                (f.outstanding_minor || 0) / 100, (f.planned_costs_minor || 0) / 100, (f.forecast_result_minor || 0) / 100,
                (f.overdue_minor || 0) / 100, f.forecast_margin_pct
            ]);
        });
    } else if (reportType === "accounts_receivable") {
        rows.push(["Рахунок №", "Організація", "Проєкт", "Валюта", "Сума", "Оплачено", "Заборгованість", "Термін оплати", "Прострочено (днів)", "Статус"]);
        (reportData.invoices || []).forEach(inv => {
            rows.push([
                inv.invoice_number || 'Чернетка', inv.organization_name, inv.project_title, inv.currency,
                (inv.total_minor || 0) / 100, (inv.paid_minor || 0) / 100, (inv.outstanding_minor || 0) / 100,
                parseDate(inv.due_date), inv.days_overdue || 0, inv.status
            ]);
        });
    } else if (reportType === "pm_workload") {
        rows.push(["Спеціаліст / Керівник", "Роль", "Активні проєкти", "Відкриті задачі", "Прострочені задачі", "Високий пріоритет", "Дедлайни (7 днів)"]);
        (reportData.team_workload || []).forEach(w => {
            rows.push([
                w.full_name || w.email, w.global_role, w.active_projects || 0, w.open_tasks || 0,
                w.overdue_tasks || 0, w.high_priority_tasks || 0, w.upcoming_deadlines_7d || 0
            ]);
        });
    } else { // portfolio_summary
        const summary = reportData.summary || {};
        const kpis = summary.executive_kpis || {};
        const rates = summary.delivery_rates || {};
        rows.push(["Metric", "Value"]);
        rows.push(["Активні проєкти", kpis.active_projects || 0]);
        rows.push(["Всього проєктів", kpis.total_projects || 0]);
        rows.push(["Проєкти у ризику", kpis.at_risk_projects || 0]);
        rows.push(["Вчасна здача (OTD)", rates.on_time_delivery_rate]);
        rows.push(["Прострочені задачі", kpis.overdue_tasks || 0]);
        rows.push([]);
        rows.push(["Валюта", "Контракт", "Отримано", "Дебіторка (AR)", "Прострочено"]);
        const finances = summary.financial_analytics || {};
        Object.keys(finances).forEach(curr => {
            const f = finances[curr];
            rows.push([
                curr, (f.contract_value_minor || 0) / 100, (f.received_minor || 0) / 100,
                (f.outstanding_minor || 0) / 100, (f.overdue_minor || 0) / 100
            ]);
        });
    }
    return rows;
`;

// Only replace if we haven't already replaced it to avoid duplication or errors
if (code.includes('const text = document.getElementById("report-render-card")?.innerText || "";')) {
    code = code.replace(csvLogicReplace, newCsvLogic);
}
if (code.includes('const ws = XLSX.utils.table_to_sheet(table);')) {
    code = code.replace(xlsxLogicReplace, newXlsxLogic);
}

fs.writeFileSync('js/portal/ui/portal-reports-view.js', code);
console.log("Patched portal-reports-view.js export logic!");
