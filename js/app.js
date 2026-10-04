/* js/app.js - Main Application Entrypoint */

import { Router } from "./router.js?v=phase7a_r2";
import { Chat } from "./components/chat.js";
import { BottomLeadForm } from "./components/bottom-lead-form.js";
import { captureAttribution } from "./marketing/attribution.js";
import { Consent } from "./marketing/consent.js";

function initApp() {
    // 0. Marketing: capture ad attribution (UTM/click IDs) and show consent banner
    captureAttribution();
    Consent.init();

    // 1. Initialize Client-Side Router
    Router.init();

    // 2. Initialize Support Chat (Telegram Simulator)
    Chat.init();

    // 2.1. Initialize Bottom Fast Lead Form
    BottomLeadForm.init();

    // 3. Mobile Navigation Menu Toggle
    const menuToggle = document.getElementById("mobile-toggle");
    const navMenu = document.getElementById("nav-menu");

    if (menuToggle && navMenu) {
        menuToggle.addEventListener("click", () => {
            navMenu.classList.toggle("active");
            
            // Toggle burger/close icon inside button if applicable
            const icon = menuToggle.querySelector("i");
            if (icon && window.lucide) {
                const isOpened = navMenu.classList.contains("active");
                icon.setAttribute("data-lucide", isOpened ? "x" : "menu");
                window.lucide.createIcons();
            }
        });
    }

    // 4. Initial Global Lucide Icons Rendering
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}

