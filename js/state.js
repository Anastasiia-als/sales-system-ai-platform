/* js/state.js - State Management & Mock Database */

const DEFAULT_CASES = [
    {
        id: "case-1",
        title: "Збільшення конверсії відділу продажів B2B на 42% за 3 місяці",
        niche: "Гуртові поставки & B2B",
        problem: "Менеджери працювали хаотично, забували перезвонити клієнтам, CRM велась формально. Конверсія з ліда в оплату була всього 4.2%.",
        solution: "Провели повний аудит воронки, налаштували обов'язкові етапи в CRM, розробили скрипт кваліфікації та роботи із запереченням 'дорого'. Впровадили KPI за кількістю результативних дзвінків і контроль записів дзвінків.",
        resultMetrics: [
            { val: "+42%", lbl: "Конверсія" },
            { val: "100%", lbl: "CRM Дисципліна" },
            { val: "2.4x", lbl: "Рост прибутку" }
        ],
        metricsText: [
            "Конверсія в оплату зросла з 4.2% до 5.96%",
            "Впроваджено IP-телефонію та KeyCRM, 0 втрачених лідів",
            "Час відповіді на нову заявку скоротився з 4 годин до 8 хвилин"
        ],
        feedback: "Анастасія повністю переформатувала наше ставлення до продажів. Тепер ми бачимо кожну цифру та розуміємо, де втрачаємо гроші. Результат перевершив очікування. — Дмитро, власник компанії"
    },
    {
        id: "case-2",
        title: "Автоматизація обробки заявок в онлайн-школі з 0 до системи",
        niche: "EdTech / Онлайн-навчання",
        problem: "Клієнти залишали заявки на сайті, але менеджери зв'язувалися з ними через години або дні. Оплати приймали вручну, ліди губилися в Telegram-чатах.",
        solution: "Зв'язали сайт через API з CRM та платіжним шлюзом mono. Налаштували автоматичні Telegram-сповіщення для менеджерів про нові гарячі ліди. Додали автоматичні нагадування клієнтам в месенджери про початок вебінарів.",
        resultMetrics: [
            { val: "8х", lbl: "Швидкість обробки" },
            { val: "99%", lbl: "Автооплати" },
            { val: "-35%", lbl: "Ручна рутина" }
        ],
        metricsText: [
            "Автоматичне створення угоди та виставлення інвойсу в один клік",
            "Швидкість першого контакту скоротилась до 3 хвилин",
            "Менеджери перестали витрачати час на ручну перевірку виписок банку"
        ],
        feedback: "Завдяки автоматизації ми змогли масштабувати трафік втричі без найму нових менеджерів. Вся система працює як годинник. — Олена, керівник школи"
    },
    {
        id: "case-3",
        title: "Побудова відділу продажів з нуля для виробника меблів",
        niche: "Виробництво & E-commerce",
        problem: "Власник сам обробляв усі замовлення, через що не мав часу на розвиток бізнесу. Не було ні скриптів, ні регламентів, ні найнятого персоналу.",
        solution: "Написали профіль посади, допомогли найняти та адаптувати 3-х менеджерів за 2 тижні. Розробили скрипти продажів для прорахунку меблів та чек-лист контролю якості. Налаштували CRM Pipedrive та інтегрували Binotel.",
        resultMetrics: [
            { val: "3", lbl: "Менеджери у штаті" },
            { val: "14 днів", lbl: "Адаптація" },
            { val: "+85%", lbl: "Вільного часу власника" }
        ],
        metricsText: [
            "Повний вихід власника з оперативних продажів за 1 місяць",
            "Розроблено 4 детальних скрипти під різні типу меблів",
            "Конверсія відділу продажів на другий місяць склала 8.8%"
        ],
        feedback: "Я боявся віддати продажі іншим людям, думав, ніхто не продасть краще за мене. Анастасія побудувала систему, де дівчата продають краще і системніше за мене. Рекомендую! — Сергій, засновник бренду"
    }
];

