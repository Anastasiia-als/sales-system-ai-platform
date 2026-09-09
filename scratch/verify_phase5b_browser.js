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

    console.log("=== 1. Login as Owner via Standard Portal Auth ===");
    await page.goto('http://localhost:8002/#/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
    await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
    await page.type('#auth-password', process.env.TEST_OWNER_PASSWORD || process.env.OWNER_PASSWORD);
    await page.click('#btn-submit-pwd');

    console.log("\n=== 2. Verify Header Bell & Dropdown Flyout ===");
    await page.waitForSelector('#btn-portal-shell-bell', { timeout: 12000 });
    await new Promise(r => setTimeout(r, 1000));

    const bellState = await page.evaluate(() => {
        const bellBtn = document.getElementById('btn-portal-shell-bell');
        const badge = document.getElementById('portal-shell-bell-badge');
        return {
            hasBell: Boolean(bellBtn),
            badgeVisible: badge && badge.style.display !== 'none',
            badgeCount: badge?.innerText?.trim()
        };
    });
    console.log("Bell initial state:", bellState);

    // Open bell dropdown
    await page.click('#btn-portal-shell-bell');
    await new Promise(r => setTimeout(r, 500));

    const dropdownItems = await page.evaluate(() => {
        const dd = document.getElementById('portal-bell-dropdown');
        const isVisible = dd && dd.style.display === 'block';
        const items = Array.from(document.querySelectorAll('.portal-bell-item')).map(item => ({
            title: item.querySelector('.portal-bell-item-title')?.innerText?.trim(),
            msg: item.querySelector('.portal-bell-item-msg')?.innerText?.trim(),
            meta: item.querySelector('.portal-bell-item-meta')?.innerText?.trim()
        }));
        return { isVisible, count: items.length, items };
    });
    console.log(`Dropdown opened (${dropdownItems.isVisible}), count: ${dropdownItems.count}`);

    console.log("\n=== 3. Navigate to Full Personal Inbox (#/portal/notifications) ===");
    await page.goto('http://localhost:8002/#/portal/notifications', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.portal-notif-item', { timeout: 12000 });

    const inboxState = await page.evaluate(() => {
        const title = document.querySelector('.portal-view-title')?.innerText?.trim();
        const unreadCount = document.getElementById('kpi-count-unread')?.innerText?.trim();
        const critCount = document.getElementById('kpi-count-critical')?.innerText?.trim();
        const todayCount = document.getElementById('kpi-count-today')?.innerText?.trim();
        const totalCount = document.getElementById('kpi-count-total')?.innerText?.trim();
        const cards = Array.from(document.querySelectorAll('.portal-notif-item')).map(card => ({
            title: card.querySelector('span[style*="font-weight: 600"]')?.innerText?.trim(),
            badge: card.querySelector('.portal-badge')?.innerText?.trim(),
            msg: card.querySelector('p')?.innerText?.trim(),
            hasMarkReadBtn: Boolean(card.querySelector('.btn-notif-mark-read')),
            hasOpenBtn: Boolean(card.querySelector('.btn-notif-open'))
        }));
        return {
            title,
            unreadCount,
            critCount,
            todayCount,
            totalCount,
            cardsCount: cards.length,
            cards
        };
    });
    console.log("Inbox State:\n", JSON.stringify(inboxState, null, 2));

    console.log("\n=== 4. Test Category Filter (Pill Click) ===");
    await page.click('button[data-filter="critical"]');
    await new Promise(r => setTimeout(r, 400));
    const critCardsCount = await page.evaluate(() => document.querySelectorAll('.portal-notif-item').length);
    console.log("Critical filter cards count:", critCardsCount, "(Expected: >= 2)");

    await page.click('button[data-filter="all"]');
    await new Promise(r => setTimeout(r, 400));

    console.log("\n=== 5. Test Search Filtering ===");
    await page.type('#notifications-search-input', 'аудиту');
    await new Promise(r => setTimeout(r, 400));
    const searchCards = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.portal-notif-item')).map(c => c.innerText.trim());
    });
    console.log("Search 'аудиту' results count:", searchCards.length, "(Expected: >= 1)");

    console.log("\n=== 6. Test Mark All as Read Action ===");
    // Clear search
    await page.evaluate(() => {
        const input = document.getElementById('notifications-search-input');
        if (input) input.value = '';
    });
    await page.click('button[data-filter="all"]');
    await new Promise(r => setTimeout(r, 300));

    await page.click('#btn-mark-all-read');
    await new Promise(r => setTimeout(r, 800));

    const postMarkAllState = await page.evaluate(() => {
        const unreadCount = document.getElementById('kpi-count-unread')?.innerText?.trim();
        const badgeCount = document.getElementById('portal-shell-bell-badge')?.innerText?.trim();
        const unreadDots = document.querySelectorAll('.portal-unread-dot').length;
        return { unreadCount, badgeCount, unreadDots };
    });
    console.log("Post Mark All Read state:", postMarkAllState);

    console.log("\n=== 7. Verify Dashboard Notifications Widget (#/portal/dashboard) ===");
    await page.goto('http://localhost:8002/#/portal/dashboard', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.portal-recent-notifications-list', { timeout: 10000 });

    const dashboardWidgetState = await page.evaluate(() => {
        const widget = document.querySelector('.portal-recent-notifications-list');
        const notifCards = widget ? widget.querySelectorAll('.portal-dashboard-notif-card').length : 0;
        const viewAllLink = document.querySelector('a[href="#/portal/notifications"]');
        return {
            hasWidget: Boolean(widget),
            notifCardsCount: notifCards,
            hasViewAllLink: Boolean(viewAllLink)
        };
    });
    console.log("Dashboard widget state:", dashboardWidgetState);

    // Final Assertions
    console.log("\n=== Final Verification Assertions ===");
    console.log("1. Bell Button present:", bellState.hasBell);
    console.log("2. Dropdown opens with items:", dropdownItems.isVisible && dropdownItems.count >= 5);
    console.log("3. Inbox Title matches 'Центр сповіщень':", inboxState.title === 'Центр сповіщень');
    console.log("4. Inbox loaded cards:", inboxState.cardsCount >= 5);
    console.log("5. Category filter works:", critCardsCount >= 2);
    console.log("6. Search works:", searchCards.length >= 1);
    console.log("7. Mark all read updates unread counter to 0:", postMarkAllState.unreadCount === '0');
    console.log("8. Dashboard Widget present:", dashboardWidgetState.hasWidget && dashboardWidgetState.notifCardsCount >= 5);
    console.log("9. Console runtime errors:", consoleErrors.length === 0 ? "0 (PASS)" : consoleErrors);

    await browser.close();

    if (consoleErrors.length > 0 || !bellState.hasBell || inboxState.title !== 'Центр сповіщень') {
        process.exit(1);
    }
}

main().catch(console.error);
