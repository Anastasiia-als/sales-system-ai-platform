import os
import re

base_dir = r"d:\AI ALL\FIRSTWIN"

# 1. Update index.html
index_html_path = os.path.join(base_dir, "index.html")
with open(index_html_path, "r", encoding="utf-8") as f:
    index_content = f.read()

# Update Nav
new_nav = """            <nav class="nav-menu" id="nav-menu">
                <ul>
                    <li><a href="#/" class="nav-link active">Головна</a></li>
                    <li class="dropdown">
                        <a href="#/services" class="nav-link dropdown-toggle">Послуги <i data-lucide="chevron-down"></i></a>
                        <ul class="dropdown-menu">
                            <li><a href="#/audit" class="dropdown-item">Аудит відділу продажів</a></li>
                            <li><a href="#/scripts" class="dropdown-item">Скрипти продажів</a></li>
                            <li><a href="#/trainings" class="dropdown-item">Тренінги</a></li>
                            <li><a href="#/automation" class="dropdown-item">CRM та Автоматизація</a></li>
                            <li><a href="#/consultation" class="dropdown-item">Консультація</a></li>
                            <li><a href="#/support" class="dropdown-item">Супровід</a></li>
                        </ul>
                    </li>
                    <li><a href="#/cases" class="nav-link">Кейси / Задачі</a></li>
                    <li><a href="#/about" class="nav-link">Про мене</a></li>
                    <li><a href="#/blog" class="nav-link">Блог</a></li>
                    <li><a href="#/contacts" class="nav-link">Контакти</a></li>
                </ul>
            </nav>"""
index_content = re.sub(r'<nav class="nav-menu" id="nav-menu">.*?</nav>', new_nav, index_content, flags=re.DOTALL)

# Update Admin button to be hidden or moved to footer, and change Header CTA
new_actions = """            <div class="header-actions">
                <a href="#/consultation" class="btn btn-primary btn-sm header-cta">
                    <span>Забронювати консультацію</span>
                    <i data-lucide="calendar"></i>
                </a>
                <button class="mobile-toggle" id="mobile-toggle" aria-label="Toggle Menu">"""
index_content = re.sub(r'<div class="header-actions">.*?<button class="mobile-toggle"', new_actions, index_content, flags=re.DOTALL)

with open(index_html_path, "w", encoding="utf-8") as f:
    f.write(index_content)


# 2. Add Dropdown CSS to main.css
main_css_path = os.path.join(base_dir, "css", "main.css")
with open(main_css_path, "r", encoding="utf-8") as f:
    main_css = f.read()

if ".dropdown" not in main_css:
    dropdown_css = """
/* Dropdown Menu */
.dropdown {
    position: relative;
}
.dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    background: var(--bg-secondary);
    min-width: 240px;
    box-shadow: var(--shadow-lg);
    border-radius: var(--radius-md);
    padding: 12px 0;
    opacity: 0;
    visibility: hidden;
    transform: translateY(10px);
    transition: all var(--transition-fast);
    z-index: 100;
    border: 1px solid var(--border-color);
}
.dropdown:hover .dropdown-menu {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
}
.dropdown-item {
    display: block;
    padding: 10px 24px;
    color: var(--text-primary);
    font-size: 0.95rem;
    font-weight: 500;
    transition: var(--transition-fast);
}
.dropdown-item:hover {
    background: var(--bg-tertiary);
    color: var(--color-primary);
}
.dropdown-toggle i {
    width: 14px;
    height: 14px;
    margin-left: 4px;
    vertical-align: middle;
}
"""
    main_css += dropdown_css

    # Also update Premium colors
    main_css = main_css.replace("--bg-primary: #FAF9F6;", "--bg-primary: #0A0F1C;")
    main_css = main_css.replace("--bg-secondary: #FFFFFF;", "--bg-secondary: #111827;")
    main_css = main_css.replace("--bg-tertiary: #F1F3F5;", "--bg-tertiary: #1F2937;")
    main_css = main_css.replace("--text-primary: #0F172A;", "--text-primary: #F9FAFB;")
    main_css = main_css.replace("--text-secondary: #475569;", "--text-secondary: #D1D5DB;")
    main_css = main_css.replace("--color-primary: #1E3A8A;", "--color-primary: #3B82F6;")
    main_css = main_css.replace("--color-accent: #2563EB;", "--color-accent: #2563EB;")
    
    with open(main_css_path, "w", encoding="utf-8") as f:
        f.write(main_css)

print("HTML and CSS updated.")