const DEFAULT_ARTICLES = [
    {
        id: "post-1",
        title: "Чому CRM не працює, якщо її просто встановити: 5 головних помилок впровадження",
        category: "CRM & Автоматизація",
        date: "08 Червня 2026",
        readTime: "5 хв",
        summary: "Багато власників думають, що покупка ліцензії CRM вирішить проблеми з продажами. Але без регламентів, навчання та контролю система перетворюється на дорогу записну книжку.",
        content: `
            <p>Багато власників бізнесу стикаються з розчаруванням: купили ліцензію CRM, витратили гроші на інтеграцію, а продажі не зросли. Ба більше — менеджери саботують роботу, дані вносяться хаотично, а керівник все одно не розуміє реальної картини. Чому так відбувається?</p>
            
            <h2>Помилка 1. Відсутність чіткої воронки продажів</h2>
            <p>Перед налаштуванням CRM потрібно описати реальний шлях клієнта. Етапи на кшталт 'В роботі' або 'Думає' не дають розуміння. Статуси мають фіксувати конкретні дії: 'Кваліфікований', 'КП надіслано', 'Рахунок виставлено', 'Очікується оплата'.</p>
            
            <h2>Помилка 2. CRM-дисципліна не прописана в KPI</h2>
            <p>Якщо заповнення CRM — це додаткове необов'язкове завдання, менеджери не будуть його робити. Правило просте: 'Якщо події немає в CRM, її не було в природі'. Робота з системою має бути частиною щоденних KPI менеджерів.</p>

            <blockquote>
                \"Впровадження CRM — це на 20% технічне налаштування і на 80% зміна процесів та звичок команди.\"
            </blockquote>
            
            <h2>Помилка 3. Відсутність інтеграції з каналами зв'язку</h2>
            <p>Якщо дзвінки йдуть через особисті мобільні, а переписки — в особистих Telegram-акаунтах, CRM втрачає сенс. Потрібна повна інтеграція IP-телефонії та месенджерів. Керівник має в один клік слухати запис будь-якої розмови.</p>
            
            <h2>Як зробити, щоб CRM працювала?</h2>
            <p>Почніть з аудиту процесів, пропишіть регламент роботи в CRM, навчіть команду та введіть жорсткий контроль заповнення карток лідів. Без цього жодна автоматизація не дасть результату.</p>
        `
    },
    {
        id: "post-2",
        title: "Скрипти продажів: як вести клієнта до оплати, а не бути роботом-консультантом",
        category: "Скрипти продажів",
        date: "01 Червня 2026",
        readTime: "6 хв",
        summary: "Сухі шаблонні фрази дратують покупців і знижують конверсію. Розбираємо логіку гнучких скриптів, які допомагають виявити потребу і закрити угоду природно.",
        content: `
            <p>Коли ми чуємо слово 'скрипт', ми часто уявляємо монотонний голос менеджера банку, який читає заздалегідь написаний текст. Такі скрипти мертві. Вони вбивають продажі. Сучасний скрипт — це не догма, це гнучка дорожня карта діалогу.</p>
            
            <h2>Логіка діалогу замість тексту</h2>
            <p>Головне завдання скрипта — не дати менеджеру зачитати презентацію, а вести клієнта за етапами продажу:</p>
            <ul>
                <li><strong>Встановлення контакту:</strong> Перехоплення ініціативи та налаштування приязного тону.</li>
                <li><strong>Кваліфікація та виявлення потреб:</strong> Замість презентації задаємо питання. Хто задає питання — той керує діалогом.</li>
                <li><strong>Презентація рішення:</strong> Презентуємо продукт тільки під потреби клієнта, мовою його вигоди.</li>
                <li><strong>Робота з запереченнями:</strong> Логічні аргументи на 'дорого', 'я подумаю', 'вже працюємо з іншими'.</li>
                <li><strong>Закриття на наступний крок:</strong> Будь-яка розмова має закінчуватися конкретною домовленістю (зустріч, оплата, тест).</li>
            </ul>

            <blockquote>
                \"Клієнт платить не за характеристики продукту, а за вирішення своєї конкретної проблеми. Якщо ви не виявили біль клієнта, ваш скрипт безсилий.\"
            </blockquote>
            
            <h2>Чому менеджери саботують скрипти?</h2>
            <p>Часто скрипти пишуть копірайтери, які ніколи не дзвонили клієнтам. Скрипт має бути написаний розмовною мовою. Менеджер має розуміти логіку кожного етапу, а не просто зазубрювати фрази.</p>
        `
    },
    {
        id: "post-3",
        title: "Як побудувати систему контролю якості дзвінків у відділі продажів",
        category: "Управління продажами",
        date: "25 Травня 2026",
        readTime: "4 хв",
        summary: "Якщо ви не слухаєте дзвінки своїх менеджерів, ви не знаєте, чому клієнти не купують. Покроковий план побудови відділу контролю якості дзвінків.",
        content: `
            <p>Власники часто скаржаться: 'Ми запускаємо рекламу, отримуємо багато лідів, але продажів немає. Напевно, ліди нецільові'. Але коли ми починаємо слухати записи дзвінків менеджерів, волосся стає дибки.</p>
            
            <h2>Що насправді говорять ваші менеджери?</h2>
            <p>Типові проблеми при спілкуванні з клієнтами:</p>
            <ol>
                <li>Менеджери працюють як 'довідкове бюро' — відповідають на питання про ціну та кладуть слухавку, не намагаючись продати.</li>
                <li>Не пропонують додаткові товари (cross-sell/up-sell).</li>
                <li>Здаються при першому ж запереченні клієнта 'дорого'.</li>
                <li>Не узгоджують точний час наступного дзвінка.</li>
            </ol>
            
            <h2>Впроваджуємо чек-лист оцінки дзвінка</h2>
            <p>Створіть чек-лист з оцінкою від 0 до 100 балів. Критерії: привітання, кваліфікація, пропозиція, робота з запереченнями, фіксація домовленості, заповнення CRM. Керівник або спеціаліст з контролю якості має прослуховувати 3-5 дзвінків кожного менеджера щотижня та виставляти оцінки.</p>
        `
    }
];

