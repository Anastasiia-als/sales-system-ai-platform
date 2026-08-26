const puppeteer = require('puppeteer');

async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', err => {
        const str = err.toString();
        if (!str.includes('favicon.ico') && !str.includes('404')) consoleErrors.push(str);
    });
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const txt = msg.text();
            if (!txt.includes('favicon.ico') && !txt.includes('404')) consoleErrors.push(txt);
        }
    });

    console.log("=== 1. Clear Storage & Login as Owner ===");
    await page.goto('http://localhost:8002/#/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });

    await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
    await page.type('#auth-password', process.env.TEST_OWNER_PASSWORD || 'Password123!');
    await page.click('#btn-submit-pwd');

    console.log("\n=== 2. Navigate to Dashboard (#/portal/dashboard) ===");
    await page.waitForSelector('.portal-dashboard-kpi-card', { timeout: 15000 });

    const dashboardState = await page.evaluate(() => {
        const title = document.querySelector('.portal-view-title')?.innerText?.trim();
        const subtitle = document.querySelector('.portal-view-subtitle')?.innerText?.trim();
        
        // KPIs
        const kpiCards = Array.from(document.querySelectorAll('.portal-dashboard-kpi-card')).map(card => ({
            title: card.querySelector('.portal-kpi-card-title')?.innerText?.trim(),
            value: card.querySelector('.portal-kpi-card-value')?.innerText?.trim(),
            subtext: card.querySelector('.portal-kpi-card-footer')?.innerText?.trim()
        }));

        // Portfolio Table
        const portfolioRows = Array.from(document.querySelectorAll('.portal-dashboard-portfolio-table tbody tr')).map(row => {
            const cells = row.querySelectorAll('td');
            return {
                projectClient: cells[0]?.innerText?.trim(),
                pm: cells[1]?.innerText?.trim(),
                health: cells[2]?.innerText?.trim(),
                progress: cells[3]?.innerText?.trim(),
                currentStage: cells[4]?.innerText?.trim(),
                nextMilestone: cells[5]?.innerText?.trim(),
                tasks: cells[6]?.innerText?.trim()
            };
        });

        // Attention Center
        const attentionPills = Array.from(document.querySelectorAll('#attention-severity-pills button')).map(b => b.innerText.trim());
        const attentionCards = Array.from(document.querySelectorAll('.portal-attention-card')).map(c => ({
            badge: c.querySelector('.portal-badge')?.innerText?.trim(),
            tag: c.querySelector('.portal-tag')?.innerText?.trim(),
            desc: c.querySelector('div[style*="font-size: 0.86rem"]')?.innerText?.trim(),
            meta: c.querySelector('div[style*="font-size: 0.74rem"]')?.innerText?.trim()
        }));

        // Upcoming Meetings
        const meetings = Array.from(document.querySelectorAll('.portal-meeting-item-card')).map(m => ({
            title: m.querySelector('div[style*="font-weight: 600"]')?.innerText?.trim(),
            meta: m.querySelector('.portal-badge')?.innerText?.trim()
        }));

        // Client Actions
        const actions = Array.from(document.querySelectorAll('.portal-action-item-card')).map(a => ({
            title: a.querySelector('div[style*="font-weight: 600"]')?.innerText?.trim(),
            badge: a.querySelector('.portal-badge')?.innerText?.trim()
        }));

        // Team Workload
        const workload = Array.from(document.querySelectorAll('.portal-workload-member-item')).map(w => ({
            name: w.querySelector('div[style*="font-weight: 600"]')?.innerText?.trim(),
            role: w.querySelector('div[style*="font-size: 0.74rem"]')?.innerText?.trim()
        }));

        // Recent Activity
        const activities = Array.from(document.querySelectorAll('.portal-activity-timeline-item')).map(act => ({
            title: act.querySelector('div[style*="font-weight: 500"]')?.innerText?.trim(),
            meta: act.querySelector('div[style*="font-size: 0.75rem"]')?.innerText?.trim()
        }));

        const hasSpinner = Boolean(document.querySelector('.portal-spinner'));

        return {
            title,
            subtitle,
            kpiCards,
            portfolioRows,
            attentionPills,
            attentionCards,
            meetings,
            actions,
            workload,
            activities,
            hasSpinner
        };
    });

    console.log("Extracted Dashboard State:\n", JSON.stringify(dashboardState, null, 2));

    // Assertions
    console.log("\n=== Assertions ===");
    console.log("1. Title matches:", dashboardState.title === 'Командний центр');
    console.log("2. KPI cards count:", dashboardState.kpiCards.length, "(Expected: 6)");
    console.log("3. Portfolio rows count:", dashboardState.portfolioRows.length, "(Expected: >= 3)");
    console.log("4. Attention cards count:", dashboardState.attentionCards.length, "(Expected: >= 1)");
    console.log("5. Upcoming meetings count:", dashboardState.meetings.length, "(Expected: >= 1)");
    console.log("6. Client actions count:", dashboardState.actions.length, "(Expected: >= 1)");
    console.log("7. Team workload count:", dashboardState.workload.length, "(Expected: >= 1)");
    console.log("8. Recent activity count:", dashboardState.activities.length, "(Expected: >= 1)");
    console.log("9. Infinite spinner:", dashboardState.hasSpinner ? "YES (FAIL)" : "NO (PASS)");
    console.log("10. Console runtime errors:", consoleErrors.length === 0 ? "0 (PASS)" : consoleErrors);

    await browser.close();

    if (!dashboardState.title || dashboardState.kpiCards.length !== 6 || consoleErrors.length > 0) {
        process.exit(1);
    }
}

main().catch(console.error);
