import os

file_path = r"d:\AI ALL\FIRSTWIN\index.html"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

import re

# Replace Nav
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
content = re.sub(r'<nav class="nav-menu" id="nav-menu">.*?</nav>', new_nav, content, flags=re.DOTALL)

# Replace Header actions
new_actions = """            <div class="header-actions">
                <a href="#/consultation" class="btn btn-primary btn-sm header-cta">
                    <span>Забронювати консультацію</span>
                    <i data-lucide="calendar"></i>
                </a>
                <button class="mobile-toggle" id="mobile-toggle" aria-label="Toggle Menu">"""
content = re.sub(r'<div class="header-actions">.*?<button class="mobile-toggle"', new_actions, content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