const DEFAULT_LEADS = [
    {
        id: "lead-1",
        name: "Олександр Шевченко (Demo)",
        phone: "+38 (000) 500-12-34",
        email: "alex.demo@example.com",
        telegram: "@demo_client_1",
        company: "Demo Company A",
        site: "demo-company-a.com",
        business: "Гуртова торгівля будматеріалами",
        managers: "5",
        crm: "Так (Bitrix24)",
        problem: "Багато заявок з сайту, але менеджери довго передзвонюють і погано закривають клієнтів в оплату. Немає контролю дзвінків.",
        service: "audit",
        format: "online",
        status: "new",
        date: "2026-06-10T11:30:00",
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "search_sales_audit",
        paymentStatus: "pending",
        paymentAmount: 0
    },
    {
        id: "lead-2",
        name: "Ірина Мельник (Demo)",
        phone: "+38 (000) 443-88-22",
        email: "irina.demo@example.com",
        telegram: "@demo_client_2",
        company: "Sample Client School",
        site: "sample-school.example.com",
        business: "Онлайн-школа іноземних мов",
        managers: "8",
        crm: "Ні",
        problem: "Хочемо автоматизувати обробку заявок, підключити платіжні системи та налаштувати CRM KeyCRM з нуля, щоб не втрачати контакти.",
        service: "automation",
        format: "zoom",
        status: "paid",
        date: "2026-06-09T15:00:00",
        utm_source: "facebook",
        utm_medium: "leadads",
        utm_campaign: "crm_automation",
        paymentStatus: "paid",
        paymentAmount: 5000
    },
    {
        id: "lead-3",
        name: "Михайло Кравченко (Demo)",
        phone: "+38 (000) 123-45-67",
        email: "kravchenko.demo@example.com",
        telegram: "@demo_client_3",
        company: "Client Company B",
        site: "client-b.example.com",
        business: "Виробництво та продаж меблів",
        managers: "3",
        crm: "Так (Pipedrive)",
        problem: "Потрібні нові скрипти продажів для менеджерів та тренінг по роботі з запереченнями клієнтів. Команда каже, що скрипти заважають працювати.",
        service: "scripts",
        format: "telegram",
        status: "pending",
        date: "2026-06-08T10:00:00",
        utm_source: "linkedin",
        utm_medium: "organic",
        utm_campaign: "post_scripts",
        paymentStatus: "pending",
        paymentAmount: 0
    }
];

