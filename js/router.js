/* js/router.js - Client-Side Hash Router */
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
  "/admin": Admin
};

export const Router = {
  init() {
    window.addEventListener('hashchange', this.handleRouting.bind(this));
    window.addEventListener('load', this.handleRouting.bind(this));
  },
  
  handleRouting() {
    let hash = window.location.hash.slice(1) || "/";
    const app = document.getElementById("app-content");
    const navMenu = document.getElementById("nav-menu");
    
    app.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
    
    // Update active nav link
    if (navMenu) {
      const links = navMenu.querySelectorAll('.nav-link');
      links.forEach(link => link.classList.remove('active'));
      const activeLink = navMenu.querySelector(`a[href="#${hash}"]`);
      if (activeLink) {
        activeLink.classList.add('active');
        if (activeLink.classList.contains('dropdown-item')) {
          activeLink.closest('.dropdown').querySelector('.dropdown-toggle').classList.add('active');
        }
      }
    }
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setTimeout(() => {
      const page = routes[hash] || Home;
      app.innerHTML = page.render();
      
      if (typeof page.init === "function") {
        page.init();
      }
      
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, 300); // Simulate loading for premium feel
  }
};
