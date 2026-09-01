const fs = require("fs");
const file = "js/portal/ui/portal-automation-view.js";
let content = fs.readFileSync(file, "utf8");

const oldRenderRegex = /async render\(projectId\) \{[\s\S]*?<!-- Modals -->/;

const newRender = `async render(projectId) {
        this.projectId = projectId;
        this.container.innerHTML = \`
            <div class="automation-view p-4">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">��������� �������������� (Phase 6C)</h2>
                    <button id="btn-add-rule" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">
                        �������� �������
                    </button>
                </div>
                
                <!-- Health & SLA -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div class="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                        <h3 class="text-xl font-semibold mb-4">Project Health</h3>
                        <div id="health-details">
                            <div class="text-center text-gray-500 py-4">������������...</div>
                        </div>
                    </div>
                    <div class="bg-white p-4 rounded shadow border-l-4 border-yellow-500">
                        <h3 class="text-xl font-semibold mb-4">SLA State</h3>
                        <div id="sla-details">
                            <div class="text-center text-gray-500 py-4">������������...</div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Rules Section -->
                    <div class="bg-white p-4 rounded shadow">
                        <h3 class="text-xl font-semibold mb-4">������� (Workflow Rules)</h3>
                        <div id="rules-list" class="space-y-4">
                            <div class="text-center text-gray-500 py-4">������������...</div>
                        </div>
                    </div>
                    
                    <!-- Logs & Blockers Section -->
                    <div class="space-y-6">
                        <div class="bg-white p-4 rounded shadow">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-xl font-semibold">������� (Blockers)</h3>
                                <button id="btn-add-blocker" class="text-sm bg-red-100 text-red-700 px-3 py-1 rounded">+ �����������</button>
                            </div>
                            <div id="blockers-list" class="space-y-2">
                                <div class="text-center text-gray-500 py-4">������������...</div>
                            </div>
                        </div>

                        <div class="bg-white p-4 rounded shadow">
                            <h3 class="text-xl font-semibold mb-4">������ ��������� (Execution Log)</h3>
                            <div id="execution-log" class="space-y-2 max-h-64 overflow-y-auto">
                                <div class="text-center text-gray-500 py-4">������������...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modals -->\`;
`;

content = content.replace(oldRenderRegex, newRender);
fs.writeFileSync(file, content);
console.log("Patched portal-automation-view.js layout");

