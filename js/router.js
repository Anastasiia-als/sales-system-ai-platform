/* js/router.js - Client-Side Hash Router */
import { trackPageView, trackViewOffer } from "./marketing/analytics.js";
import { Home } from "./pages/home.js";
import { Services } from "./pages/services.js";
import { Audit } from "./pages/audit.js";
import { Scripts } from "./pages/scripts.js";
import { Trainings } from "./pages/trainings.js";
import { Automation } from "./pages/automation.js";
import { Consultation } from "./pages/consultation.js";
import { Support } from "./pages/support.js";
import { About } from "./pages/about.js";
import { Cases } from "./pages/cases.js";
import { Blog } from "./pages/blog.js";
import { Success } from "./pages/success.js";
import { ErrorPage } from "./pages/error.js";
import { Privacy } from "./pages/privacy.js";
import { Refund } from "./pages/refund.js";
import { Contacts } from "./pages/contacts.js";
import { AiSolutions } from "./pages/ai-solutions.js";
import { Admin } from "./pages/admin.js";
import { PortalPage } from "./pages/portal-page.js?v=phase7a_r2";
import { ClientPage } from "./pages/client-page.js";
import { PublicActionPage } from "./pages/public-action-page.js";

const routes = {
  "/": Home,
  "/services": Services,
  "/audit": Audit,
  "/scripts": Scripts,
  "/trainings": Trainings,
  "/automation": Automation,
  "/ai-solutions": AiSolutions,
  "/consultation": Consultation,
  "/support": Support,
  "/about": About,
  "/cases": Cases,
  "/blog": Blog,
  "/success": Success,
  "/error": ErrorPage,
  "/privacy": Privacy,
  "/refund": Refund,
  "/contacts": Contacts,
  "/admin": Admin,
  "/portal": PortalPage,
  "/client": ClientPage,
  "/action": PublicActionPage
};

// Route → advertising offer mapping (docs/technical-specs/ads_utm_naming.md)
const OFFER_ROUTES = {
  "/ai-solutions": "aiauto",
  "/automation": "aiauto",
  "/audit": "audit",
  "/support": "salesdept",
  "/consultation": "consult"
};

export const Router = {
  init() {
    window.addEventListener('hashchange', this.handleRouting.bind(this));
    // Immediately execute routing on initialization
    this.handleRouting();
  },
  
  handleRouting() {
    let hash = window.location.hash.slice(1) || "/";
    const isPortal = hash.startsWith('/portal');
    const isClient = hash.startsWith('/client');
    const isAction = hash.startsWith('/action');
    const isWorkspace = isPortal || isClient || isAction;
    
    if (isWorkspace) {
      document.documentElement.classList.add('portal-active');
      document.body.classList.add('portal-active');
    } else {
      document.documentElement.classList.remove('portal-active');
      document.body.classList.remove('portal-active');
    }

    if (isClient) {
      document.documentElement.classList.add('client-active');
      document.body.classList.add('client-active');
    } else {
      document.documentElement.classList.remove('client-active');
      document.body.classList.remove('client-active');
    }

    if (isAction) {
      document.documentElement.classList.add('public-action-active');
      document.body.classList.add('public-action-active');
    } else {
      document.documentElement.classList.remove('public-action-active');
      document.body.classList.remove('public-action-active');
    }

    const bottomLeadSection = document.getElementById("bottom-lead-section");
    if (bottomLeadSection) {
      const hideOn = ["/consultation", "/success", "/error"];
      if (isWorkspace || hideOn.includes(hash)) {
        bottomLeadSection.style.display = "none";
      } else {
        bottomLeadSection.style.display = "";
      }
    }

    const app = document.getElementById("app-content");
    if (!app) return;

    const navMenu = document.getElementById("nav-menu");
    
    // Update active nav link for public website
    if (navMenu && !isWorkspace) {
      const links = navMenu.querySelectorAll('.nav-link');
      links.forEach(link => link.classList.remove('active'));
      const activeLink = navMenu.querySelector(`a[href="#${hash}"]`);
      if (activeLink) {
        activeLink.classList.add('active');
        if (activeLink.classList.contains('dropdown-item')) {
          activeLink.closest('.dropdown')?.querySelector('.dropdown-toggle')?.classList.add('active');
        }
      }
    }
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Marketing analytics: SPA page_view + view_offer for public pages only (NEVER for /action or workspace)
    if (!isWorkspace) {
      try {
        trackPageView();
        if (OFFER_ROUTES[hash]) {
          trackViewOffer(OFFER_ROUTES[hash]);
        }
      } catch (e) {
        console.error("[Router] Analytics tracking failed:", e);
      }
    }

    const executeRoute = () => {
      try {
        // Update canonical and og:url for the current route
        try {
          const canonicalHref = hash === "/" ? "https://firstwin.pro/" : `https://firstwin.pro/#${hash}`;
          let canonicalEl = document.querySelector('link[rel="canonical"]');
          if (!canonicalEl) {
            canonicalEl = document.createElement("link");
            canonicalEl.setAttribute("rel", "canonical");
            document.head.appendChild(canonicalEl);
          }
          canonicalEl.setAttribute("href", canonicalHref);

          let ogUrlEl = document.querySelector('meta[property="og:url"]');
          if (ogUrlEl) {
            ogUrlEl.setAttribute("content", canonicalHref);
          }
        } catch (tagErr) {
          console.warn("[Router] Could not update canonical tag:", tagErr);
        }
        let page = routes[hash];
        if (!page && hash.startsWith("/portal")) {
          page = PortalPage;
        }
        if (!page && hash.startsWith("/client")) {
          page = ClientPage;
        }
        if (!page && hash.startsWith("/action")) {
          page = PublicActionPage;
        }
        if (!page) {
          page = Home;
        }

        app.innerHTML = page.render();
        
        if (typeof page.init === "function") {
          page.init();
        }
        
        if (window.lucide) {
          window.lucide.createIcons();
        }
      } catch (err) {
        console.error("[Router] Error rendering route:", hash, err);
        if (isWorkspace) {
          app.innerHTML = `
            <div class="portal-wrapper" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-dark);">
              <div class="portal-empty-state" style="max-width: 480px; padding: 40px 24px; text-align: center;">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                <div class="portal-empty-title" style="font-size: 1.3rem; margin-bottom: 8px;">Помилка завантаження розділу</div>
                <div class="portal-empty-desc" style="margin-bottom: 20px; color: var(--text-secondary);">
                  ${err?.message || "Виникла непередбачена помилка під час відкриття сторінки."}
                </div>
                <button class="btn btn-primary" onclick="window.location.reload()">
                  <i data-lucide="refresh-cw"></i> Оновити сторінку
                </button>
              </div>
            </div>
          `;
        } else {
          app.innerHTML = `
            <div class="container" style="padding: 80px 20px; text-align: center;">
              <h2>Помилка завантаження сторінки</h2>
              <p style="color: var(--text-secondary); margin: 12px 0 24px;">${err?.message || "Будь ласка, спробуйте оновити сторінку."}</p>
              <button class="btn btn-primary" onclick="window.location.reload()">Оновити</button>
            </div>
          `;
        }
        if (window.lucide) window.lucide.createIcons();
      }
    };

    if (isWorkspace) {
      // Instant execution for Workspace (Portal & Client) to prevent flash and infinite spinners
      executeRoute();
    } else {
      app.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
      setTimeout(executeRoute, 150);
    }
  }
};
