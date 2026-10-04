/* js/components/chat.js - Support Chat Widget (Telegram Simulator) */

import { State } from "../state.js";
import { Toast } from "./notifications.js";

export const Chat = {
    init() {
        const toggleBtn = document.getElementById("chat-toggle");
        const chatWindow = document.getElementById("chat-window");
        const closeBtn = document.getElementById("chat-window-close");
        const chatMessages = document.getElementById("chat-messages");
        const chatForm = document.getElementById("chat-form");
        const chatInput = document.getElementById("chat-input");
        const quickReplyBtns = document.querySelectorAll(".quick-reply-btn");
        const badge = toggleBtn?.querySelector(".chat-badge");

        if (!toggleBtn || !chatWindow || !chatMessages || !chatForm) return;

        // Toggle chat window open/close
        toggleBtn.addEventListener("click", () => {
            chatWindow.classList.toggle("hidden");
            
            // Toggle icons
            const openIcon = toggleBtn.querySelector(".chat-open-icon");
            const closeIcon = toggleBtn.querySelector(".chat-close-icon");
            
            if (openIcon && closeIcon) {
                openIcon.classList.toggle("hidden");
                closeIcon.classList.toggle("hidden");
            }
            
            // Remove notification badge on first open
            if (badge) {
                badge.style.display = "none";
            }
            
            this.scrollToBottom();
        });

        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                chatWindow.classList.add("hidden");
                const openIcon = toggleBtn.querySelector(".chat-open-icon");
                const closeIcon = toggleBtn.querySelector(".chat-close-icon");
                if (openIcon && closeIcon) {
                    openIcon.classList.remove("hidden");
                    closeIcon.classList.add("hidden");
                }
            });
        }

        // Quick replies handler
        quickReplyBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const text = btn.getAttribute("data-reply") || btn.textContent;
                this.handleUserMessage(text);
                
                // Hide quick replies container after selection
                const quickRepliesContainer = chatMessages.querySelector(".chat-quick-replies");
                if (quickRepliesContainer) {
                    quickRepliesContainer.remove();
                }
            });
        });

        // Form submit handler
        chatForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (!text) return;
            
            this.handleUserMessage(text);
            chatInput.value = "";
        });
    },

    scrollToBottom() {
        const chatMessages = document.getElementById("chat-messages");
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    },

    appendMessage(text, isSent = false) {
        const chatMessages = document.getElementById("chat-messages");
        if (!chatMessages) return;

        const bubble = document.createElement("div");
        bubble.className = `chat-bubble ${isSent ? 'sent' : 'received'}`;
        bubble.innerHTML = text.replace(/\n/g, "<br>");
        
        chatMessages.appendChild(bubble);
        this.scrollToBottom();
    },

    appendTypingIndicator() {
        const chatMessages = document.getElementById("chat-messages");
        if (!chatMessages) return null;

        const typing = document.createElement("div");
        typing.className = "chat-bubble received typing-indicator-bubble";
        typing.id = "chat-typing-indicator";
        typing.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        chatMessages.appendChild(typing);
        this.scrollToBottom();
        return typing;
    },

    removeTypingIndicator() {
        const indicator = document.getElementById("chat-typing-indicator");
        if (indicator) {
            indicator.remove();
        }
    },

    handleUserMessage(text) {
        // Render sent message
        this.appendMessage(text, true);

        // Show typing indicator
        this.appendTypingIndicator();

        // Simulate expert reply delay
        setTimeout(() => {
            this.removeTypingIndicator();
            const reply = this.generateResponse(text);
            this.appendMessage(reply, false);
        }, 1500);
    },

    generateResponse(userText) {
        const lower = userText.toLowerCase();
        
        // 1. Quick replies
        if (lower.includes("аудит воронки")) {
            return `🔍 Комплексний аудит воронки — це розбір 14 ключових блоків вашого відділу продажів. Я аналізую дзвінки, ведення CRM, скрипти та KPI.\n\nЗалиште назву компанії, ваш сайт та телефон тут, або запишіться на сторінці #/audit!`;
        }
        
        if (lower.includes("замовити скрипти")) {
            return `✍️ Скрипти мають допомагати менеджерам думати, а не повторювати шаблони. Я розробляю логічні карти діалогу з блоками роботи із запереченнями.\n\nЗалиште ваш номер телефону, і я зв'яжусь для обговорення деталей.`;
        }
        
        if (lower.includes("crm")) {
            return `⚙️ Ми інтегруємо KeyCRM, Pipedrive, Binotel, месенджери та шлюзи онлайн-оплат (mono, LiqPay, WayForPay) в єдину автоматизовану систему.\n\nЯка CRM у вас встановлена зараз? І який ваш контактний телефон?`;
        }
        
        if (lower.includes("запитання") || lower.includes("привіт")) {
            return `Привіт! Задавайте будь-яке запитання про продажі, навчання менеджерів, автоматизацію чи скрипти. Я тут, щоб допомогти!`;
        }

        // 2. Capture potential contacts (numbers or telegram usernames)
        const phoneRegex = /(?:\+38)?\s?\(?0\d{2}\)?\s?\d{3}\s?\d{2}\s?\d{2}/;
        const tgRegex = /@\w+/;
        
        const hasPhone = phoneRegex.test(userText);
        const hasTg = tgRegex.test(userText);
        
        if (hasPhone || hasTg) {
            // Register lead automatically
            const leadData = {
                name: "Лід з Онлайн-чату",
                phone: hasPhone ? userText.match(phoneRegex)[0] : "Вказано лише Telegram",
                telegram: hasTg ? userText.match(tgRegex)[0] : "Вказано лише телефон",
                email: "no-email@chat.mock",
                company: "Чат-контакт",
                business: "Діалог в чаті",
                problem: `Звернувся через чат із повідомленням: "${userText}"`,
                service: "express"
            };
            
            State.addLead(leadData);
            
            try {
                fetch("/api/lead-notify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Лід з Онлайн-чату",
                        phone: hasPhone ? userText.match(phoneRegex)[0] : "",
                        telegram: hasTg ? userText.match(tgRegex)[0] : "",
                        message: userText,
                        form_id: "online_chat"
                    })
                }).catch(() => {});
            } catch (e) {}
            
            // Trigger background sync toast
            Toast.success("CRM синхронізація", "Дані з чату автоматично надіслано в CRM та сповіщено Telegram-бота!");
            
            return `🚀 Дякую! Я отримав ваші контакти. Створив картку клієнта в CRM та надіслав сповіщення собі в Telegram.\n\nЗв'яжусь з вами протягом 15 хвилин для узгодження часу розмови!`;
        }

        // 3. Fallback standard reply
        return `Дякую за повідомлення! Я зафіксував ваше запитання.\n\nЗалиште, будь ласка, ваш номер телефону або нікнейм у Telegram, щоб я міг детально відповісти та надати безкоштовну експрес-консультацію.`;
    }
};

// Injection of CSS animations for typing dots
(() => {
    const style = document.createElement("style");
    style.textContent = `
        .typing-indicator-bubble {
            padding: 8px 14px !important;
            min-width: 50px;
        }
        .typing-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            height: 15px;
        }
        .typing-indicator span {
            display: block;
            width: 6px;
            height: 6px;
            background-color: var(--text-secondary);
            border-radius: 50%;
            animation: bounceTyping 1.3s infinite ease-in-out;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.3s; }
        
        @keyframes bounceTyping {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
        }
    `;
    document.head.appendChild(style);
})();