const DEFAULT_BOOKINGS = [
    {
        id: "booking-1",
        leadId: "lead-2",
        serviceName: "Автоматизація продажів & CRM",
        dateTime: "2026-06-15T14:00:00",
        format: "Google Meet",
        status: "confirmed"
    },
    {
        id: "booking-2",
        leadId: "lead-1",
        serviceName: "Аудит відділу продажів",
        dateTime: "2026-06-16T11:30:00",
        format: "Zoom",
        status: "pending"
    }
];

// Helper to load/save from localStorage
const loadState = (key, defaultData) => {
    try {
        const stored = localStorage.getItem(`sales_app_${key}`);
        return stored ? JSON.parse(stored) : defaultData;
    } catch (e) {
        console.error("Error loading state from localStorage", e);
        return defaultData;
    }
};

const saveState = (key, data) => {
    try {
        localStorage.setItem(`sales_app_${key}`, JSON.stringify(data));
    } catch (e) {
        console.error("Error saving state to localStorage", e);
    }
};

// Global state controller
export const State = {
    leads: loadState("leads", DEFAULT_LEADS),
    bookings: loadState("bookings", DEFAULT_BOOKINGS),
    articles: loadState("articles", DEFAULT_ARTICLES),
    cases: loadState("cases", DEFAULT_CASES),
    
    // Getters
    getLeads() {
        return this.leads;
    },
    
    getBookings() {
        return this.bookings;
    },
    
    getArticles() {
        return this.articles;
    },
    
    getCases() {
        return this.cases;
    },
    
    // Setters / Actions
    addLead(leadData) {
        const newLead = {
            id: `lead-${Date.now()}`,
            date: new Date().toISOString(),
            status: "new",
            paymentStatus: "pending",
            paymentAmount: 0,
            utm_source: sessionStorage.getItem("utm_source") || "direct",
            utm_medium: sessionStorage.getItem("utm_medium") || "none",
            utm_campaign: sessionStorage.getItem("utm_campaign") || "none",
            utm_content: sessionStorage.getItem("utm_content") || "none",
            utm_term: sessionStorage.getItem("utm_term") || "none",
            ...leadData
        };
        this.leads.unshift(newLead);
        saveState("leads", this.leads);
        
        // Dispatch custom event to notify components
        window.dispatchEvent(new CustomEvent("state-lead-added", { detail: newLead }));
        return newLead;
    },
    
    updateLeadStatus(leadId, status) {
        const lead = this.leads.find(l => l.id === leadId);
        if (lead) {
            lead.status = status;
            saveState("leads", this.leads);
            window.dispatchEvent(new CustomEvent("state-updated"));
        }
    },
    
    updateLeadPaymentStatus(leadId, paymentStatus, amount = 0) {
        const lead = this.leads.find(l => l.id === leadId);
        if (lead) {
            lead.paymentStatus = paymentStatus;
            if (paymentStatus === "paid") {
                lead.paymentAmount = amount;
                lead.status = "paid";
                
                // Automatically create booking if calendar date was specified
                if (lead.bookingDate && lead.bookingTime) {
                    this.addBooking({
                        leadId: lead.id,
                        serviceName: this.getServiceName(lead.service),
                        dateTime: `${lead.bookingDate}T${lead.bookingTime}:00`,
                        format: lead.format === "zoom" ? "Zoom" : lead.format === "google" ? "Google Meet" : "Telegram Call",
                        status: "confirmed"
                    });
                }
            }
            saveState("leads", this.leads);
            window.dispatchEvent(new CustomEvent("state-updated"));
        }
    },
    
    addBooking(bookingData) {
        const newBooking = {
            id: `booking-${Date.now()}`,
            status: "pending",
            ...bookingData
        };
        this.bookings.push(newBooking);
        saveState("bookings", this.bookings);
        window.dispatchEvent(new CustomEvent("state-updated"));
        return newBooking;
    },
    
    updateBookingStatus(bookingId, status) {
        const booking = this.bookings.find(b => b.id === bookingId);
        if (booking) {
            booking.status = status;
            saveState("bookings", this.bookings);
            window.dispatchEvent(new CustomEvent("state-updated"));
        }
    },
    
    addArticle(article) {
        const newArticle = {
            id: `post-${Date.now()}`,
            date: new Date().toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" }),
            readTime: "5 хв",
            ...article
        };
        this.articles.unshift(newArticle);
        saveState("articles", this.articles);
        window.dispatchEvent(new CustomEvent("state-updated"));
        return newArticle;
    },
    
    addCase(caseData) {
        const newCase = {
            id: `case-${Date.now()}`,
            ...caseData
        };
        this.cases.unshift(newCase);
        saveState("cases", this.cases);
        window.dispatchEvent(new CustomEvent("state-updated"));
        return newCase;
    },
    
    // Helper to map service slug to Ukrainian name
    getServiceName(serviceSlug) {
        const services = {
            express: "Експрес-діагностика та стратегічний розбір",
            audit: "Комплексний аудит відділу продажів під ключ",
            scripts: "Скрипти, мовні карти та стандарти комунікації",
            trainings: "Тренінги та навчання команди під вашу нішу",
            automation: "Автоматизація продажів, CRM & AI-Коучинг",
            ai: "Впровадження ШІ та Custom-розробка",
            consulting: "Індивідуальний консалтинговий супровід",
            turnkey: "Побудова системного відділу продажів під ключ"
        };
        return services[serviceSlug] || "Консультація з продажів";
    },

    getServicePrice(serviceSlug) {
        const prices = {
            express: 6000,
            audit: 45000,
            scripts: 30000,
            trainings: 40000,
            automation: 60000,
            ai: 150000,
            consulting: 80000,
            turnkey: 250000
        };
        return prices[serviceSlug] || 6000;
    },
    
    // Fetch stats for admin analytics
    getAnalyticsStats() {
        const totalLeads = this.leads.length;
        const paidLeads = this.leads.filter(l => l.paymentStatus === "paid");
        const totalRevenue = paidLeads.reduce((acc, l) => acc + (l.paymentAmount || 0), 0);
        
        // Conversions
        const conversionRate = totalLeads > 0 
            ? ((paidLeads.length / totalLeads) * 100).toFixed(1) 
            : 0;
            
        // Service distribution for charts
        const serviceCounts = {};
        this.leads.forEach(l => {
            const name = this.getServiceName(l.service);
            serviceCounts[name] = (serviceCounts[name] || 0) + 1;
        });
        
        return {
            totalLeads,
            totalRevenue,
            paidCount: paidLeads.length,
            conversionRate,
            serviceCounts
        };
    }
};

// Capture UTM search parameters and ad click IDs on load
// (full first/last-touch attribution lives in js/marketing/attribution.js)
(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const utmTags = [
        "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
        "gclid", "gbraid", "wbraid", "fbclid", "ttclid"
    ];
    utmTags.forEach(tag => {
        if (urlParams.has(tag)) {
            try {
                sessionStorage.setItem(tag, urlParams.get(tag));
            } catch (e) { /* storage unavailable */ }
        }
    });
})();
